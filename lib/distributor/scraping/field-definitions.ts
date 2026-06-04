export type FieldKey =
  | 'bcorp_certified'
  | 'carbon_trust_certified'
  | 'iso_14001_certified'
  | 'iso_50001_certified'
  | 'fairtrade_certified'
  | 'rainforest_alliance_certified'
  | 'organic_certified'
  | 'organic_percentage'
  | 'carbon_intensity_kgco2e_per_litre'
  | 'scope_1_tco2e'
  | 'scope_2_tco2e'
  | 'scope_3_tco2e'
  | 'net_zero_target_year'
  | 'sbt_status'
  | 'water_usage_litres_per_litre'
  | 'water_stress_region'
  | 'water_recycled_percentage'
  | 'recycled_packaging_percentage'
  | 'packaging_primary_material'
  | 'sustainability_report_url'
  | 'sustainability_report_year'
  | 'parent_company'
  | 'hq_country'
  | 'founding_year'
  | 'company_registration_number'
  | 'contact_email'
  | 'company_description'
  | 'iwca_member'
  | 'porto_protocol_signatory'
  // Leadership signals — process-level indicators that capture the
  // *act* of doing sustainability work, not just the numbers. These
  // are critical for scraped brands because most don't publish raw
  // Scope 1/2/3 figures publicly even when they're carbon-negative
  // operating with renewable energy and shipping EPDs.
  | 'epd_published'
  | 'carbon_negative_claim'
  | 'renewable_energy_percentage'
  | 'cdr_partnership'
  // Enriched reduction-target fields — capture an interim target on top
  // of the headline net-zero year so the scorer can grade a target on
  // *ambition* (how fast) AND *credibility* (is it SBTi-validated, is
  // there a real baseline) rather than a single far-off year. Mirrors
  // the shape of the main platform's transition_plans.
  | 'interim_reduction_percentage'
  | 'interim_target_year'
  | 'target_baseline_year'
  | 'sbti_validated';

export type FieldType = 'boolean' | 'number' | 'year' | 'string' | 'longtext';
export type Pillar = 'carbon' | 'water' | 'packaging' | 'agriculture' | 'governance' | 'corporate';

export interface FieldDefinition {
  key: FieldKey;
  label: string;
  type: FieldType;
  pillar: Pillar;
  description?: string;
}

export const FIELD_DEFINITIONS: FieldDefinition[] = [
  { key: 'bcorp_certified',                label: 'B Corp Certified',                  type: 'boolean', pillar: 'governance',
    description: 'B Lab dropped numeric scores from the certification process; we only track certified yes/no.' },
  { key: 'carbon_trust_certified',         label: 'Carbon Trust Certified',            type: 'boolean', pillar: 'carbon' },
  { key: 'iso_14001_certified',            label: 'ISO 14001',                         type: 'boolean', pillar: 'governance' },
  { key: 'iso_50001_certified',            label: 'ISO 50001',                         type: 'boolean', pillar: 'governance' },
  { key: 'fairtrade_certified',            label: 'Fairtrade Certified',               type: 'boolean', pillar: 'agriculture' },
  { key: 'rainforest_alliance_certified',  label: 'Rainforest Alliance',               type: 'boolean', pillar: 'agriculture' },
  { key: 'organic_certified',              label: 'Organic Certified',                 type: 'boolean', pillar: 'agriculture' },
  { key: 'organic_percentage',             label: 'Organic %',                         type: 'number',  pillar: 'agriculture' },
  { key: 'carbon_intensity_kgco2e_per_litre', label: 'Carbon Intensity (kgCO2e/L)',    type: 'number',  pillar: 'carbon' },
  { key: 'scope_1_tco2e',                  label: 'Scope 1 (tCO2e)',                   type: 'number',  pillar: 'carbon' },
  { key: 'scope_2_tco2e',                  label: 'Scope 2 (tCO2e)',                   type: 'number',  pillar: 'carbon' },
  { key: 'scope_3_tco2e',                  label: 'Scope 3 (tCO2e)',                   type: 'number',  pillar: 'carbon' },
  { key: 'net_zero_target_year',           label: 'Net Zero Target Year',              type: 'year',    pillar: 'carbon' },
  { key: 'sbt_status',                     label: 'Science-Based Target Status',       type: 'string',  pillar: 'carbon',
    description: "One of 'committed', 'targets_set', or 'none'." },
  { key: 'water_usage_litres_per_litre',   label: 'Water Usage (L/L)',                 type: 'number',  pillar: 'water' },
  { key: 'water_stress_region',            label: 'In Water-Stressed Region',          type: 'boolean', pillar: 'water' },
  { key: 'water_recycled_percentage',      label: 'Water Recycled %',                  type: 'number',  pillar: 'water' },
  { key: 'recycled_packaging_percentage',  label: 'Recycled Packaging %',              type: 'number',  pillar: 'packaging' },
  { key: 'packaging_primary_material',     label: 'Primary Packaging Material',        type: 'string',  pillar: 'packaging' },
  { key: 'sustainability_report_url',      label: 'Sustainability Report URL',         type: 'string',  pillar: 'governance' },
  { key: 'sustainability_report_year',     label: 'Sustainability Report Year',        type: 'year',    pillar: 'governance' },
  { key: 'parent_company',                 label: 'Parent Company',                    type: 'string',  pillar: 'corporate' },
  { key: 'hq_country',                     label: 'HQ Country',                        type: 'string',  pillar: 'corporate' },
  { key: 'founding_year',                  label: 'Founding Year',                     type: 'year',    pillar: 'corporate' },
  { key: 'company_registration_number',    label: 'Company Registration Number',       type: 'string',  pillar: 'corporate' },
  { key: 'contact_email',                  label: 'Contact Email',                     type: 'string',  pillar: 'corporate',
    description: 'A public sustainability / press / general contact email on the brand website. Used to seed outreach.' },
  { key: 'company_description',            label: 'Company Description',               type: 'longtext', pillar: 'corporate',
    description: "AI-generated 2-3 paragraph overview of the brand with a focus on its sustainability story. Regenerated each scrape." },
  { key: 'iwca_member',                    label: 'IWCA Member',                       type: 'boolean', pillar: 'carbon',
    description: "International Wineries for Climate Action signatory. Wine producers only." },
  { key: 'porto_protocol_signatory',       label: 'Porto Protocol Signatory',          type: 'boolean', pillar: 'carbon',
    description: "Porto Protocol signatory for climate action in wine. Wine producers only." },
  { key: 'epd_published',                  label: 'EPD Published',                     type: 'boolean', pillar: 'carbon',
    description: "Brand has published at least one Environmental Product Declaration (third-party verified product LCA). A strong leadership signal: very few drinks brands have done this." },
  { key: 'carbon_negative_claim',          label: 'Carbon Negative',                   type: 'boolean', pillar: 'carbon',
    description: "Brand publicly claims carbon-negative operations (removes more CO2 than it emits) and the claim is supported by published evidence (sustainability page, EPD, third-party verification)." },
  { key: 'renewable_energy_percentage',    label: 'Renewable Energy %',                type: 'number',  pillar: 'carbon',
    description: "Percentage of energy from renewable sources. 100 = fully renewable." },
  { key: 'cdr_partnership',                label: 'CDR Partnership',                   type: 'boolean', pillar: 'carbon',
    description: "Active partnership with a permanent carbon-removal provider (Climeworks, Carbfix, Heirloom, Charm, etc.) — direct-air-capture or mineralisation, not offsetting." },
  { key: 'interim_reduction_percentage',   label: 'Interim Reduction Target (%)',      type: 'number',  pillar: 'carbon',
    description: "Published interim emissions-reduction target as a percentage, e.g. 50 for a '50% reduction by 2030' pledge. The headline number of a near-term decarbonisation target, not the net-zero end date." },
  { key: 'interim_target_year',            label: 'Interim Target Year',               type: 'year',    pillar: 'carbon',
    description: "The year the interim reduction target is set against, e.g. 2030 for '50% by 2030'." },
  { key: 'target_baseline_year',           label: 'Target Baseline Year',              type: 'year',    pillar: 'carbon',
    description: "The baseline year the reduction target is measured from, e.g. 2019. Evidence of a real, accountable plan rather than a bare claim." },
  { key: 'sbti_validated',                 label: 'SBTi Validated',                    type: 'boolean', pillar: 'carbon',
    description: "The brand's emissions targets have been independently validated (not just committed) by the Science Based Targets initiative. The strongest credibility signal a reduction target can carry." },
];

const FIELD_BY_KEY = new Map<FieldKey, FieldDefinition>(FIELD_DEFINITIONS.map((f) => [f.key, f]));

export function getFieldDefinition(key: FieldKey): FieldDefinition | undefined {
  return FIELD_BY_KEY.get(key);
}

/**
 * Coerce a raw extracted value into the typed shape we store. Returns
 * `{ text, numeric }` because we persist text in `field_value` and a
 * numeric copy in `field_value_numeric` for numeric/year/boolean fields
 * so we can sort + aggregate without parsing every row.
 */
export function coerceFieldValue(
  key: FieldKey,
  raw: unknown,
): { text: string; numeric: number | null } | null {
  const def = FIELD_BY_KEY.get(key);
  if (!def) return null;
  if (raw === null || raw === undefined || raw === '') return null;

  switch (def.type) {
    case 'boolean': {
      if (typeof raw === 'boolean') return { text: String(raw), numeric: raw ? 1 : 0 };
      const s = String(raw).trim().toLowerCase();
      if (['true', 'yes', 'certified', '1'].includes(s)) return { text: 'true', numeric: 1 };
      if (['false', 'no', 'not certified', '0'].includes(s)) return { text: 'false', numeric: 0 };
      return null;
    }
    case 'number': {
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[,%]/g, ''));
      if (!Number.isFinite(n)) return null;
      return { text: String(n), numeric: n };
    }
    case 'year': {
      const n = typeof raw === 'number' ? raw : parseInt(String(raw).replace(/\D/g, ''), 10);
      if (!Number.isFinite(n) || n < 1700 || n > 2200) return null;
      return { text: String(n), numeric: n };
    }
    case 'string': {
      const s = String(raw).trim();
      if (!s) return null;
      return { text: s.slice(0, 500), numeric: null };
    }
    case 'longtext': {
      // Multi-paragraph fields like company_description. Cap generously
      // (LLM is asked for 2–3 paragraphs, ~600 words ≈ 4000 chars) so
      // we trim runaway model outputs without truncating normal ones.
      const s = String(raw).trim();
      if (!s) return null;
      return { text: s.slice(0, 4000), numeric: null };
    }
  }
}
