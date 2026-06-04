import type { FieldKey, Pillar } from './field-definitions';

export type FieldScope = 'brand' | 'sku' | 'both';
export type FieldInputType = 'number' | 'percent' | 'text' | 'longtext' | 'boolean' | 'year' | 'select' | 'url';

export interface FieldLabel {
  key: FieldKey;
  label: string;
  helpText: string;
  inputType: FieldInputType;
  unit?: string;
  scope: FieldScope;
  pillar: Pillar;
  required: boolean;
  selectOptions?: Array<{ value: string; label: string }>;
  /**
   * When true, the edit modal shows an optional file picker so the brand
   * can attach a single piece of evidence (a certificate or report PDF)
   * alongside the verification. Used for boolean certifications and the
   * sustainability report URL — everywhere a single document either
   * proves or links to the answer. Numbers, years and text fields don't
   * map to a document so don't get this affordance.
   */
  acceptsEvidence?: boolean;
  /** Brand-facing label for the evidence drop zone, e.g. "Your B Corp certificate (PDF)". */
  evidenceLabel?: string;
  /** brand_document_submissions.document_type to record on the upload. */
  evidenceDocumentType?: 'certification' | 'sustainability_report';
}

/**
 * Plain-language labels for the public brand-upload review portal.
 *
 * The Excel-y labels in field-definitions.ts ("Carbon Intensity
 * (kgCO2e/L)") are right for the distributor data tab but wrong for
 * brand uploaders who aren't sustainability experts. Everything here is
 * read aloud first: "Carbon footprint per litre" before
 * "carbon_intensity_kgco2e_per_litre".
 *
 * `scope` tells the page whether a field is brand-wide (B Corp status,
 * HQ country), product-specific (carbon per litre, packaging material),
 * or sensibly both.
 *
 * `required` mirrors REQUIRED_FIELDS in completeness-calculator.ts so
 * the page can highlight gaps the distributor most cares about.
 */
export const FIELD_LABELS: FieldLabel[] = [
  // Carbon
  {
    key: 'carbon_intensity_kgco2e_per_litre',
    label: 'Carbon footprint per litre',
    helpText: 'Kilograms of CO2 equivalent emitted across the full lifecycle of one litre of finished product.',
    inputType: 'number',
    unit: 'kgCO2e / litre',
    scope: 'sku',
    pillar: 'carbon',
    required: true,
  },
  {
    key: 'scope_1_tco2e',
    label: 'Scope 1 emissions',
    helpText: 'Direct emissions from sources you own or control (fuel burnt on site, company vehicles).',
    inputType: 'number',
    unit: 'tonnes CO2e per year',
    scope: 'brand',
    pillar: 'carbon',
    required: true,
  },
  {
    key: 'scope_2_tco2e',
    label: 'Scope 2 emissions',
    helpText: 'Indirect emissions from electricity, steam, heating or cooling you buy in.',
    inputType: 'number',
    unit: 'tonnes CO2e per year',
    scope: 'brand',
    pillar: 'carbon',
    required: true,
  },
  {
    key: 'scope_3_tco2e',
    label: 'Scope 3 emissions',
    helpText: 'All other indirect emissions across your value chain: ingredients, packaging, distribution, end of life.',
    inputType: 'number',
    unit: 'tonnes CO2e per year',
    scope: 'brand',
    pillar: 'carbon',
    required: true,
  },
  {
    key: 'net_zero_target_year',
    label: 'Net zero target year',
    helpText: 'The year by which your brand has committed to reach net zero emissions, if a target is in place.',
    inputType: 'year',
    scope: 'brand',
    pillar: 'carbon',
    required: false,
  },
  {
    key: 'sbt_status',
    label: 'Science-Based Target status',
    helpText: 'Whether your emissions targets have been validated by the Science-Based Targets initiative (SBTi).',
    inputType: 'select',
    scope: 'brand',
    pillar: 'carbon',
    required: false,
    selectOptions: [
      { value: 'targets_set', label: 'Targets validated by SBTi' },
      { value: 'committed', label: 'Committed but not yet validated' },
      { value: 'none', label: 'No SBT commitment' },
    ],
  },
  {
    key: 'interim_reduction_percentage',
    label: 'Interim reduction target',
    helpText: 'A near-term emissions cut you have committed to, as a percentage. For example, enter 50 for a "50% reduction by 2030" pledge.',
    inputType: 'percent',
    unit: '%',
    scope: 'brand',
    pillar: 'carbon',
    required: false,
  },
  {
    key: 'interim_target_year',
    label: 'Interim target year',
    helpText: 'The year your interim reduction target is set against, e.g. 2030 for "50% by 2030".',
    inputType: 'year',
    scope: 'brand',
    pillar: 'carbon',
    required: false,
  },
  {
    key: 'target_baseline_year',
    label: 'Target baseline year',
    helpText: 'The reference year your reduction target is measured from, e.g. 2019. This shows the target is backed by a real plan.',
    inputType: 'year',
    scope: 'brand',
    pillar: 'carbon',
    required: false,
  },
  {
    key: 'sbti_validated',
    label: 'SBTi validated targets',
    helpText: 'Your emissions targets have been independently validated (not just committed) by the Science Based Targets initiative.',
    inputType: 'boolean',
    scope: 'brand',
    pillar: 'carbon',
    required: false,
    acceptsEvidence: true,
    evidenceLabel: 'Your SBTi validation letter (PDF)',
    evidenceDocumentType: 'certification',
  },
  {
    key: 'carbon_neutral_operations',
    label: 'Carbon neutral / net zero operations',
    helpText: 'You have already achieved carbon-neutral or net-zero operational emissions (usually Scope 1 and 2) — a current, verified status, not a future target.',
    inputType: 'boolean',
    scope: 'brand',
    pillar: 'carbon',
    required: false,
    acceptsEvidence: true,
    evidenceLabel: 'Your net-zero / carbon-neutral verification (PDF)',
    evidenceDocumentType: 'certification',
  },
  {
    key: 'carbon_trust_certified',
    label: 'Carbon Trust certified',
    helpText: 'Carbon Trust has independently verified your product or brand carbon footprint.',
    inputType: 'boolean',
    scope: 'brand',
    pillar: 'carbon',
    required: false,
    acceptsEvidence: true,
    evidenceLabel: 'Your Carbon Trust certificate (PDF)',
    evidenceDocumentType: 'certification',
  },

  // Water
  {
    key: 'water_usage_litres_per_litre',
    label: 'Water use per litre of product',
    helpText: 'Litres of water consumed in production for every litre of finished product.',
    inputType: 'number',
    unit: 'litres / litre',
    scope: 'sku',
    pillar: 'water',
    required: true,
  },
  {
    key: 'water_stress_region',
    label: 'Produced in a water-stressed region',
    helpText: 'Production sites are in regions classed as water-stressed (high or extremely high baseline water stress on the WRI Aqueduct map).',
    inputType: 'boolean',
    scope: 'brand',
    pillar: 'water',
    required: false,
  },

  // Packaging
  {
    key: 'recycled_packaging_percentage',
    label: 'Recycled content in packaging',
    helpText: 'Average share of the primary packaging weight made from recycled material.',
    inputType: 'percent',
    unit: '%',
    scope: 'sku',
    pillar: 'packaging',
    required: true,
  },
  {
    key: 'packaging_primary_material',
    label: 'Primary packaging material',
    helpText: 'The main material of the bottle, can or pouch holding the product.',
    inputType: 'select',
    scope: 'sku',
    pillar: 'packaging',
    required: true,
    selectOptions: [
      { value: 'glass', label: 'Glass' },
      { value: 'aluminium', label: 'Aluminium' },
      { value: 'pet', label: 'PET (plastic)' },
      { value: 'rpet', label: 'Recycled PET (rPET)' },
      { value: 'hdpe', label: 'HDPE (plastic)' },
      { value: 'paper', label: 'Paper or card' },
      { value: 'tetra_pak', label: 'Tetra Pak / carton' },
      { value: 'pouch', label: 'Flexible pouch' },
      { value: 'bag_in_box', label: 'Bag in box' },
      { value: 'other', label: 'Other' },
    ],
  },

  // Agriculture
  {
    key: 'organic_certified',
    label: 'Organic certified',
    helpText: 'Certified organic by a recognised body such as the Soil Association, USDA Organic, or Demeter.',
    inputType: 'boolean',
    scope: 'brand',
    pillar: 'agriculture',
    required: true,
    acceptsEvidence: true,
    evidenceLabel: 'Your organic certificate (PDF)',
    evidenceDocumentType: 'certification',
  },
  {
    key: 'organic_percentage',
    label: 'Share of organic ingredients',
    helpText: 'What share of your ingredients (by weight or by volume) is organic-certified.',
    inputType: 'percent',
    unit: '%',
    scope: 'brand',
    pillar: 'agriculture',
    required: false,
  },
  {
    key: 'fairtrade_certified',
    label: 'Fairtrade certified',
    helpText: 'Certified by Fairtrade International or a comparable fair-trade body.',
    inputType: 'boolean',
    scope: 'brand',
    pillar: 'agriculture',
    required: false,
    acceptsEvidence: true,
    evidenceLabel: 'Your Fairtrade certificate (PDF)',
    evidenceDocumentType: 'certification',
  },
  {
    key: 'rainforest_alliance_certified',
    label: 'Rainforest Alliance certified',
    helpText: 'Sources ingredients certified by Rainforest Alliance.',
    inputType: 'boolean',
    scope: 'brand',
    pillar: 'agriculture',
    required: false,
    acceptsEvidence: true,
    evidenceLabel: 'Your Rainforest Alliance certificate (PDF)',
    evidenceDocumentType: 'certification',
  },

  // Governance
  {
    key: 'bcorp_certified',
    label: 'B Corp certified',
    helpText: 'Your brand has passed the B Lab assessment and is a Certified B Corporation.',
    inputType: 'boolean',
    scope: 'brand',
    pillar: 'governance',
    required: false,
    acceptsEvidence: true,
    evidenceLabel: 'Your B Corp certificate (PDF)',
    evidenceDocumentType: 'certification',
  },
  {
    key: 'iso_14001_certified',
    label: 'ISO 14001 certified',
    helpText: 'You have an Environmental Management System certified to ISO 14001.',
    inputType: 'boolean',
    scope: 'brand',
    pillar: 'governance',
    required: false,
    acceptsEvidence: true,
    evidenceLabel: 'Your ISO 14001 certificate (PDF)',
    evidenceDocumentType: 'certification',
  },
  {
    key: 'iso_50001_certified',
    label: 'ISO 50001 certified',
    helpText: 'You have an Energy Management System certified to ISO 50001.',
    inputType: 'boolean',
    scope: 'brand',
    pillar: 'governance',
    required: false,
    acceptsEvidence: true,
    evidenceLabel: 'Your ISO 50001 certificate (PDF)',
    evidenceDocumentType: 'certification',
  },
  {
    key: 'sustainability_report_url',
    label: 'Sustainability report link',
    helpText: 'A direct link to your latest sustainability or impact report on your website.',
    inputType: 'url',
    scope: 'brand',
    pillar: 'governance',
    required: true,
  },
  {
    key: 'sustainability_report_year',
    label: 'Year of latest sustainability report',
    helpText: 'The reporting year your most recent published sustainability report covers.',
    inputType: 'year',
    scope: 'brand',
    pillar: 'governance',
    required: false,
  },

  // Corporate
  {
    key: 'parent_company',
    label: 'Parent company',
    helpText: 'The owning group, if your brand is part of a larger company. Leave blank for independent brands.',
    inputType: 'text',
    scope: 'brand',
    pillar: 'corporate',
    required: false,
  },
  {
    key: 'hq_country',
    label: 'Head office country',
    helpText: 'Where your business is headquartered.',
    inputType: 'text',
    scope: 'brand',
    pillar: 'corporate',
    required: false,
  },
  {
    key: 'founding_year',
    label: 'Year founded',
    helpText: 'The year the brand was founded.',
    inputType: 'year',
    scope: 'brand',
    pillar: 'corporate',
    required: false,
  },
  {
    key: 'company_registration_number',
    label: 'Company registration number',
    helpText: 'Companies House number in the UK, or the equivalent in your country.',
    inputType: 'text',
    scope: 'brand',
    pillar: 'corporate',
    required: false,
  },
  {
    key: 'contact_email',
    label: 'Sustainability contact email',
    helpText: 'A public address we can use to follow up on sustainability questions.',
    inputType: 'text',
    scope: 'brand',
    pillar: 'corporate',
    required: false,
  },
  {
    key: 'company_description',
    label: 'Brand description',
    helpText: 'A short paragraph or two about your brand, ideally including your sustainability story.',
    inputType: 'longtext',
    scope: 'brand',
    pillar: 'corporate',
    required: false,
  },
];

const LABEL_BY_KEY = new Map<FieldKey, FieldLabel>(
  FIELD_LABELS.map((f) => [f.key, f]),
);

export function getFieldLabel(key: FieldKey): FieldLabel | undefined {
  return LABEL_BY_KEY.get(key);
}

/**
 * Per-pillar accent + iconography. Matches the alka**tera** main app's
 * convention of colour-coding the impact pillars (climate emerald,
 * water sky, circularity amber, nature teal). Governance and corporate
 * fall outside the pillar wheel so use neutral accents.
 *
 * `icon` is the lucide-react icon name — the component imports it by
 * name to avoid coupling this lib file to React.
 */
export interface PillarMeta {
  label: string;
  description: string;
  icon: 'Leaf' | 'Droplets' | 'Package' | 'Sprout' | 'ShieldCheck' | 'Building2';
  /** Tailwind colour stem used for chips, badges, ring tints. */
  accent: 'emerald' | 'cyan' | 'amber' | 'teal' | 'indigo' | 'slate';
}

export const PILLAR_LABELS: Record<Pillar, PillarMeta> = {
  carbon: {
    label: 'Carbon',
    description: 'Greenhouse-gas emissions across your operations and value chain.',
    icon: 'Leaf',
    accent: 'emerald',
  },
  water: {
    label: 'Water',
    description: 'How much water it takes to make your product, and where.',
    icon: 'Droplets',
    accent: 'cyan',
  },
  packaging: {
    label: 'Packaging',
    description: 'What your packaging is made of and how much of it is recycled.',
    icon: 'Package',
    accent: 'amber',
  },
  agriculture: {
    label: 'Agriculture',
    description: 'How your ingredients are grown, including organic and fair-trade certifications.',
    icon: 'Sprout',
    accent: 'teal',
  },
  governance: {
    label: 'Governance and reporting',
    description: 'Certifications, management systems and how openly you report your impact.',
    icon: 'ShieldCheck',
    accent: 'indigo',
  },
  corporate: {
    label: 'Company information',
    description: 'Background facts about your business that help our distributor partners get to know you.',
    icon: 'Building2',
    accent: 'slate',
  },
};

export const PILLAR_ORDER: Pillar[] = [
  'carbon',
  'water',
  'packaging',
  'agriculture',
  'governance',
  'corporate',
];
