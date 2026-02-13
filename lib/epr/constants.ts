/**
 * EPR Compliance Tool — Constants
 *
 * Reference data: RPD column headers, material display names, fee year
 * definitions, reporting deadlines, and UK postcode-to-nation mappings.
 */

import type { RPDMaterialCode, RPDPackagingActivity, RPDPackagingType, RPDNation } from './types';

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
  SE: 'Sold via online marketplace',
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

/** Postcode prefixes for Wales */
export const WALES_POSTCODE_PREFIXES = [
  'CF', 'LD', 'LL', 'NP', 'SA', 'SY',
];

// Note: SY is shared (Shropshire/Powys) — SY15-SY25 are Wales, rest is England.
// For simplicity, SY is counted as Wales; refinement can use full postcode lookup.

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
