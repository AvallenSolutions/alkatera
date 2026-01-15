/**
 * Supplier Product Types
 *
 * Comprehensive type definitions for supplier products supporting
 * all 4 environmental impact categories with full ISO compliance.
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type DataSourceType = 'primary_verified' | 'secondary_modelled' | 'hybrid_proxy';

export type SystemBoundaryType = 'cradle_to_gate' | 'cradle_to_grave' | 'gate_to_gate' | 'cradle_to_cradle';

export type UncertaintyType = 'range' | 'std_dev' | 'coefficient_of_variation' | 'pedigree_matrix';

export type EndOfLifePathway =
  | 'landfill'
  | 'recycling'
  | 'composting'
  | 'incineration'
  | 'incineration_with_recovery'
  | 'anaerobic_digestion'
  | 'reuse'
  | 'other';

export type EvidenceType =
  | 'epd'
  | 'lca_report'
  | 'carbon_certificate'
  | 'water_certificate'
  | 'third_party_verification'
  | 'supplier_declaration'
  | 'test_report'
  | 'certification'
  | 'invoice'
  | 'specification_sheet'
  | 'other';

export type EvidenceVerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  epd: 'Environmental Product Declaration (EPD)',
  lca_report: 'Life Cycle Assessment Report',
  carbon_certificate: 'Carbon Footprint Certificate',
  water_certificate: 'Water Footprint Certificate',
  third_party_verification: 'Third-Party Verification Statement',
  supplier_declaration: 'Supplier Declaration',
  test_report: 'Test/Lab Report',
  certification: 'Eco-Label/Certification',
  invoice: 'Invoice/Bill',
  specification_sheet: 'Technical Specification Sheet',
  other: 'Other Documentation',
};

export const DATA_SOURCE_TYPE_LABELS: Record<DataSourceType, string> = {
  primary_verified: 'Primary Verified (EPD/LCA)',
  secondary_modelled: 'Secondary Modelled (Database)',
  hybrid_proxy: 'Hybrid/Proxy Data',
};

export const SYSTEM_BOUNDARY_LABELS: Record<SystemBoundaryType, string> = {
  cradle_to_gate: 'Cradle-to-Gate',
  cradle_to_grave: 'Cradle-to-Grave',
  gate_to_gate: 'Gate-to-Gate',
  cradle_to_cradle: 'Cradle-to-Cradle',
};

export const METHODOLOGY_STANDARDS = [
  { value: 'ISO_14067', label: 'ISO 14067 (Carbon Footprint)' },
  { value: 'ISO_14044', label: 'ISO 14044 (LCA Requirements)' },
  { value: 'ISO_14046', label: 'ISO 14046 (Water Footprint)' },
  { value: 'ISO_14025', label: 'ISO 14025 (EPD)' },
  { value: 'PEF', label: 'EU Product Environmental Footprint' },
  { value: 'GHG_Protocol', label: 'GHG Protocol Product Standard' },
  { value: 'PAS_2050', label: 'PAS 2050 (Carbon Footprint)' },
  { value: 'EN_15804', label: 'EN 15804 (Construction Products)' },
  { value: 'IPCC', label: 'IPCC Guidelines' },
] as const;

// ============================================================================
// GHG BREAKDOWN TYPES (ISO 14067)
// ============================================================================

export interface GHGBreakdown {
  // Gas inventory (individual gases before GWP conversion)
  co2_fossil?: number; // kg CO2 (fossil)
  co2_biogenic?: number; // kg CO2 (biogenic)
  methane?: number; // kg CH4
  nitrous_oxide?: number; // kg N2O
  hfc_pfc?: number; // kg CO2e (fluorinated gases aggregated)

  // GWP factors used
  gwp_ch4?: number; // Default: 28 (AR5)
  gwp_n2o?: number; // Default: 265 (AR5)

  // Additional metadata
  gwp_source?: string; // 'AR5', 'AR6', etc.
  includes_indirect_effects?: boolean;
}

// ============================================================================
// UNCERTAINTY METADATA
// ============================================================================

export interface UncertaintyMetadata {
  // Range uncertainty
  min_value?: number;
  max_value?: number;

  // Standard deviation
  std_dev?: number;
  num_samples?: number;

  // Coefficient of variation
  cv_percent?: number;

  // Pedigree matrix (ISO 14044 / ecoinvent)
  pedigree?: {
    reliability?: number; // 1-5
    completeness?: number; // 1-5
    temporal_correlation?: number; // 1-5
    geographical_correlation?: number; // 1-5
    technological_correlation?: number; // 1-5
  };

  // Monte Carlo results
  monte_carlo?: {
    mean?: number;
    median?: number;
    p5?: number; // 5th percentile
    p95?: number; // 95th percentile
    iterations?: number;
  };
}

// ============================================================================
// SUPPLIER PRODUCT INTERFACE (FULL)
// ============================================================================

export interface SupplierProduct {
  id: string;
  supplier_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  product_code: string | null;
  product_image_url: string | null;
  is_active: boolean;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;

  // Origin location
  origin_address: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  origin_country_code: string | null;

  // Internal verification
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;

  // Multi-category impacts
  carbon_intensity: number | null; // Legacy field (deprecated, use impact_climate)
  impact_climate: number | null; // kg CO2e per unit
  impact_water: number | null; // m³ per unit
  impact_waste: number | null; // kg per unit
  impact_land: number | null; // m²a crop eq per unit

  // GHG breakdown (ISO 14067)
  ghg_fossil: number | null;
  ghg_biogenic: number | null;
  ghg_land_use_change: number | null;
  ghg_breakdown: GHGBreakdown | null;

  // Water breakdown (ISO 14046)
  water_blue: number | null;
  water_green: number | null;
  water_grey: number | null;
  water_scarcity_factor: number | null;

  // Waste & circularity
  recycled_content_pct: number | null;
  recyclability_pct: number | null;
  end_of_life_pathway: EndOfLifePathway | null;
  circularity_score: number | null;

  // Nature/biodiversity (ReCiPe 2016)
  terrestrial_ecotoxicity: number | null;
  freshwater_eutrophication: number | null;
  terrestrial_acidification: number | null;

  // Data quality & methodology
  data_quality_score: number | null; // 1-5 (1 = best)
  data_confidence_pct: number | null; // 0-100
  data_source_type: DataSourceType | null;
  methodology_standard: string | null;
  functional_unit: string | null;
  system_boundary: SystemBoundaryType | null;

  // Validity & temporal
  valid_from: string | null; // ISO date
  valid_until: string | null; // ISO date
  reference_year: number | null;
  geographic_scope: string | null;

  // Uncertainty
  uncertainty_type: UncertaintyType | null;
  uncertainty_value: number | null;
  uncertainty_metadata: UncertaintyMetadata | null;

  // External verification
  external_verifier_name: string | null;
  external_verification_date: string | null;
  external_verification_expiry: string | null;
  external_verification_standard: string | null;
  external_verification_url: string | null;
}

// ============================================================================
// PLATFORM SUPPLIER PRODUCT INTERFACE
// ============================================================================

export interface PlatformSupplierProduct {
  id: string;
  platform_supplier_id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  product_code: string | null;
  product_image_url: string | null;
  is_active: boolean;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;

  // Origin location
  origin_address: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  origin_country_code: string | null;

  // Internal verification
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;

  // Multi-category impacts
  carbon_intensity?: number | null; // Legacy compatibility
  impact_climate: number | null;
  impact_water: number | null;
  impact_waste: number | null;
  impact_land: number | null;

  // GHG breakdown (ISO 14067)
  ghg_fossil: number | null;
  ghg_biogenic: number | null;
  ghg_land_use_change: number | null;
  ghg_breakdown: GHGBreakdown | null;

  // Water breakdown (ISO 14046)
  water_blue: number | null;
  water_green: number | null;
  water_grey: number | null;
  water_scarcity_factor: number | null;

  // Waste & circularity
  recycled_content_pct: number | null;
  recyclability_pct: number | null;
  end_of_life_pathway: EndOfLifePathway | null;
  circularity_score: number | null;

  // Nature/biodiversity (ReCiPe 2016)
  terrestrial_ecotoxicity: number | null;
  freshwater_eutrophication: number | null;
  terrestrial_acidification: number | null;

  // Data quality & methodology
  data_quality_score: number | null;
  data_confidence_pct: number | null;
  data_source_type: DataSourceType | null;
  methodology_standard: string | null;
  functional_unit: string | null;
  system_boundary: SystemBoundaryType | null;

  // Validity & temporal
  valid_from: string | null;
  valid_until: string | null;
  reference_year: number | null;
  geographic_scope: string | null;

  // Uncertainty
  uncertainty_type: UncertaintyType | null;
  uncertainty_value: number | null;
  uncertainty_metadata: UncertaintyMetadata | null;

  // External verification
  external_verifier_name: string | null;
  external_verification_date: string | null;
  external_verification_expiry: string | null;
  external_verification_standard: string | null;
  external_verification_url: string | null;
}

// ============================================================================
// SUPPLIER PRODUCT EVIDENCE INTERFACE
// ============================================================================

export interface SupplierProductEvidence {
  id: string;
  supplier_product_id: string | null;
  platform_supplier_product_id: string | null;
  organization_id: string | null;

  // Evidence details
  evidence_type: EvidenceType;
  document_name: string;
  document_description: string | null;
  document_url: string | null;
  storage_object_path: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;

  // Impact category coverage
  covers_climate: boolean;
  covers_water: boolean;
  covers_waste: boolean;
  covers_land: boolean;

  // Document validity
  document_date: string | null;
  document_expiry: string | null;
  document_reference_number: string | null;

  // Third-party verifier
  verifier_body_id: string | null;
  verifier_name: string | null;
  verifier_accreditation: string | null;
  verification_standard: string | null;
  verification_date: string | null;
  verification_expiry: string | null;

  // Internal verification
  verification_status: EvidenceVerificationStatus;
  internal_verified_by: string | null;
  internal_verified_at: string | null;
  internal_verification_notes: string | null;
  rejection_reason: string | null;

  // Audit trail
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// VERIFICATION BODY INTERFACE
// ============================================================================

export interface VerificationBody {
  id: string;
  name: string;
  short_name: string | null;
  accreditation_body: string | null;
  accreditation_number: string | null;
  website: string | null;
  country: string | null;
  specializations: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// EVIDENCE COVERAGE SUMMARY
// ============================================================================

export interface EvidenceCoverageSummary {
  has_any_evidence: boolean;
  has_verified_evidence: boolean;
  total_documents: number;
  verified_documents: number;
  pending_documents: number;
  climate_covered: boolean;
  water_covered: boolean;
  waste_covered: boolean;
  land_covered: boolean;
  evidence_types: EvidenceType[];
  earliest_expiry: string | null;
}

// ============================================================================
// FORM INPUT TYPES
// ============================================================================

export interface SupplierProductFormData {
  // Basic info
  name: string;
  description?: string;
  category?: string;
  unit: string;
  product_code?: string;
  is_active: boolean;

  // Origin
  origin_address?: string;
  origin_lat?: number;
  origin_lng?: number;
  origin_country_code?: string;

  // Multi-category impacts
  impact_climate?: number;
  impact_water?: number;
  impact_waste?: number;
  impact_land?: number;

  // GHG breakdown
  ghg_fossil?: number;
  ghg_biogenic?: number;
  ghg_land_use_change?: number;

  // Water breakdown
  water_blue?: number;
  water_green?: number;
  water_grey?: number;
  water_scarcity_factor?: number;

  // Waste & circularity
  recycled_content_pct?: number;
  recyclability_pct?: number;
  end_of_life_pathway?: EndOfLifePathway;
  circularity_score?: number;

  // Nature/biodiversity
  terrestrial_ecotoxicity?: number;
  freshwater_eutrophication?: number;
  terrestrial_acidification?: number;

  // Data quality
  data_quality_score?: number;
  data_confidence_pct?: number;
  data_source_type?: DataSourceType;
  methodology_standard?: string;
  functional_unit?: string;
  system_boundary?: SystemBoundaryType;

  // Validity
  valid_from?: string;
  valid_until?: string;
  reference_year?: number;
  geographic_scope?: string;

  // Uncertainty
  uncertainty_type?: UncertaintyType;
  uncertainty_value?: number;

  // External verification
  external_verifier_name?: string;
  external_verification_date?: string;
  external_verification_expiry?: string;
  external_verification_standard?: string;
  external_verification_url?: string;
}

export interface EvidenceFormData {
  evidence_type: EvidenceType;
  document_name: string;
  document_description?: string;
  covers_climate: boolean;
  covers_water: boolean;
  covers_waste: boolean;
  covers_land: boolean;
  document_date?: string;
  document_expiry?: string;
  document_reference_number?: string;
  verifier_body_id?: string;
  verifier_name?: string;
  verification_standard?: string;
  verification_date?: string;
  verification_expiry?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a supplier product has any impact data
 */
export function hasImpactData(product: SupplierProduct | PlatformSupplierProduct): boolean {
  return (
    product.impact_climate !== null ||
    product.impact_water !== null ||
    product.impact_waste !== null ||
    product.impact_land !== null
  );
}

/**
 * Check if a supplier product has complete impact data for all categories
 */
export function hasCompleteImpactData(product: SupplierProduct | PlatformSupplierProduct): boolean {
  return (
    product.impact_climate !== null &&
    product.impact_water !== null &&
    product.impact_waste !== null &&
    product.impact_land !== null
  );
}

/**
 * Get the effective climate impact (handles legacy carbon_intensity field)
 */
export function getClimateImpact(product: SupplierProduct | PlatformSupplierProduct): number | null {
  return product.impact_climate ?? (product as any).carbon_intensity ?? null;
}

/**
 * Check if impact data is within validity period
 */
export function isImpactDataValid(product: SupplierProduct | PlatformSupplierProduct): boolean {
  const now = new Date();

  if (product.valid_from) {
    const validFrom = new Date(product.valid_from);
    if (now < validFrom) return false;
  }

  if (product.valid_until) {
    const validUntil = new Date(product.valid_until);
    if (now > validUntil) return false;
  }

  return true;
}

/**
 * Get data quality label
 */
export function getDataQualityLabel(score: number | null): string {
  if (score === null) return 'Unknown';
  if (score === 1) return 'Excellent';
  if (score === 2) return 'Good';
  if (score === 3) return 'Fair';
  if (score === 4) return 'Poor';
  if (score === 5) return 'Very Poor';
  return 'Unknown';
}
