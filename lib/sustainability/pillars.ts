// Canonical six-pillar sustainability model, SHARED by the distributor and
// procurement portals so both present the same data under the same taxonomy.
//
// These six pillars mirror the alka**tera** vitality / ESG composite
// (Environmental = climate + water + circularity + nature; Social; Governance),
// which is the platform's real scoring structure. This module is presentation
// only: it does NOT change the completeness-scoring pillars used internally by
// lib/distributor/scoring (carbon/water/packaging/agriculture/governance/corporate),
// which feed brand_completeness_snapshots. It maps every field_key to one ESG
// pillar and gives it a human label + value formatter.

export type PillarKey = 'climate' | 'water' | 'circularity' | 'nature' | 'social' | 'governance'

export interface PillarDef {
  key: PillarKey
  label: string
  blurb: string
}

export const PILLARS: PillarDef[] = [
  { key: 'climate', label: 'Climate', blurb: 'Emissions, LCA and decarbonisation' },
  { key: 'water', label: 'Water', blurb: 'Water use, recycling and scarcity' },
  { key: 'circularity', label: 'Circularity', blurb: 'Packaging, recyclability and end of life' },
  { key: 'nature', label: 'Nature', blurb: 'LCA land and ecosystem impacts, nature action' },
  { key: 'social', label: 'Social', blurb: 'People, communities and suppliers' },
  { key: 'governance', label: 'Governance', blurb: 'Certifications, oversight and transparency' },
]

export type Fmt =
  | 'bool' | 'pct' | 'year' | 'text' | 'longtext' | 'number' | 'score'
  | 'kgco2e_l' | 'tco2e' | 'l_per_l' | 'm3e_l' | 'm2a_l' | 'peq_l' | 'so2_l'
  | 'ha' | 'hours' | 'gbp'

export interface FieldMeta {
  pillar: PillarKey
  label: string
  fmt: Fmt
}

// Single source of truth for field -> pillar + label + format, covering BOTH the
// public scraping vocabulary (lib/distributor/scraping/field-definitions) and the
// richer platform metrics a registered alka**tera** brand syncs.
export const FIELD_REGISTRY: Record<string, FieldMeta> = {
  // --- Climate: GHG + LCA climate output + targets ---
  carbon_intensity_kgco2e_per_litre: { pillar: 'climate', label: 'Carbon intensity (LCA)', fmt: 'kgco2e_l' },
  scope_1_tco2e: { pillar: 'climate', label: 'Scope 1 emissions', fmt: 'tco2e' },
  scope_2_tco2e: { pillar: 'climate', label: 'Scope 2 emissions', fmt: 'tco2e' },
  scope_3_tco2e: { pillar: 'climate', label: 'Scope 3 emissions', fmt: 'tco2e' },
  net_zero_target_year: { pillar: 'climate', label: 'Net zero target', fmt: 'year' },
  sbt_status: { pillar: 'climate', label: 'Science-based target', fmt: 'text' },
  lca_verified: { pillar: 'climate', label: 'Product LCA verified', fmt: 'bool' },
  renewable_energy_percentage: { pillar: 'climate', label: 'Renewable energy', fmt: 'pct' },
  carbon_trust_certified: { pillar: 'climate', label: 'Carbon Trust certified', fmt: 'bool' },
  iwca_member: { pillar: 'climate', label: 'IWCA member', fmt: 'bool' },
  porto_protocol_signatory: { pillar: 'climate', label: 'Porto Protocol signatory', fmt: 'bool' },
  epd_published: { pillar: 'climate', label: 'EPD published', fmt: 'bool' },
  carbon_negative_claim: { pillar: 'climate', label: 'Carbon negative (claim)', fmt: 'bool' },

  // --- Water: facility + LCA water output ---
  water_usage_litres_per_litre: { pillar: 'water', label: 'Water use', fmt: 'l_per_l' },
  water_recycled_percentage: { pillar: 'water', label: 'Water recycled', fmt: 'pct' },
  water_scarcity_m3eq_per_litre: { pillar: 'water', label: 'Water scarcity (AWARE)', fmt: 'm3e_l' },
  water_stress_region: { pillar: 'water', label: 'In water-stressed region', fmt: 'bool' },

  // --- Circularity: packaging circularity profile ---
  recycled_packaging_percentage: { pillar: 'circularity', label: 'Recycled packaging content', fmt: 'pct' },
  packaging_primary_material: { pillar: 'circularity', label: 'Primary material', fmt: 'text' },
  packaging_recyclability_score: { pillar: 'circularity', label: 'Recyclability score', fmt: 'score' },
  packaging_end_of_life: { pillar: 'circularity', label: 'End-of-life pathway', fmt: 'text' },

  // --- Nature: LCA ecosystem impacts + nature actions + TNFD + farming ---
  land_use_m2a_per_litre: { pillar: 'nature', label: 'Land use (LCA)', fmt: 'm2a_l' },
  freshwater_eutrophication_per_litre: { pillar: 'nature', label: 'Freshwater eutrophication (LCA)', fmt: 'peq_l' },
  terrestrial_acidification_per_litre: { pillar: 'nature', label: 'Terrestrial acidification (LCA)', fmt: 'so2_l' },
  nature_positive_hectares: { pillar: 'nature', label: 'Nature-positive land', fmt: 'ha' },
  nature_action_type: { pillar: 'nature', label: 'Nature action', fmt: 'text' },
  tnfd_dependencies_assessed: { pillar: 'nature', label: 'TNFD dependencies assessed', fmt: 'bool' },
  organic_certified: { pillar: 'nature', label: 'Organic certified', fmt: 'bool' },
  organic_percentage: { pillar: 'nature', label: 'Organic sourcing', fmt: 'pct' },
  rainforest_alliance_certified: { pillar: 'nature', label: 'Rainforest Alliance', fmt: 'bool' },

  // --- Social: people_culture + community + supplier ---
  living_wage_compliance_percentage: { pillar: 'social', label: 'Living-wage compliance', fmt: 'pct' },
  gender_pay_gap_median_percentage: { pillar: 'social', label: 'Median gender pay gap', fmt: 'pct' },
  employee_wellbeing_score: { pillar: 'social', label: 'Employee wellbeing score', fmt: 'score' },
  community_investment_gbp: { pillar: 'social', label: 'Community investment', fmt: 'gbp' },
  supplier_esg_coverage_percentage: { pillar: 'social', label: 'Supplier ESG coverage', fmt: 'pct' },
  fairtrade_certified: { pillar: 'social', label: 'Fairtrade certified', fmt: 'bool' },

  // --- Governance: governance_scores + certifications + company metadata ---
  bcorp_certified: { pillar: 'governance', label: 'B Corp certified', fmt: 'bool' },
  iso_14001_certified: { pillar: 'governance', label: 'ISO 14001', fmt: 'bool' },
  iso_50001_certified: { pillar: 'governance', label: 'ISO 50001', fmt: 'bool' },
  governance_transparency_score: { pillar: 'governance', label: 'Transparency score', fmt: 'score' },
  governance_board_score: { pillar: 'governance', label: 'Board oversight score', fmt: 'score' },
  governance_policy_score: { pillar: 'governance', label: 'Policy score', fmt: 'score' },
  sustainability_report_year: { pillar: 'governance', label: 'Latest report', fmt: 'year' },
  sustainability_report_url: { pillar: 'governance', label: 'Report link', fmt: 'text' },
  parent_company: { pillar: 'governance', label: 'Parent company', fmt: 'text' },
  hq_country: { pillar: 'governance', label: 'HQ country', fmt: 'text' },
  founding_year: { pillar: 'governance', label: 'Founding year', fmt: 'year' },
  company_registration_number: { pillar: 'governance', label: 'Company registration', fmt: 'text' },
  contact_email: { pillar: 'governance', label: 'Contact email', fmt: 'text' },
  company_description: { pillar: 'governance', label: 'Company description', fmt: 'longtext' },
}

export function pillarForField(field_key: string): PillarKey {
  return FIELD_REGISTRY[field_key]?.pillar ?? 'governance'
}

export function fieldLabel(field_key: string): string {
  return FIELD_REGISTRY[field_key]?.label ?? field_key.replace(/_/g, ' ')
}

export function formatFieldValue(field_key: string, value: string | null): string {
  if (value == null || value === '') return '—'
  const fmt = FIELD_REGISTRY[field_key]?.fmt ?? 'text'
  const n = Number(value)
  const num = Number.isFinite(n)
  switch (fmt) {
    case 'bool':
      return value === 'true' ? 'Yes' : value === 'false' ? 'No' : value
    case 'pct':
      return num ? `${n}%` : value
    case 'score':
      return num ? `${n} / 100` : value
    case 'year':
      return value
    case 'kgco2e_l':
      return num ? `${n} kgCO2e/L` : value
    case 'tco2e':
      return num ? `${n.toLocaleString('en-GB')} tCO2e` : value
    case 'l_per_l':
      return num ? `${n} L/L` : value
    case 'm3e_l':
      return num ? `${n} m³e/L` : value
    case 'm2a_l':
      return num ? `${n} m²a/L` : value
    case 'peq_l':
      return num ? `${n} g P-eq/L` : value
    case 'so2_l':
      return num ? `${n} g SO2-eq/L` : value
    case 'ha':
      return num ? `${n.toLocaleString('en-GB')} ha` : value
    case 'hours':
      return num ? `${n} hrs` : value
    case 'gbp':
      return num ? `£${n.toLocaleString('en-GB')}` : value
    case 'number':
      return num ? n.toLocaleString('en-GB') : value
    case 'longtext':
      return value.length > 140 ? `${value.slice(0, 140).trim()}…` : value
    default:
      return value
  }
}

export interface PillarFinding {
  field_key: string
  field_value: string | null
  source_name: string | null
  label: string
  display: string
}

export interface PillarGroup {
  def: PillarDef
  findings: PillarFinding[]
}

/**
 * Group present findings into the six pillars, in canonical order. Used by the
 * procurement brand-detail "present findings" view.
 */
export function groupByPillar(
  findings: Array<{ field_key: string; field_value: string | null; source_name: string | null }>,
): PillarGroup[] {
  const byPillar = new Map<PillarKey, PillarFinding[]>()
  for (const p of PILLARS) byPillar.set(p.key, [])
  for (const f of findings) {
    byPillar.get(pillarForField(f.field_key))!.push({
      field_key: f.field_key,
      field_value: f.field_value,
      source_name: f.source_name,
      label: fieldLabel(f.field_key),
      display: formatFieldValue(f.field_key, f.field_value),
    })
  }
  return PILLARS.map((def) => ({ def, findings: byPillar.get(def.key)! })).filter((g) => g.findings.length > 0)
}
