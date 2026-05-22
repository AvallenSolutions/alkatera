import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// Maps B Corp 2026 requirements to the alkatera modules that already hold
// relevant data. Only modules confirmed to exist in the schema are mapped;
// requirements with no backing module (e.g. health & safety, recruitment)
// are intentionally absent and fall back to manual evidence.

export type Completeness = 'complete' | 'partial' | 'missing';

export interface PlatformEvidenceItem {
  sourceRecordId: string;
  label: string;
  summary: string;
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

const MAPPINGS: Record<string, ModuleMapping> = {
  // Climate Action — GHG measurement
  'IT5-Y0-001': {
    module: 'emissions',
    moduleLabel: 'Emissions',
    moduleLink: '/data',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('ghg_emissions')
        .select('id, reporting_period, total_emissions, recorded_date')
        .eq('organization_id', orgId)
        .order('recorded_date', { ascending: false })
        .limit(5);
      const rows = data ?? [];
      const base = summariseCount(rows.length, 'emissions data');
      return {
        ...base,
        items: rows.map((r: any) => ({
          sourceRecordId: r.id,
          label: `Emissions ${r.reporting_period}`,
          summary: `${Number(r.total_emissions).toFixed(2)} kg CO2e recorded ${r.recorded_date}`,
        })),
      };
    },
  },
  // Climate Action — reduction targets / commitment
  'IT5-Y0-002': {
    module: 'targets',
    moduleLabel: 'Sustainability targets',
    moduleLink: '/pulse',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('sustainability_targets')
        .select('id, metric_key, target_value, target_date, scope, status')
        .eq('organization_id', orgId)
        .limit(5);
      const rows = (data ?? []).filter((r: any) =>
        /co2|carbon|emission|ghg|scope/i.test(
          `${r.metric_key} ${r.scope ?? ''}`,
        ),
      );
      const base = summariseCount(rows.length, 'emissions reduction targets');
      return {
        ...base,
        items: rows.map((r: any) => ({
          sourceRecordId: r.id,
          label: r.metric_key,
          summary: `Target ${r.target_value} by ${r.target_date} (${r.status})`,
        })),
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
  // Human Rights — forced & child labour / supply chain due diligence
  'IT4-Y0-002': {
    module: 'suppliers',
    moduleLabel: 'Suppliers',
    moduleLink: '/suppliers',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('suppliers')
        .select('id, name, country, industry_sector')
        .eq('organization_id', orgId)
        .limit(10);
      const rows = data ?? [];
      const base = summariseCount(rows.length, 'supplier records');
      return {
        ...base,
        items: rows.slice(0, 5).map((r: any) => ({
          sourceRecordId: r.id,
          label: r.name,
          summary: `${r.industry_sector ?? 'Unknown sector'} · ${r.country ?? 'Unknown country'}`,
        })),
      };
    },
  },
  // Human Rights — due diligence (Year 3)
  'IT4-Y3-001': {
    module: 'suppliers',
    moduleLabel: 'Suppliers',
    moduleLink: '/suppliers',
    async query(supabase, orgId) {
      const { data } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('organization_id', orgId)
        .limit(10);
      const rows = data ?? [];
      const base = summariseCount(rows.length, 'supplier records');
      return {
        ...base,
        items: rows.slice(0, 5).map((r: any) => ({
          sourceRecordId: r.id,
          label: r.name,
          summary: 'Supplier on record for due diligence',
        })),
      };
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
