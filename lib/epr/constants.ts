/**
 * EPR Compliance Tool — Constants
 *
 * Reference data: RPD column headers, material display names, fee year
 * definitions, reporting deadlines, and UK postcode-to-nation mappings.
 */

import type {
  RPDMaterialCode, RPDPackagingActivity, RPDPackagingType, RPDNation,
  HMRCOrganisationType, HMRCAddressType, HMRCContactType, HMRCBrandTypeCode,
} from './types';

// =============================================================================
// RPD CSV Headers (exact 15-column format per Defra file specification)
// =============================================================================

export const RPD_CSV_HEADERS = [
  'Organisation ID',
  'Subsidiary ID',
  'Organisation Size',
  'Submission Period',
  'Packaging Activity',
  'Packaging Type',
  'Packaging Class',
  'Packaging Material',
  'Material Subtype',
  'From Nation',
  'To Nation',
  'Material Weight (kg)',
  'Material Units',
  'Transitional Weight',
  'Recyclability Rating',
] as const;

// =============================================================================
// Material Display Names
// =============================================================================

export const RPD_MATERIAL_NAMES: Record<RPDMaterialCode, string> = {
  AL: 'Aluminium',
  FC: 'Fibre-based Composite',
  GL: 'Glass',
  PC: 'Paper/Card',
  PL: 'Plastic',
  ST: 'Steel',
  WD: 'Wood',
  OT: 'Other',
};

export const RPD_ACTIVITY_NAMES: Record<RPDPackagingActivity, string> = {
  SO: 'Sold (Brand Owner)',
  PF: 'Packed/Filled',
  IM: 'Imported',
  SE: 'Sold to Small Producers (Empty Packaging)',
  HL: 'Hired/Loaned',
  OM: 'Online marketplace operator',
};

export const RPD_PACKAGING_TYPE_NAMES: Record<RPDPackagingType, string> = {
  HH: 'Household',
  NH: 'Non-household',
  CW: 'Consumer waste (self-managed)',
  OW: 'Organisation waste (self-managed)',
  PB: 'Public bin',
  RU: 'Reusable',
  HDC: 'Household drinks container',
  NDC: 'Non-household drinks container',
  SP: 'Street/public packaging',
};

export const RPD_NATION_NAMES: Record<RPDNation, string> = {
  EN: 'England',
  SC: 'Scotland',
  WS: 'Wales',
  NI: 'Northern Ireland',
};

// =============================================================================
// Fee Year Definitions
// =============================================================================

export interface FeeYearDefinition {
  id: string;            // '2025-26'
  label: string;         // '2025/26 (Year 1)'
  start: string;         // '2025-04-01'
  end: string;           // '2026-03-31'
  is_modulated: boolean;
}

export const FEE_YEARS: FeeYearDefinition[] = [
  { id: '2025-26', label: '2025/26 (Year 1 — Flat)', start: '2025-04-01', end: '2026-03-31', is_modulated: false },
  { id: '2026-27', label: '2026/27 (Year 2 — Modulated)', start: '2026-04-01', end: '2027-03-31', is_modulated: true },
];

// =============================================================================
// Reporting Deadlines
// =============================================================================

export interface ReportingDeadline {
  period: string;
  description: string;
  due_date: string;
  who: 'large' | 'small' | 'both';
}

export const REPORTING_DEADLINES: ReportingDeadline[] = [
  // 2025 deadlines
  { period: '2025-H1', description: 'H1 2025 (Jan-Jun) data submission', due_date: '2025-10-01', who: 'large' },
  { period: '2025-H2', description: 'H2 2025 (Jul-Dec) data submission', due_date: '2026-04-01', who: 'large' },
  { period: '2025-P0', description: 'Full year 2025 data submission', due_date: '2026-04-01', who: 'small' },
  // 2026 deadlines
  { period: '2026-H1', description: 'H1 2026 (Jan-Jun) data submission', due_date: '2026-10-01', who: 'large' },
  { period: '2026-H2', description: 'H2 2026 (Jul-Dec) data submission', due_date: '2027-04-01', who: 'large' },
  { period: '2026-P0', description: 'Full year 2026 data submission + Nation of Sale', due_date: '2027-04-01', who: 'small' },
];

// =============================================================================
// Obligation Thresholds
// =============================================================================

export const OBLIGATION_THRESHOLDS = {
  large: {
    turnover_gbp: 2_000_000,
    tonnage: 50,
  },
  small: {
    turnover_gbp: 1_000_000,
    tonnage: 25,
  },
} as const;

// =============================================================================
// DRS Configuration
// =============================================================================

/** Materials that will enter the Deposit Return Scheme (Oct 2027) */
export const DRS_MATERIALS = ['aluminium', 'plastic_rigid', 'steel'] as const;

/** DRS container size range (ml) */
export const DRS_MIN_SIZE_ML = 150;
export const DRS_MAX_SIZE_ML = 3000;

// =============================================================================
// UK Postcode-to-Nation Mapping (for auto-estimation)
// =============================================================================

/** Postcode prefixes for Northern Ireland */
export const NI_POSTCODE_PREFIXES = ['BT'];

/** Postcode prefixes for Scotland */
export const SCOTLAND_POSTCODE_PREFIXES = [
  'AB', 'DD', 'DG', 'EH', 'FK', 'G', 'HS', 'IV', 'KA', 'KW', 'KY',
  'ML', 'PA', 'PH', 'TD', 'ZE',
];

/** Postcode prefixes for Wales (SY handled at district level below) */
export const WALES_POSTCODE_PREFIXES = [
  'CF', 'LD', 'LL', 'NP', 'SA',
];

/**
 * SY postcode districts in Wales (Powys). SY15-SY25 are Wales; all other SY
 * districts (SY1-SY14, SY26+) are in England (Shropshire).
 */
export const SY_WALES_DISTRICTS = [
  'SY15', 'SY16', 'SY17', 'SY18', 'SY19', 'SY20',
  'SY21', 'SY22', 'SY23', 'SY24', 'SY25',
];

/** ONS population-weighted fallback percentages (Census 2021) */
export const ONS_POPULATION_WEIGHTS = {
  england: 84.3,
  scotland: 8.2,
  wales: 4.7,
  ni: 2.8,
} as const;

// =============================================================================
// RAM Eco-Modulation Multipliers
// =============================================================================

export const RAM_MODULATION = {
  '2026-27': { red: 1.2, amber: 1.0, green: 0.91 },
  '2027-28': { red: 1.6, amber: 1.0, green: null },  // TBC
  '2028-29': { red: 2.0, amber: 1.0, green: null },  // TBC
} as const;

// =============================================================================
// HMRC Registration Template Constants
// =============================================================================

/** Organisation type display names (Companies House entity types) */
export const HMRC_ORG_TYPE_NAMES: Record<HMRCOrganisationType, string> = {
  SOL: 'Sole Trader',
  PAR: 'Partnership',
  REG: 'Registered Society',
  PLC: 'Public Limited Company (PLC)',
  LLP: 'Limited Liability Partnership (LLP)',
  LTD: 'Private Limited Company (Ltd)',
  CIO: 'Charitable Incorporated Organisation',
  OTH: 'Other',
};

/** Address type display names */
export const HMRC_ADDRESS_TYPE_NAMES: Record<HMRCAddressType, string> = {
  registered: 'Registered Address',
  audit: 'Audit Address',
  service_of_notice: 'Service of Notice Address',
  principal: 'Principal Address',
};

/** Contact type display names and descriptions */
export const HMRC_CONTACT_TYPE_NAMES: Record<HMRCContactType, string> = {
  approved_person: 'Approved Person',
  delegated_person: 'Delegated Person',
  primary_contact: 'Primary Contact',
  secondary_contact: 'Secondary Contact',
};

export const HMRC_CONTACT_TYPE_DESCRIPTIONS: Record<HMRCContactType, string> = {
  approved_person: 'The person authorised to make legally binding decisions for the organisation regarding EPR.',
  delegated_person: 'The person responsible for day-to-day EPR compliance activities. Optional.',
  primary_contact: 'The main point of contact for correspondence about EPR.',
  secondary_contact: 'A backup contact for EPR matters. Optional.',
};

/** Brand type code display names */
export const HMRC_BRAND_TYPE_NAMES: Record<HMRCBrandTypeCode, string> = {
  BN: 'Brand Name',
  TM: 'Trademark',
  OT: 'Other',
};

/** Packaging activity labels for the 7 HMRC activity flags */
export const HMRC_PACKAGING_ACTIVITY_LABELS = {
  so: { code: 'SO', label: 'Sold (Brand Owner)', description: 'You supply packaging under your own brand.' },
  pf: { code: 'PF', label: 'Packed/Filled', description: 'You pack or fill unbranded packaging.' },
  im: { code: 'IM', label: 'Imported', description: 'You import packaging or packaged goods into the UK.' },
  se: { code: 'SE', label: 'Sold to Small Producers', description: 'You sell empty packaging to small businesses (under 25 tonnes).' },
  hl: { code: 'HL', label: 'Hired/Loaned', description: 'You hire or loan reusable packaging.' },
  om: { code: 'OM', label: 'Online Marketplace', description: 'You operate an online marketplace where third parties sell packaged goods.' },
  sl: { code: 'SL', label: 'Sold to Consumers', description: 'You sell packaging directly to end consumers (e.g. via your own online shop).' },
} as const;

/**
 * Common SIC codes for the drinks industry.
 * Helps users pick the right code during wizard setup.
 */
export const DRINKS_INDUSTRY_SIC_CODES = [
  { code: '11.01', label: '11.01 - Distilling, rectifying and blending of spirits' },
  { code: '11.02', label: '11.02 - Manufacture of wine from grape' },
  { code: '11.03', label: '11.03 - Manufacture of cider and other fruit wines' },
  { code: '11.04', label: '11.04 - Manufacture of other non-distilled fermented beverages' },
  { code: '11.05', label: '11.05 - Manufacture of beer' },
  { code: '11.06', label: '11.06 - Manufacture of malt' },
  { code: '11.07', label: '11.07 - Manufacture of soft drinks; production of mineral waters and other bottled waters' },
  { code: '46.34', label: '46.34 - Wholesale of beverages' },
  { code: '47.25', label: '47.25 - Retail sale of beverages in specialised stores' },
] as const;

/**
 * HMRC Organisation Details CSV headers (78 columns, exact order).
 * Maps to Template 1: epr_organisation_details_template.csv
 */
export const HMRC_ORG_DETAILS_CSV_HEADERS = [
  'organisation_id',
  'subsidiary_id',
  'organisation_name',
  'trading_name',
  'companies_house_number',
  'home_nation_code',
  'main_activity_sic',
  'organisation_type_code',
  'organisation_sub_type_code',
  'packaging_activity_so',
  'packaging_activity_pf',
  'packaging_activity_im',
  'packaging_activity_se',
  'packaging_activity_hl',
  'packaging_activity_om',
  'packaging_activity_sl',
  'registration_type_code',
  'turnover',
  'total_tonnage',
  'produce_blank_packaging_flag',
  'liable_for_disposal_costs_flag',
  'meet_reporting_requirements_flag',
  'registered_addr_line1',
  'registered_addr_line2',
  'registered_city',
  'registered_addr_county',
  'registered_addr_postcode',
  'registered_addr_country',
  'registered_addr_phone_number',
  'audit_addr_line1',
  'audit_addr_line2',
  'audit_addr_city',
  'audit_addr_county',
  'audit_addr_postcode',
  'audit_addr_country',
  'service_of_notice_addr_line1',
  'service_of_notice_addr_line2',
  'service_of_notice_addr_city',
  'service_of_notice_addr_county',
  'service_of_notice_addr_postcode',
  'service_of_notice_addr_country',
  'service_of_notice_addr_phone_number',
  'principal_addr_line1',
  'principal_addr_line2',
  'principal_addr_city',
  'principal_addr_county',
  'principal_addr_postcode',
  'principal_addr_country',
  'principal_addr_phone_number',
  'sole_trader_first_name',
  'sole_trader_last_name',
  'sole_trader_phone_number',
  'sole_trader_email',
  'approved_person_first_name',
  'approved_person_last_name',
  'approved_person_phone_number',
  'approved_person_email',
  'approved_person_job_title',
  'delegated_person_first_name',
  'delegated_person_last_name',
  'delegated_person_phone_number',
  'delegated_person_email',
  'delegated_person_job_title',
  'primary_contact_person_first_name',
  'primary_contact_person_last_name',
  'primary_contact_person_phone_number',
  'primary_contact_person_email',
  'primary_contact_person_job_title',
  'secondary_contact_person_first_name',
  'secondary_contact_person_last_name',
  'secondary_contact_person_phone_number',
  'secondary_contact_person_email',
  'secondary_contact_person_job_title',
  'organisation_size',
  'leaver_code',
  'leaver_date',
  'organisation_change_reason',
  'joiner_date',
] as const;

/** HMRC Brand Details CSV headers (Template 2) */
export const HMRC_BRAND_DETAILS_CSV_HEADERS = [
  'organisation_id',
  'subsidiary_id',
  'brand_name',
  'brand_type_code',
] as const;

/** HMRC Partner Details CSV headers (Template 3) */
export const HMRC_PARTNER_DETAILS_CSV_HEADERS = [
  'organisation_id',
  'subsidiary_id',
  'partner_first_name',
  'partner_last_name',
  'partner_phone_number',
  'partner_email',
] as const;
