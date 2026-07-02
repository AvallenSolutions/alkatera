import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getSupplierEsgCoverage,
  getSupplierClimateCoverage,
  DUE_DILIGENCE_QUESTION_IDS,
  type SupplierEsgCoverage,
} from './supplier-esg-evidence';
import { calculateCorporateEmissions } from '@/lib/calculations/corporate-emissions';
import {
  assessReductionPlan,
  assessNetZeroPathway,
  isEmissionsTarget,
  hasDeclaredMethodology,
  type InitiativeEvidenceRow,
  type TargetEvidenceRow,
} from './initiative-evidence';

// Maps B Corp 2026 requirements to the alkatera modules that already hold
// relevant data. Only modules confirmed to exist in the schema are mapped;
// requirements with no backing module (e.g. health & safety, recruitment)
// are intentionally absent and fall back to manual evidence.

export type Completeness = 'complete' | 'partial' | 'missing';

export interface PlatformEvidenceItem {
  sourceRecordId: string;
  label: string;
  summary: string;
  /** Optional deep-link into the source record (e.g. /pulse/targets?action=<id>). */
  url?: string;
}

export interface PlatformEvidenceResult {
  module: string;
  moduleLabel: string;
  moduleLink: string;
  found: boolean;
  completeness: Completeness;
  completenessNote: string | null;
  items: PlatformEvidenceItem[];
}

interface ModuleMapping {
  module: string;
  moduleLabel: string;
  moduleLink: string;
  query: (
    supabase: SupabaseClient,
    organizationId: string,
  ) => Promise<Omit<PlatformEvidenceResult, 'module' | 'moduleLabel' | 'moduleLink'>>;
}

function summariseCount(
  count: number,
  noun: string,
): { found: boolean; completeness: Completeness; completenessNote: string | null } {
  if (count === 0) {
    return {
      found: false,
      completeness: 'missing',
      completenessNote: `No ${noun} found on alkatera.`,
    };
  }
  return { found: true, completeness: 'complete', completenessNote: null };
}

/**
 * Build a platform-evidence result from supplier ESG coverage: an aggregate
 * headline item plus one traceable item per assessed supplier (so an auditor can
 * click through to each supplier's assessment).
 */
function esgCoverageResult(
  cov: SupplierEsgCoverage,
  aggregateLabel: string,
): Omit<PlatformEvidenceResult, 'module' | 'moduleLabel' | 'moduleLink'> {
  if (cov.assessed === 0) {
    return {
      found: false,
      completeness: cov.completeness,
      completenessNote: cov.note,
      items: [],
    };
  }
  return {
    found: true,
    completeness: cov.completeness,
    completenessNote: cov.note,
    items: [
      { sourceRecordId: 'aggregate', label: aggregateLabel, summary: cov.note ?? '' },
      ...cov.assessedSuppliers.slice(0, 20).map((s) => ({
        sourceRecordId: s.assessmentId,
        label: s.name,
        summary:
          `ESG self-assessment ${s.verified ? 'verified' : 'submitted'}` +
          (s.labour != null ? `, labour ${s.labour}` : '') +
          (s.ethics != null ? `, ethics ${s.ethics}` : ''),
      })),
    ],
  };
}

/**
 * Initiatives linked (via initiative_target_links) to at least one
 * emissions-related sustainability target. Used by IT5-Y3-002 and IT5-Y5-001.
 */
async function fetchEmissionsLinkedInitiatives(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<InitiativeEvidenceRow[]> {
  const { data: targetRows } = await supabase
    .from('sustainability_targets')
    .select('id, metric_key, scope')
    .eq('organization_id', organizationId);
  const emissionsTargetIds = (targetRows ?? [])
    .filter((t: any) => isEmissionsTarget(t))
    .map((t: any) => t.id);
  if (emissionsTargetIds.length === 0) return [];

  const { data: links } = await supabase
    .from('initiative_target_links')
    .select('initiative_id')
    .in('target_id', emissionsTargetIds);
  const initiativeIds = Array.from(new Set((links ?? []).map((l: any) => l.initiative_id)));
  if (initiativeIds.length === 0) return [];

  const { data: initiatives } = await supabase
    .from('reduction_initiatives')
    .select(
      'id, title, status, start_date, end_date, owner_user_id, owner_name, approved_at, percent_complete, progress_updated_at, expected_annual_reduction_value, expected_annual_reduction_unit',
    )
    .in('id', initiativeIds)
    .eq('organization_id', organizationId);
  return (initiatives ?? []) as InitiativeEvidenceRow[];
}

function summariseInitiative(i: InitiativeEvidenceRow): string {
  const parts = [
    i.status === 'completed' ? 'Completed' : i.status === 'active' ? 'Active' : 'Planned',
    i.owner_name || (i.owner_user_id ? 'owner assigned' : null),
    i.percent_complete != null ? `${i.percent_complete}% complete` : null,
    i.expected_annual_reduction_value
      ? `expected ${i.expected_annual_reduction_value} ${i.expected_annual_reduction_unit ?? ''}`.trim()
      : null,
  ].filter(Boolean);
  return parts.join(', ');
}

const MAPPINGS: Record<string, ModuleMapping> = {
  // Climate Action — GHG measurement
  'IT5-Y0-001': {
    module: 'emissions',
    moduleLabel: 'Emissions',
    moduleLink: '/data',
    async query(supabase, orgId) {
      // The app never writes to the legacy `ghg_emissions` table. Real GHG data
      // lives across the utility / fleet / overhead / LCA tables and is
      // aggregated by the single-source-of-truth `calculateCorporateEmissions`
      // — the same path the Emissions dashboard uses. Candidate reporting years
      // come from `corporate_reports` (newest first), with the current year as
      // a fallback so freshly-entered data still counts.
      const { data: reports } = await supabase
        .from('corporate_reports')
        .select('year')
        .eq('organization_id', orgId)
        .order('year', { ascending: false });
      const currentYear = new Date().getUTCFullYear();
      const years = Array.from(
        new Set<number>([
          currentYear,
          ...(reports ?? []).map((r: any) => Number(r.year)),
        ]),
      )
        .filter((y) => Number.isFinite(y))
        .sort((a, b) => b - a)
        .slice(0, 6);

      const toTonnes = (kg: number) => (kg / 1000).toFixed(2);
      for (const year of years) {
        const result = await calculateCorporateEmissions(supabase, orgId, year);
        if (result.hasData) {
          const b = result.breakdown;
          return {
            found: true,
            completeness: 'complete' as Completeness,
            completenessNote: null,
            items: [
              {
                sourceRecordId: `emissions-${year}`,
                label: `GHG inventory ${year}`,
                summary:
                  `${toTonnes(b.total)} tCO2e total. ` +
                  `Scope 1 ${toTonnes(b.scope1)}, ` +
                  `Scope 2 ${toTonnes(b.scope2)}, ` +
                  `Scope 3 ${toTonnes(b.scope3.total)} (tCO2e)`,
              },
            ],
          };
        }
      }

      return {
        found: false,
        completeness: 'missing' as Completeness,
        completenessNote: 'No emissions data found on alkatera.',
        items: [],
      };
    },
  },
  // Climate Action — reduction targets / commitment
  'IT5-Y0-002': {
    module: 'targets',
    moduleLabel: 'Sustainability targets',
    moduleLink: '/pulse/targets',
    async query(supabase, orgId) {
      // Fetch the org's targets and filter for emissions-related ones in JS.
      // Don't cap the query before filtering — a small `.limit()` here could
      // drop the only CO2 target if it isn't among the first rows returned.
      const { data } = await supabase
        .from('sustainability_targets')
        .select('id, metric_key, target_value, target_date, scope, status, methodology, notes')
        .eq('organization_id', orgId)
        .order('target_date', { ascending: false });
      const rows = (data ?? []).filter((r: any) => isEmissionsTarget(r));
      const base = summariseCount(rows.length, 'emissions reduction targets');

      // A bare number is a weak commitment; B Corp expects it to be aligned
      // with science-based targets or equivalent, so we ask for the method.
      // Soft signal only: this never un-passes verified evidence links.
      if (rows.length > 0 && !rows.some((r: any) => hasDeclaredMethodology(r))) {
        base.completeness = 'partial';
        base.completenessNote =
          'You have an emissions target, but no method behind it. Add the method (for example SBTi 1.5C) to the target to strengthen this evidence.';
      }

      return {
        ...base,
        items: rows.slice(0, 5).map((r: any) => ({
          sourceRecordId: r.id,
          label: r.metric_key,
          summary: `Target ${r.target_value} by ${r.target_date} (${r.status})${r.methodology ? `, method: ${r.methodology}` : ''}`,
        })),
      };
    },
  },
  // Climate Action — time-bound emissions reduction plan with tracked
  // progress (Year 3). Evidence is reduction initiatives linked to emissions
  // targets; the completeness rules live in initiative-evidence.ts.
  'IT5-Y3-002': {
    module: 'targets',
    moduleLabel: 'Sustainability targets',
    moduleLink: '/pulse/targets',
    async query(supabase, orgId) {
      const initiatives = await fetchEmissionsLinkedInitiatives(supabase, orgId);
      const plan = assessReductionPlan(initiatives);

      if (initiatives.length === 0) {
        return {
          found: false,
          completeness: plan.completeness,
          completenessNote: plan.note,
          items: [],
        };
      }

      return {
        found: true,
        completeness: plan.completeness,
        completenessNote: plan.note,
        items: [
          // Stable aggregate item first so the nightly cron's suggestion
          // stays a single row rather than churning per initiative.
          { sourceRecordId: 'aggregate', label: 'Emissions reduction action plan', summary: plan.note },
          ...(plan.qualifying.length > 0 ? plan.qualifying : initiatives).slice(0, 5).map((i) => ({
            sourceRecordId: i.id,
            label: i.title,
            summary: summariseInitiative(i),
          })),
        ],
      };
    },
  },
  // Climate Action — net zero pathway (Year 5). Conservative platform
  // signal: a net-zero target plus a qualifying tracked plan; validated
  // pathway documents usually still arrive as manual evidence.
  'IT5-Y5-001': {
    module: 'targets',
    moduleLabel: 'Sustainability targets',
    moduleLink: '/pulse/targets',
    async query(supabase, orgId) {
      const { data: targetRows } = await supabase
        .from('sustainability_targets')
        .select('id, metric_key, target_value, target_date, scope, status, methodology, notes')
        .eq('organization_id', orgId);
      const targets = (targetRows ?? []) as TargetEvidenceRow[];
      const initiatives = await fetchEmissionsLinkedInitiatives(supabase, orgId);
      const pathway = assessNetZeroPathway(targets, initiatives);

      const netZero = targets.filter(
        (t) => isEmissionsTarget(t) && Number(t.target_value) === 0 && t.target_date,
      );

      return {
        found: pathway.completeness !== 'missing',
        completeness: pathway.completeness,
        completenessNote: pathway.note,
        items:
          pathway.completeness === 'missing'
            ? []
            : [
                { sourceRecordId: 'aggregate', label: 'Net zero pathway', summary: pathway.note },
                ...netZero.slice(0, 3).map((t) => ({
                  sourceRecordId: t.id,
                  label: t.metric_key,
                  summary: `Net zero by ${t.target_date}${t.methodology ? `, method: ${t.methodology}` : ''}`,
                })),
                ...pathway.qualifying.slice(0, 3).map((i) => ({
                  sourceRecordId: i.id,
                  label: i.title,
                  summary: summariseInitiative(i),
                })),
              ],
      };
    },
  },
  // Climate Action — Scope 3 / value-chain emissions (Year 3).
  // Supplementary supplier-sourced signal: direct suppliers who report measuring
  // Scope 3 (env_11) and/or holding a science-based target (env_12). This supports
  // the brand's value-chain story; the brand's own emissions data drives the core
  // climate requirements (IT5-Y0-001 / IT5-Y0-002).
  'IT5-Y3-001': {
    module: 'suppliers',
    moduleLabel: 'Suppliers',
    moduleLink: '/suppliers',
    async query(supabase, orgId) {
      const cov = await getSupplierClimateCoverage(supabase, orgId);
      if (cov.engaged === 0) {
        return {
          found: false,
          completeness: cov.completeness,
          completenessNote: cov.note,
          items: [],
        };
      }
      return {
        found: true,
        completeness: cov.completeness,
        completenessNote: cov.note,
        items: [
          {
            sourceRecordId: 'aggregate',
            label: 'Supplier value-chain climate engagement',
            summary: cov.note ?? '',
          },
          ...cov.engagedSuppliers.slice(0, 20).map((s) => ({
            sourceRecordId: s.assessmentId,
            label: s.name,
            summary: [
              s.measuresScope3 ? 'measures Scope 3' : null,
              s.hasScienceTarget ? 'science-based target' : null,
            ]
              .filter(Boolean)
              .join(', '),
          })),
        ],
      };
    },
  },
  // Fair Work — living wage / compensation
  'IT2-Y0-001': {
    module: 'compensation',
    moduleLabel: 'People & culture',
    moduleLink: '/people-culture',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('people_employee_compensation')
        .select('id, role_title, annual_salary, currency, reporting_year')
        .eq('organization_id', orgId)
        .limit(50);
      const rows = data ?? [];
      const base = summariseCount(rows.length, 'compensation records');
      const missingSalary = rows.filter((r: any) => r.annual_salary == null);
      if (rows.length > 0 && missingSalary.length > 0) {
        base.completeness = 'partial';
        base.completenessNote = `Partial data: ${missingSalary.length} of ${rows.length} compensation records have no annual salary.`;
      }
      return {
        ...base,
        items: rows.slice(0, 5).map((r: any) => ({
          sourceRecordId: r.id,
          label: r.role_title ?? 'Employee record',
          summary:
            r.annual_salary != null
              ? `${r.annual_salary} ${r.currency} (${r.reporting_year})`
              : 'No salary recorded',
        })),
      };
    },
  },
  // Fair Work — pay equity (Year 3)
  'IT2-Y3-002': {
    module: 'compensation',
    moduleLabel: 'People & culture',
    moduleLink: '/people-culture',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('people_employee_compensation')
        .select('id, gender, annual_salary')
        .eq('organization_id', orgId)
        .limit(200);
      const rows = data ?? [];
      const withGender = rows.filter((r: any) => !!r.gender);
      if (rows.length === 0) {
        return {
          found: false,
          completeness: 'missing',
          completenessNote: 'No compensation records found on alkatera.',
          items: [],
        };
      }
      const partial = withGender.length < rows.length;
      return {
        found: true,
        completeness: partial ? 'partial' : 'complete',
        completenessNote: partial
          ? `Partial data: ${rows.length - withGender.length} records have no gender, so a pay equity analysis would be incomplete.`
          : null,
        items: [
          {
            sourceRecordId: 'aggregate',
            label: 'Compensation dataset',
            summary: `${rows.length} records, ${withGender.length} with demographic data`,
          },
        ],
      };
    },
  },
  // JEDI — diversity data (Year 3)
  'IT3-Y3-001': {
    module: 'workforce',
    moduleLabel: 'People & culture',
    moduleLink: '/people-culture',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('people_workforce_demographics')
        .select('id, dimension, category_value, employee_count, reporting_year')
        .eq('organization_id', orgId)
        .limit(10);
      const rows = data ?? [];
      const base = summariseCount(rows.length, 'workforce diversity data');
      return {
        ...base,
        items: rows.slice(0, 5).map((r: any) => ({
          sourceRecordId: r.id,
          label: `${r.dimension}: ${r.category_value}`,
          summary: `${r.employee_count} employees (${r.reporting_year})`,
        })),
      };
    },
  },
  // Human Rights — forced & child labour / supply chain due diligence.
  // Backed by the supplier ESG self-assessment: coverage of direct (Tier 1)
  // suppliers who have completed the survey, with their labour & ethics scores.
  'IT4-Y0-002': {
    module: 'suppliers',
    moduleLabel: 'Suppliers',
    moduleLink: '/suppliers',
    async query(supabase, orgId) {
      const cov = await getSupplierEsgCoverage(supabase, orgId);
      return esgCoverageResult(cov, 'Supplier ESG self-assessment coverage');
    },
  },
  // Human Rights — due diligence (Year 3). Deeper bar than Y0: counts only suppliers
  // who report human-rights due-diligence practices (living income / country-level
  // risk — the lhr_11/lhr_12 questions tagged to this requirement).
  'IT4-Y3-001': {
    module: 'suppliers',
    moduleLabel: 'Suppliers',
    moduleLink: '/suppliers',
    async query(supabase, orgId) {
      const cov = await getSupplierEsgCoverage(supabase, orgId, {
        requireAnyAffirmed: DUE_DILIGENCE_QUESTION_IDS,
        coverageLabel:
          'report human-rights due-diligence practices (living income or country-level risk assessment)',
      });
      return esgCoverageResult(cov, 'Supply-chain human-rights due diligence');
    },
  },
  // Environmental Stewardship — resource use / waste
  'IT6-Y0-001': {
    module: 'operations',
    moduleLabel: 'Operations',
    moduleLink: '/operations',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('facility_activity_entries')
        .select('id, activity_category, quantity, unit, activity_date')
        .eq('organization_id', orgId)
        .order('activity_date', { ascending: false })
        .limit(5);
      const rows = data ?? [];
      const base = summariseCount(rows.length, 'operational resource data');
      return {
        ...base,
        items: rows.map((r: any) => ({
          sourceRecordId: r.id,
          label: String(r.activity_category),
          summary: `${r.quantity} ${r.unit} on ${r.activity_date}`,
        })),
      };
    },
  },
  'IT6-Y0-002': {
    module: 'operations',
    moduleLabel: 'Operations',
    moduleLink: '/operations',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('facility_activity_entries')
        .select('id, activity_category, quantity, unit, activity_date')
        .eq('organization_id', orgId)
        .order('activity_date', { ascending: false })
        .limit(5);
      const rows = data ?? [];
      const base = summariseCount(rows.length, 'waste or resource data');
      return {
        ...base,
        items: rows.map((r: any) => ({
          sourceRecordId: r.id,
          label: String(r.activity_category),
          summary: `${r.quantity} ${r.unit} on ${r.activity_date}`,
        })),
      };
    },
  },
  // Purpose & Governance — mission / legal commitment
  'IT1-Y0-001': {
    module: 'governance',
    moduleLabel: 'Governance',
    moduleLink: '/governance',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('governance_mission')
        .select('id')
        .eq('organization_id', orgId)
        .limit(1);
      const rows = data ?? [];
      const base = summariseCount(rows.length, 'mission statement');
      return {
        ...base,
        items: rows.map((r: any) => ({
          sourceRecordId: r.id,
          label: 'Mission statement',
          summary: 'Mission recorded in Governance',
        })),
      };
    },
  },
  'IT1-Y0-002': {
    module: 'governance',
    moduleLabel: 'Governance',
    moduleLink: '/governance',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('governance_policies')
        .select('id, policy_name, policy_type, status')
        .eq('organization_id', orgId)
        .limit(10);
      const rows = data ?? [];
      const base = summariseCount(rows.length, 'governance policies');
      return {
        ...base,
        items: rows.slice(0, 5).map((r: any) => ({
          sourceRecordId: r.id,
          label: r.policy_name,
          summary: `${r.policy_type} (${r.status})`,
        })),
      };
    },
  },
};

export interface PlatformHealthEntry {
  module: string;
  moduleLabel: string;
  moduleLink: string;
  status: Completeness;
  requirementCodes: string[];
  note: string | null;
  /** Per-record deep links shown as chips under the note (e.g. individual actions). */
  actionLinks?: { label: string; url: string }[];
}

const SEVERITY: Record<Completeness, number> = {
  complete: 0,
  partial: 1,
  missing: 2,
};

/**
 * Aggregate platform data quality by module across the given requirement
 * codes. Module status is the worst (missing > partial > complete) seen
 * across its mapped requirements.
 */
export async function computePlatformHealth(
  supabase: SupabaseClient,
  organizationId: string,
  requirementCodes: string[],
): Promise<PlatformHealthEntry[]> {
  const byModule = new Map<string, PlatformHealthEntry>();
  for (const code of requirementCodes) {
    const mapping = MAPPINGS[code];
    if (!mapping) continue;
    const result = await queryPlatformEvidence(supabase, code, organizationId);
    if (!result) continue;
    const existing = byModule.get(mapping.module);
    if (!existing) {
      byModule.set(mapping.module, {
        module: mapping.module,
        moduleLabel: mapping.moduleLabel,
        moduleLink: mapping.moduleLink,
        status: result.completeness,
        requirementCodes: [code],
        note: result.completenessNote,
      });
    } else {
      existing.requirementCodes.push(code);
      if (SEVERITY[result.completeness] > SEVERITY[existing.status]) {
        existing.status = result.completeness;
        existing.note = result.completenessNote;
      }
    }
  }
  return Array.from(byModule.values());
}

export function getModuleMapping(
  requirementCode: string,
): Pick<ModuleMapping, 'module' | 'moduleLabel' | 'moduleLink'> | null {
  const m = MAPPINGS[requirementCode];
  return m
    ? { module: m.module, moduleLabel: m.moduleLabel, moduleLink: m.moduleLink }
    : null;
}

export function getMappedRequirementCodes(): string[] {
  return Object.keys(MAPPINGS);
}

/**
 * Run the mapped module query for a requirement. Returns null when the
 * requirement has no platform mapping (manual evidence only).
 */
export async function queryPlatformEvidence(
  supabase: SupabaseClient,
  requirementCode: string,
  organizationId: string,
): Promise<PlatformEvidenceResult | null> {
  const mapping = MAPPINGS[requirementCode];
  if (!mapping) return null;
  const result = await mapping.query(supabase, organizationId);
  return {
    module: mapping.module,
    moduleLabel: mapping.moduleLabel,
    moduleLink: mapping.moduleLink,
    ...result,
  };
}
