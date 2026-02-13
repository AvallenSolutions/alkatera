/**
 * EPR Compliance Tool — RPD-specific types
 *
 * These types map to the official Defra "Report Packaging Data" (RPD) portal
 * CSV file specification. Internal Alkatera types (in lib/types/lca.ts) are
 * mapped to these RPD types via lib/epr/mappings.ts.
 */

// =============================================================================
// RPD CSV Column Types (Defra file specification)
// =============================================================================

/** Column H: Packaging Material codes */
export type RPDMaterialCode = 'AL' | 'FC' | 'GL' | 'PC' | 'PL' | 'ST' | 'WD' | 'OT';

/** Column E: Packaging Activity codes */
export type RPDPackagingActivity = 'SO' | 'PF' | 'IM' | 'SE' | 'HL' | 'OM';

/** Column F: Packaging Type codes */
export type RPDPackagingType = 'HH' | 'NH' | 'CW' | 'OW' | 'PB' | 'RU' | 'HDC' | 'NDC' | 'SP';

/** Columns J/K: UK Nation codes */
export type RPDNation = 'EN' | 'NI' | 'SC' | 'WS';

/** Column O: Recyclability Rating codes */
export type RPDRecyclabilityRating = 'R' | 'A' | 'G' | 'R-M' | 'A-M' | 'G-M';

/** Column C: Organisation Size */
export type RPDOrganisationSize = 'L' | 'S';

// =============================================================================
// Fee Rate Types
// =============================================================================

export interface EPRFeeRate {
  fee_year: string;
  material_code: RPDMaterialCode;
  material_name: string;
  flat_rate_per_tonne: number | null;
  green_rate_per_tonne: number | null;
  amber_rate_per_tonne: number | null;
  red_rate_per_tonne: number | null;
  is_modulated: boolean;
}

// =============================================================================
// Submission Types
// =============================================================================

export interface EPRSubmission {
  id: string;
  organization_id: string;
  submission_period: string;
  fee_year: string;
  organization_size: RPDOrganisationSize;
  status: 'draft' | 'ready' | 'submitted' | 'amended';
  total_packaging_weight_kg: number;
  total_estimated_fee_gbp: number;
  total_line_items: number;
  material_summary: Record<RPDMaterialCode, { weight_kg: number; fee_gbp: number; count: number }>;
  csv_generated_at: string | null;
  csv_storage_path: string | null;
  csv_checksum: string | null;
  submitted_to_rpd_at: string | null;
  submitted_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EPRSubmissionLine {
  id: string;
  submission_id: string;
  organization_id: string;
  product_id: number | null;
  product_name: string | null;
  product_material_id: number | null;
  rpd_organisation_id: string;
  rpd_subsidiary_id: string | null;
  rpd_organisation_size: RPDOrganisationSize;
  rpd_submission_period: string;
  rpd_packaging_activity: RPDPackagingActivity;
  rpd_packaging_type: RPDPackagingType;
  rpd_packaging_class: string;
  rpd_packaging_material: RPDMaterialCode;
  rpd_material_subtype: string | null;
  rpd_from_nation: RPDNation;
  rpd_to_nation: RPDNation | null;
  rpd_material_weight_kg: number;
  rpd_material_units: number | null;
  rpd_transitional_weight: number | null;
  rpd_recyclability_rating: RPDRecyclabilityRating | null;
  fee_rate_per_tonne: number | null;
  estimated_fee_gbp: number;
  is_drs_excluded: boolean;
  created_at: string;
}

// =============================================================================
// Fee Calculation Types
// =============================================================================

export interface EPRFeeCalculationResult {
  total_fee_gbp: number;
  total_weight_kg: number;
  total_drs_excluded_weight_kg: number;
  by_material: EPRMaterialFeeBreakdown[];
  by_product: EPRProductFeeBreakdown[];
}

export interface EPRMaterialFeeBreakdown {
  material_code: RPDMaterialCode;
  material_name: string;
  weight_kg: number;
  fee_rate_per_tonne: number;
  fee_gbp: number;
  drs_excluded_weight_kg: number;
}

export interface EPRProductFeeBreakdown {
  product_id: number;
  product_name: string;
  packaging_items: EPRPackagingItemFee[];
  total_fee_gbp: number;
  total_weight_kg: number;
}

export interface EPRPackagingItemFee {
  product_material_id: number;
  material_name: string;
  material_code: RPDMaterialCode;
  weight_per_unit_kg: number;
  units_produced: number;
  total_weight_kg: number;
  ram_rating: 'red' | 'amber' | 'green' | null;
  fee_rate_per_tonne: number;
  fee_gbp: number;
  is_drs_excluded: boolean;
}

// =============================================================================
// Obligation Types
// =============================================================================

export type ObligationSize = 'large' | 'small' | 'below_threshold';

export interface ObligationResult {
  size: ObligationSize;
  turnover_gbp: number;
  total_packaging_tonnes: number;
  reporting_frequency: 'biannual' | 'annual' | 'none';
  pays_fees: boolean;
  pays_prns: boolean;
  explanation: string;
}

// =============================================================================
// Organisation Settings Types
// =============================================================================

export interface EPROrganizationSettings {
  id: string;
  organization_id: string;
  rpd_organization_id: string | null;
  rpd_subsidiary_id: string | null;
  annual_turnover_gbp: number | null;
  estimated_annual_packaging_tonnage: number | null;
  obligation_size: 'large' | 'small' | 'below_threshold' | 'pending';
  default_packaging_activity: string;
  default_uk_nation: string;
  nation_sales_england_pct: number;
  nation_sales_scotland_pct: number;
  nation_sales_wales_pct: number;
  nation_sales_ni_pct: number;
  nation_sales_method: 'manual' | 'auto_estimated' | 'hybrid';
  nation_sales_last_estimated_at: string | null;
  drs_applies: boolean;
  wizard_state: import('./wizard-types').EPRWizardState | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// PRN Types
// =============================================================================

export interface EPRPRNObligation {
  id: string;
  organization_id: string;
  obligation_year: number;
  material_code: string;
  material_name: string;
  total_tonnage_placed: number;
  recycling_target_pct: number;
  obligation_tonnage: number;
  prns_purchased_tonnage: number;
  prn_cost_per_tonne_gbp: number;
  total_prn_cost_gbp: number;
  status: 'not_started' | 'partial' | 'fulfilled' | 'exceeded';
  created_at: string;
  updated_at: string;
}

export interface EPRPRNTarget {
  obligation_year: number;
  material_code: string;
  material_name: string;
  recycling_target_pct: number;
}

// =============================================================================
// Nation Estimation Types
// =============================================================================

export interface NationEstimationResult {
  england_pct: number;
  scotland_pct: number;
  wales_pct: number;
  ni_pct: number;
  method: 'postcode_analysis' | 'population_weighted' | 'hybrid';
  confidence: 'high' | 'medium' | 'low';
  sample_size: number;
  justification: string;
}

// =============================================================================
// Data Completeness Types
// =============================================================================

export interface EPRDataGap {
  product_id: number;
  product_name: string;
  product_material_id: number;
  material_name: string;
  packaging_category: string;
  missing_fields: string[];
}

export interface EPRDataCompletenessResult {
  total_packaging_items: number;
  complete_items: number;
  incomplete_items: number;
  completeness_pct: number;
  gaps: EPRDataGap[];
}
