export interface LcaLifeCycleStage {
  id: number;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
}

export interface LcaSubStage {
  id: string;
  lca_stage_id: string;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
}

export interface LcaStageWithSubStages extends LcaLifeCycleStage {
  sub_stages: LcaSubStage[];
}

export interface Ingredient {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  lca_sub_stage_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IngredientWithSubStage extends Ingredient {
  lca_sub_stages?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

export interface PackagingType {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  material: string | null;
  weight_g: number | null;
  created_at: string;
  updated_at: string;
}

export type MaterialType = 'ingredient' | 'packaging';

export type PackagingCategory = 'container' | 'label' | 'closure' | 'secondary';

export type LabelPrintingType = 'digital' | 'offset' | 'flexographic' | 'gravure' | 'screen' | 'letterpress' | 'other';

export type DataSource = 'openlca' | 'supplier' | 'primary' | 'staging' | 'ecoinvent';

export type ImpactSourceType = 'primary_verified' | 'secondary_modelled' | 'hybrid_proxy';

/**
 * Single environmental impact metric with provenance tracking
 */
export interface ImpactMetric {
  value: number;
  unit: string;
  source_type: ImpactSourceType;
  reference_id?: string; // OpenLCA/Ecoinvent process ID
  confidence_score?: number; // 0-100
}

/**
 * Complete multi-capital impact vector for CSRD/TNFD compliance
 */
export interface ImpactVector {
  climate_change: ImpactMetric;
  water_depletion: ImpactMetric;
  land_use: ImpactMetric;
  waste_generation: ImpactMetric;
  marine_eutrophication?: ImpactMetric;
  particulate_matter?: ImpactMetric;
  human_toxicity?: ImpactMetric;
}

/**
 * Simplified impact factors stored at material level (per reference unit)
 */
export interface MaterialImpactFactors {
  impact_climate?: number | null;
  impact_water?: number | null;
  impact_land?: number | null;
  impact_waste?: number | null;
  impact_source?: ImpactSourceType | null;
  impact_reference_id?: string | null;
  impact_metadata?: Record<string, any> | null;
}

/**
 * GHG Breakdown per ISO 14067 - Carbon Origin Split
 */
export interface CarbonOriginBreakdown {
  fossil: number;           // kg CO2e from fossil sources
  biogenic: number;         // kg CO2e from biogenic sources
  land_use_change: number;  // kg CO2e from dLUC (direct land use change)
}

/**
 * GHG Breakdown per ISO 14067 - Gas Inventory (by species)
 */
export interface GasInventory {
  co2_fossil: number;     // kg CO2 (fossil)
  co2_biogenic: number;   // kg CO2 (biogenic)
  methane: number;        // kg CH4
  nitrous_oxide: number;  // kg N2O
  hfc_pfc: number;        // kg CO2e (fluorinated gases)
}

/**
 * GWP Characterization Factors
 */
export interface GWPFactors {
  methane_gwp100: number;   // Default: 27.9 (IPCC AR6)
  n2o_gwp100: number;       // Default: 273 (IPCC AR6)
  method: string;           // e.g., "IPCC AR6", "IPCC AR5"
}

/**
 * Complete GHG Breakdown for ISO 14067 Compliance
 */
export interface GHGBreakdown {
  carbon_origin: CarbonOriginBreakdown;
  gas_inventory: GasInventory;
  gwp_factors: GWPFactors;
}

/**
 * GHG Breakdown Validation Result
 */
export interface GHGBreakdownValidation {
  has_breakdown: boolean;
  total_climate: number;
  carbon_sum?: number;
  variance_pct?: number;
  is_valid: boolean;
  warning?: string | null;
}

export interface MaterialSelectionOutput {
  materialId: string;
  materialType: MaterialType;
  quantity: number;
}

export interface ProductLca {
  id: string;
  organization_id: string;
  product_name: string;
  product_description?: string | null;
  product_image_url?: string | null;
  functional_unit: string;
  system_boundary: string;
  status: 'draft' | 'pending' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface ProductLcaMaterial {
  id: string;
  product_lca_id: string;
  material_id?: string | null;
  material_type?: MaterialType | null;
  name?: string | null;
  quantity: number;
  unit?: string | null;
  country_of_origin?: string | null;
  is_organic?: boolean;
  is_regenerative?: boolean;
  lca_sub_stage_id?: string | null;
  data_source?: DataSource | null;
  data_source_id?: string | null;
  supplier_product_id?: string | null;
  origin_country?: string | null;
  is_organic_certified?: boolean;
  packaging_category?: PackagingCategory | null;
  label_printing_type?: string | null;
  impact_climate?: number | null;
  impact_water?: number | null;
  impact_land?: number | null;
  impact_waste?: number | null;
  impact_source?: ImpactSourceType | null;
  impact_reference_id?: string | null;
  impact_metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface SimpleMaterialInput {
  id?: string;
  name: string;
  quantity: number | string;
  unit: string;
  lca_sub_stage_id: number | string;
  data_source?: DataSource;
  data_source_id?: string;
  supplier_product_id?: string;
  origin_country?: string;
  is_organic_certified?: boolean;
}

export interface OpenLCAProcess {
  id: string;
  name: string;
  category: string;
  unit?: string;
  processType?: string;
  location?: string;
  co2_factor?: number;
  water_factor?: number;
  land_factor?: number;
  waste_factor?: number;
  source?: string;
  metadata?: any;
}

export interface SupplierProduct {
  id: string;
  supplier_id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  unit: string;
  carbon_intensity?: number | null;
  product_code?: string | null;
  supplier_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IngredientCardData {
  tempId: string;
  data_source: DataSource;
  name: string;
  quantity: number | string;
  unit: string;
  lca_sub_stage_id: string | null;
  data_source_id?: string;
  supplier_product_id?: string;
  origin_country: string;
  is_organic_certified: boolean;
}

export interface MaterialWithDetails {
  material_id: string;
  material_type: MaterialType;
  name: string;
  quantity: number;
  unit: string;
  country_of_origin: string;
  is_organic: boolean;
  is_regenerative: boolean;
  lca_sub_stage_id: number;
  lca_sub_stage_name?: string;
}

export interface CreateLcaPayload {
  productDetails: {
    product_name: string;
    product_description: string;
    product_image_url: string;
    functional_unit: string;
    system_boundary: string;
  };
  materials: Array<{
    material_id: string;
    material_type: MaterialType;
    quantity: number;
    unit: string;
    country_of_origin: string;
    is_organic: boolean;
    is_regenerative: boolean;
    lca_sub_stage_id: number;
  }>;
}
