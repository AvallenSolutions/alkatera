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

export type PackagingCategory = 'container' | 'label' | 'closure' | 'secondary' | 'shipment' | 'tertiary';

// ============================================================================
// UK EPR (Extended Producer Responsibility) Types
// Based on https://www.gov.uk/guidance/how-to-collect-your-packaging-data-for-extended-producer-responsibility
// ============================================================================

/**
 * EPR Material Types - aligned with UK gov.uk categories
 * Used for material breakdown of packaging components
 */
export type EPRMaterialType =
  // Main EPR material categories
  | 'aluminium'
  | 'fibre_composite'    // Fibre-based composite
  | 'glass'
  | 'paper_cardboard'
  | 'plastic_rigid'      // Plastic split for large producers
  | 'plastic_flexible'   // Plastic split for large producers
  | 'steel'
  | 'wood'
  | 'other'              // bamboo, ceramic, cork, silicone, etc.
  // Sub-component materials for detailed breakdown
  | 'adhesive'
  | 'ink'
  | 'coating'
  | 'lacquer';

/**
 * EPR Packaging Level - UK EPR packaging class
 */
export type EPRPackagingLevel = 'primary' | 'secondary' | 'tertiary' | 'shipment';

/**
 * EPR Packaging Activity - how packaging was supplied
 */
export type EPRPackagingActivity =
  | 'brand'           // Supplied under your brand
  | 'packed_filled'   // Packed or filled
  | 'imported'        // Imported (first UK owner)
  | 'empty'           // Supplied as empty packaging
  | 'hired'           // Hired or loaned
  | 'marketplace';    // Online marketplace

/**
 * RAM Recyclability Rating (Recyclability Assessment Methodology)
 * Used for EPR fee modulation
 */
export type EPRRAMRating = 'red' | 'amber' | 'green';

/**
 * UK Nation - for EPR reporting by nation
 */
export type EPRUKNation = 'england' | 'scotland' | 'wales' | 'northern_ireland';

/**
 * Packaging Material Component - for EPR material breakdown
 * Represents a single material component within a packaging item (e.g., paper, glue, ink)
 */
export interface PackagingMaterialComponent {
  id?: string;
  product_material_id?: number;
  epr_material_type: EPRMaterialType;
  component_name: string;
  weight_grams: number;
  recycled_content_percentage?: number;
  is_recyclable?: boolean;
  created_at?: string;
  updated_at?: string;
}

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

/**
 * Product Carbon Footprint (PCF) - aligned with ISO 14067 and GHG Protocol Product Standard
 * Represents the greenhouse gas emissions associated with a product throughout its lifecycle
 */
export interface ProductCarbonFootprint {
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

/** @deprecated Use ProductCarbonFootprint instead */
export type ProductLca = ProductCarbonFootprint;

/**
 * Material associated with a Product Carbon Footprint
 * Includes ingredients and packaging with their environmental impact data
 */
export interface ProductCarbonFootprintMaterial {
  id: string;
  product_carbon_footprint_id: string;
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
  origin_address?: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  origin_country_code?: string | null;
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

/** @deprecated Use ProductCarbonFootprintMaterial instead */
export interface ProductLcaMaterial extends Omit<ProductCarbonFootprintMaterial, 'product_carbon_footprint_id'> {
  product_lca_id: string;
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
  origin_address?: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  origin_country_code?: string | null;
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

/**
 * Payload for creating a new Product Carbon Footprint
 */
export interface CreatePcfPayload {
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

/** @deprecated Use CreatePcfPayload instead */
export type CreateLcaPayload = CreatePcfPayload;
