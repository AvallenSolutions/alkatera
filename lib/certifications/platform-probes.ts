import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProbeId } from './frameworks/types';
import type {
  Completeness,
  PlatformEvidenceResult,
  PlatformHealthEntry,
} from './platform-data';
import {
  getSupplierEsgCoverage,
  getSupplierClimateCoverage,
} from './supplier-esg-evidence';
import { calculateCorporateEmissions } from '@/lib/calculations/corporate-emissions';
import {
  assessReductionPlan,
  isEmissionsTarget,
  hasDeclaredMethodology,
  type InitiativeEvidenceRow,
} from './initiative-evidence';

// Generic auto-evidence "probes" shared by the checklist-style frameworks
// (ISO 14001, ISO 50001, EcoVadis). Each framework requirement declares a
// `probe: ProbeId` in its content module; this registry knows how to satisfy
// each probe from existing alkatera data. The same probe can back requirements
// across all three frameworks, so the data plumbing is written once.
//
// Mirrors the shape of lib/certifications/platform-data.ts (the B Corp engine),
// but is keyed by ProbeId rather than B Corp requirement code.

type Probeless = Omit<PlatformEvidenceResult, 'module' | 'moduleLabel' | 'moduleLink'>;

interface ProbeDef {
  module: string;
  moduleLabel: string;
  moduleLink: string;
  query: (supabase: SupabaseClient, organizationId: string) => Promise<Probeless>;
}

function missing(note: string): Probeless {
  return { found: false, completeness: 'missing', completenessNote: note, items: [] };
}

function countResult(
  count: number,
  noun: string,
): { found: boolean; completeness: Completeness; completenessNote: string | null } {
  if (count === 0) {
    return { found: false, completeness: 'missing', completenessNote: `No ${noun} found on alkatera.` };
  }
  return { found: true, completeness: 'complete', completenessNote: null };
}

/**
 * Recent facility activity entries whose category matches a predicate (energy /
 * water / waste). Pulled once and filtered in JS so one query serves all three.
 */
async function activityProbe(
  supabase: SupabaseClient,
  orgId: string,
  matches: (category: string) => boolean,
  noun: string,
): Promise<Probeless> {
  const { data } = await supabase
    .from('facility_activity_entries')
    .select('id, activity_category, quantity, unit, activity_date')
    .eq('organization_id', orgId)
    .order('activity_date', { ascending: false })
    .limit(200);
  const rows = (data ?? []).filter((r: any) =>
    matches(String(r.activity_category ?? '').toLowerCase()),
  );
  const base = countResult(rows.length, noun);
  return {
    ...base,
    items: rows.slice(0, 5).map((r: any) => ({
      sourceRecordId: r.id,
      label: String(r.activity_category),
      summary: `${r.quantity} ${r.unit} on ${r.activity_date}`,
    })),
  };
}

/** Initiatives linked to at least one emissions-related target. */
async function fetchEmissionsLinkedInitiatives(
  supabase: SupabaseClient,
  orgId: string,
): Promise<InitiativeEvidenceRow[]> {
  const { data: targetRows } = await supabase
    .from('sustainability_targets')
    .select('id, metric_key, scope')
    .eq('organization_id', orgId);
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
    .eq('organization_id', orgId);
  return (initiatives ?? []) as InitiativeEvidenceRow[];
}

const PROBES: Record<ProbeId, ProbeDef> = {
  facilities: {
    module: 'operations',
    moduleLabel: 'Facilities',
    moduleLink: '/operations',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('facilities')
        .select('id, name')
        .eq('organization_id', orgId)
        .limit(50);
      const rows = data ?? [];
      const base = countResult(rows.length, 'facilities');
      return {
        ...base,
        items: rows.slice(0, 10).map((r: any) => ({
          sourceRecordId: r.id,
          label: r.name ?? 'Facility',
          summary: 'Site recorded in Operations',
        })),
      };
    },
  },
  emissionsInventory: {
    module: 'emissions',
    moduleLabel: 'Emissions',
    moduleLink: '/data',
    async query(supabase, orgId) {
      const { data: reports } = await supabase
        .from('corporate_reports')
        .select('year')
        .eq('organization_id', orgId)
        .order('year', { ascending: false });
      const currentYear = new Date().getUTCFullYear();
      const years = Array.from(
        new Set<number>([currentYear, ...(reports ?? []).map((r: any) => Number(r.year))]),
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
                  `Scope 1 ${toTonnes(b.scope1)}, Scope 2 ${toTonnes(b.scope2)}, ` +
                  `Scope 3 ${toTonnes(b.scope3.total)} (tCO2e)`,
              },
            ],
          };
        }
      }
      return missing('No emissions data found on alkatera.');
    },
  },
  emissionsTarget: {
    module: 'targets',
    moduleLabel: 'Sustainability targets',
    moduleLink: '/pulse/targets',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('sustainability_targets')
        .select('id, metric_key, target_value, target_date, scope, status, methodology, notes')
        .eq('organization_id', orgId)
        .order('target_date', { ascending: false });
      const rows = (data ?? []).filter((r: any) => isEmissionsTarget(r));
      const base = countResult(rows.length, 'emissions reduction targets');
      if (rows.length > 0 && !rows.some((r: any) => hasDeclaredMethodology(r))) {
        base.completeness = 'partial';
        base.completenessNote =
          'You have an emissions target, but no method behind it. Add the method (for example SBTi 1.5C) to strengthen this evidence.';
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
  reductionPlan: {
    module: 'targets',
    moduleLabel: 'Sustainability targets',
    moduleLink: '/pulse/targets',
    async query(supabase, orgId) {
      const initiatives = await fetchEmissionsLinkedInitiatives(supabase, orgId);
      const plan = assessReductionPlan(initiatives);
      if (initiatives.length === 0) {
        return { found: false, completeness: plan.completeness, completenessNote: plan.note, items: [] };
      }
      return {
        found: true,
        completeness: plan.completeness,
        completenessNote: plan.note,
        items: [
          { sourceRecordId: 'aggregate', label: 'Reduction action plan', summary: plan.note },
          ...(plan.qualifying.length > 0 ? plan.qualifying : initiatives).slice(0, 5).map((i) => ({
            sourceRecordId: i.id,
            label: i.title,
            summary: [
              i.status === 'completed' ? 'Completed' : i.status === 'active' ? 'Active' : 'Planned',
              i.owner_name || (i.owner_user_id ? 'owner assigned' : null),
              i.percent_complete != null ? `${i.percent_complete}% complete` : null,
            ]
              .filter(Boolean)
              .join(', '),
          })),
        ],
      };
    },
  },
  energyData: {
    module: 'operations',
    moduleLabel: 'Operations',
    moduleLink: '/operations',
    query: (s, o) =>
      activityProbe(
        s,
        o,
        (c) => /electric|energy|fuel|gas|diesel|petrol|kwh/.test(c),
        'energy data',
      ),
  },
  waterData: {
    module: 'operations',
    moduleLabel: 'Operations',
    moduleLink: '/operations',
    query: (s, o) => activityProbe(s, o, (c) => /water|effluent/.test(c), 'water data'),
  },
  wasteData: {
    module: 'operations',
    moduleLabel: 'Operations',
    moduleLink: '/operations',
    query: (s, o) => activityProbe(s, o, (c) => /waste|recycl/.test(c), 'waste data'),
  },
  metricTrend: {
    module: 'pulse',
    moduleLabel: 'Pulse',
    moduleLink: '/pulse',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('metric_snapshots')
        .select('metric_key, snapshot_date, value, unit')
        .eq('organization_id', orgId)
        .order('snapshot_date', { ascending: false })
        .limit(200);
      const rows = data ?? [];
      // A trend needs at least two snapshots for the same metric.
      const byMetric = new Map<string, any[]>();
      for (const r of rows) {
        (byMetric.get(r.metric_key) ?? byMetric.set(r.metric_key, []).get(r.metric_key)!).push(r);
      }
      const trending = Array.from(byMetric.entries()).filter(([, v]) => v.length >= 2);
      if (trending.length === 0) {
        return missing('No time-series metric data found on alkatera to show a trend.');
      }
      return {
        found: true,
        completeness: 'complete',
        completenessNote: null,
        items: trending.slice(0, 5).map(([key, v]) => ({
          sourceRecordId: `metric-${key}`,
          label: key,
          summary: `${v.length} data points, latest ${v[0].value} ${v[0].unit ?? ''} on ${v[0].snapshot_date}`,
        })),
      };
    },
  },
  productLca: {
    module: 'products',
    moduleLabel: 'Product LCAs',
    moduleLink: '/products',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('product_carbon_footprints')
        .select('id, product_id, total_carbon_footprint')
        .eq('organization_id', orgId)
        .limit(50);
      const rows = data ?? [];
      const base = countResult(rows.length, 'product life-cycle assessments');
      return {
        ...base,
        items: rows.slice(0, 5).map((r: any) => ({
          sourceRecordId: r.id,
          label: 'Product LCA',
          summary:
            r.total_carbon_footprint != null
              ? `${Number(r.total_carbon_footprint).toFixed(2)} kg CO2e per unit`
              : 'LCA recorded',
        })),
      };
    },
  },
  productLcaEol: {
    module: 'products',
    moduleLabel: 'Product LCAs',
    moduleLink: '/products',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('product_carbon_footprints')
        .select('id, end_of_life, end_of_life_pathway')
        .eq('organization_id', orgId)
        .limit(50);
      const rows = (data ?? []).filter(
        (r: any) => r.end_of_life != null || r.end_of_life_pathway != null,
      );
      const base = countResult(rows.length, 'product end-of-life data');
      return {
        ...base,
        items: rows.slice(0, 5).map((r: any) => ({
          sourceRecordId: r.id,
          label: 'Product end-of-life',
          summary: r.end_of_life_pathway ? String(r.end_of_life_pathway) : 'End-of-life stage modelled',
        })),
      };
    },
  },
  productionLogs: {
    module: 'operations',
    moduleLabel: 'Operations',
    moduleLink: '/operations',
    query: (s, o) =>
      activityProbe(s, o, (c) => /production|output|volume|batch/.test(c), 'production data'),
  },
  training: {
    module: 'people',
    moduleLabel: 'People & culture',
    moduleLink: '/people-culture',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('people_training_records')
        .select('id, training_name, training_type, completion_date')
        .eq('organization_id', orgId)
        .limit(50);
      const rows = data ?? [];
      const base = countResult(rows.length, 'training records');
      return {
        ...base,
        items: rows.slice(0, 5).map((r: any) => ({
          sourceRecordId: r.id,
          label: r.training_name ?? r.training_type ?? 'Training record',
          summary: r.completion_date ? `Completed ${r.completion_date}` : 'Training recorded',
        })),
      };
    },
  },
  workforceDemographics: {
    module: 'people',
    moduleLabel: 'People & culture',
    moduleLink: '/people-culture',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('people_workforce_demographics')
        .select('id, dimension, category_value, employee_count, reporting_year')
        .eq('organization_id', orgId)
        .limit(20);
      const rows = data ?? [];
      const base = countResult(rows.length, 'workforce diversity data');
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
  compensation: {
    module: 'people',
    moduleLabel: 'People & culture',
    moduleLink: '/people-culture',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('people_employee_compensation')
        .select('id, role_title, annual_salary, currency, reporting_year')
        .eq('organization_id', orgId)
        .limit(50);
      const rows = data ?? [];
      const base = countResult(rows.length, 'compensation records');
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
  governancePolicies: {
    module: 'governance',
    moduleLabel: 'Governance',
    moduleLink: '/governance',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('governance_policies')
        .select('id, policy_name, policy_type, status')
        .eq('organization_id', orgId)
        .limit(20);
      const rows = data ?? [];
      const base = countResult(rows.length, 'governance policies');
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
  governanceMission: {
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
      const base = countResult(rows.length, 'mission statement');
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
  governanceEthics: {
    module: 'governance',
    moduleLabel: 'Governance',
    moduleLink: '/governance',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('governance_ethics_records')
        .select('id, record_type, record_name, record_date, status')
        .eq('organization_id', orgId)
        .order('record_date', { ascending: false })
        .limit(20);
      const rows = data ?? [];
      const base = countResult(rows.length, 'ethics, anti-corruption or compliance records');
      return {
        ...base,
        items: rows.slice(0, 5).map((r: any) => ({
          sourceRecordId: r.id,
          label: r.record_name ?? r.record_type ?? 'Ethics record',
          summary: `${r.record_type ?? 'record'}${r.record_date ? ` on ${r.record_date}` : ''} (${r.status ?? 'recorded'})`,
        })),
      };
    },
  },
  community: {
    module: 'governance',
    moduleLabel: 'Community & stakeholders',
    moduleLink: '/governance',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('community_engagements')
        .select('id, engagement_name, engagement_type, stakeholder_group, participants_count')
        .eq('organization_id', orgId)
        .limit(20);
      const rows = data ?? [];
      const base = countResult(rows.length, 'community or stakeholder engagement records');
      return {
        ...base,
        items: rows.slice(0, 5).map((r: any) => ({
          sourceRecordId: r.id,
          label: r.engagement_name ?? 'Engagement',
          summary: [r.stakeholder_group, r.engagement_type, r.participants_count != null ? `${r.participants_count} people` : null]
            .filter(Boolean)
            .join(' · '),
        })),
      };
    },
  },
  supplierEsg: {
    module: 'suppliers',
    moduleLabel: 'Suppliers',
    moduleLink: '/suppliers',
    async query(supabase, orgId) {
      const cov = await getSupplierEsgCoverage(supabase, orgId);
      if (cov.assessed === 0) {
        return { found: false, completeness: cov.completeness, completenessNote: cov.note, items: [] };
      }
      return {
        found: true,
        completeness: cov.completeness,
        completenessNote: cov.note,
        items: [
          { sourceRecordId: 'aggregate', label: 'Supplier ESG self-assessment coverage', summary: cov.note ?? '' },
          ...cov.assessedSuppliers.slice(0, 20).map((s) => ({
            sourceRecordId: s.assessmentId,
            label: s.name,
            summary: `ESG self-assessment ${s.verified ? 'verified' : 'submitted'}`,
          })),
        ],
      };
    },
  },
};

/**
 * Run a single probe. Returns null on any error or unknown probe so a broken
 * probe never blocks the rest of an evidence/health computation.
 */
export async function queryProbeEvidence(
  supabase: SupabaseClient,
  probe: ProbeId | null | undefined,
  organizationId: string,
): Promise<PlatformEvidenceResult | null> {
  if (!probe) return null;
  const def = PROBES[probe];
  if (!def) return null;
  try {
    const result = await def.query(supabase, organizationId);
    return { module: def.module, moduleLabel: def.moduleLabel, moduleLink: def.moduleLink, ...result };
  } catch (err) {
    console.error(`probe ${probe} failed:`, err);
    return null;
  }
}

export function getProbeModule(
  probe: ProbeId | null | undefined,
): Pick<ProbeDef, 'module' | 'moduleLabel' | 'moduleLink'> | null {
  if (!probe) return null;
  const def = PROBES[probe];
  return def ? { module: def.module, moduleLabel: def.moduleLabel, moduleLink: def.moduleLink } : null;
}

const SEVERITY: Record<Completeness, number> = { complete: 0, partial: 1, missing: 2 };

/**
 * Aggregate platform data quality by module across requirement/probe pairs.
 * Each distinct probe runs once (cached) even if several requirements share it;
 * a module's status is the worst seen across its requirements.
 */
export async function computeProbeHealth(
  supabase: SupabaseClient,
  organizationId: string,
  items: Array<{ code: string; probe: ProbeId | null | undefined }>,
): Promise<PlatformHealthEntry[]> {
  const cache = new Map<ProbeId, PlatformEvidenceResult | null>();
  const byModule = new Map<string, PlatformHealthEntry>();
  for (const { code, probe } of items) {
    if (!probe) continue;
    if (!cache.has(probe)) {
      cache.set(probe, await queryProbeEvidence(supabase, probe, organizationId));
    }
    const result = cache.get(probe);
    if (!result) continue;
    const existing = byModule.get(result.module);
    if (!existing) {
      byModule.set(result.module, {
        module: result.module,
        moduleLabel: result.moduleLabel,
        moduleLink: result.moduleLink,
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
