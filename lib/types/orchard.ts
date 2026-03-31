/**
 * Fruit Orchard LCA types
 *
 * Types for the orchard growing module that calculates environmental impacts
 * for producers who grow their own fruit (apples, pears, cherries, etc.).
 *
 * FLAG Alignment (SBTi Forest, Land and Agriculture):
 *   - Emissions and removals are ALWAYS reported separately (never netted)
 *   - FLAG emissions = land-based (N2O from soils, land use change)
 *   - Non-FLAG emissions = energy/industrial (diesel, fertiliser production, transport)
 *   - Removals = soil carbon sequestration (practice-based defaults or measured)
 *
 * Methodology references:
 *   - IPCC 2019 Refinement, Chapter 11 (N2O from managed soils)
 *   - IPCC AR6 GWP-100 (N2O = 273)
 *   - SBTi FLAG Guidance v1.2 (March 2026)
 *   - GHG Protocol Land Sector and Removals Standard V1.0 (January 2026)
 *   - DEFRA 2024 UK Government GHG Conversion Factors
 */

// Re-export shared agricultural types from viticulture
export type {
  SoilManagement,
  FertiliserType,
  IrrigationEnergySource,
  SoilCarbonMethodology,
} from './viticulture';

// Re-export climate zone with an alias for clarity
export type { VineyardClimateZone as ClimateZone } from './viticulture';

// ---------------------------------------------------------------------------
// Orchard-specific enums
// ---------------------------------------------------------------------------

export type OrchardType =
  | 'apple'
  | 'pear'
  | 'cherry'
  | 'plum'
  | 'citrus'
  | 'stone_fruit'
  | 'mixed'
  | 'other';

export type OrchardCertification =
  | 'conventional'
  | 'organic'
  | 'biodynamic'
  | 'other';

export type TrainingSystem =
  | 'bush'
  | 'spindle'
  | 'espalier'
  | 'trellis'
  | 'central_leader'
  | 'open_vase'
  | 'other';

export type OrchardPesticideType =
  | 'generic'
  | 'sulfur'
  | 'mancozeb'
  | 'synthetic_fungicide'
  | 'insecticide_codling_moth'
  | 'insecticide_aphid'
  | 'herbicide_glyphosate';

export type TransportMode = 'road' | 'rail';

/** IPCC land use categories for dLUC calculation (FLAG-C3) */
export type PreviousLandUseType =
  | 'permanent_orchard'
  | 'grassland'
  | 'forest'
  | 'arable'
  | 'wetland'
  | 'settlement'
  | 'other_land';

// ---------------------------------------------------------------------------
// Database row - mirrors public.orchards
// ---------------------------------------------------------------------------

export interface Orchard {
  id: string;
  organization_id: string;
  facility_id: string | null;
  name: string;
  hectares: number;
  orchard_type: OrchardType;
  fruit_varieties: string[];
  annual_yield_tonnes: number | null;
  yield_tonnes_per_ha: number | null;
  certification: OrchardCertification;
  climate_zone: 'wet' | 'dry' | 'temperate';

  // Orchard-specific
  planting_year: number | null;
  tree_density_per_ha: number | null;
  rootstock_type: string | null;
  training_system: TrainingSystem | null;

  // Location
  address_line1: string | null;
  address_city: string | null;
  address_country: string | null;
  address_postcode: string | null;
  address_lat: number | null;
  address_lng: number | null;
  location_country_code: string | null;

  /** Land use before orchard establishment (FLAG dLUC) */
  previous_land_use_type: PreviousLandUseType | null;
  /** Year land was converted to orchard (FLAG 20-year amortisation) */
  land_conversion_year: number | null;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Database row - mirrors public.orchard_growing_profiles
// ---------------------------------------------------------------------------

export interface OrchardGrowingProfile {
  id: string;
  orchard_id: string;
  organization_id: string;
  harvest_year: number;

  // Step 1: Soil & Land
  area_ha: number;
  soil_management: string; // SoilManagement type

  // Step 2: Inputs - Fertiliser
  fertiliser_type: string; // FertiliserType
  fertiliser_quantity_kg: number;
  fertiliser_n_content_percent: number;

  // Step 1: Soil & Land - Crop residue
  pruning_residue_returned: boolean;

  // Step 2: Inputs - Pesticide/Herbicide
  uses_pesticides: boolean;
  pesticide_applications_per_year: number;
  pesticide_type: OrchardPesticideType;
  uses_herbicides: boolean;
  herbicide_applications_per_year: number;
  herbicide_type: OrchardPesticideType;

  // Step 3: Machinery & Fuel
  diesel_litres_per_year: number;
  petrol_litres_per_year: number;

  // Step 4: Irrigation
  is_irrigated: boolean;
  water_m3_per_ha: number;
  irrigation_energy_source: string; // IrrigationEnergySource

  // Yield (allocation denominator)
  fruit_yield_tonnes: number;

  // Transport from orchard to facility
  transport_distance_km: number | null;
  transport_mode: TransportMode | null;

  // Phase 2: Soil carbon measured override
  soil_carbon_override_kg_co2e_per_ha: number | null;
  soil_carbon_measurement_date: string | null;
  soil_carbon_methodology: string | null;
  soil_carbon_lab_name: string | null;
  soil_carbon_sampling_points: number | null;

  // Draft support
  is_draft: boolean;

  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Calculator input (subset of profile + orchard metadata)
// ---------------------------------------------------------------------------

export interface OrchardCalculatorInput {
  // From orchard
  orchard_type: OrchardType;
  climate_zone: 'wet' | 'dry' | 'temperate';
  certification: OrchardCertification;
  location_country_code: string | null;

  // From growing profile
  area_ha: number;
  soil_management: string; // SoilManagement
  pruning_residue_returned?: boolean;
  fertiliser_type: string; // FertiliserType
  fertiliser_quantity_kg: number;
  fertiliser_n_content_percent: number;
  uses_pesticides: boolean;
  pesticide_applications_per_year: number;
  pesticide_type?: OrchardPesticideType;
  uses_herbicides: boolean;
  herbicide_applications_per_year: number;
  herbicide_type?: OrchardPesticideType;
  diesel_litres_per_year: number;
  petrol_litres_per_year: number;
  is_irrigated: boolean;
  water_m3_per_ha: number;
  irrigation_energy_source: string; // IrrigationEnergySource
  fruit_yield_tonnes: number;
  soil_carbon_override_kg_co2e_per_ha: number | null;
  /** AWARE water scarcity factor for the orchard location (caller resolves from DB) */
  aware_factor?: number;

  // Transport from orchard to processing facility
  transport_distance_km?: number | null;
  transport_mode?: TransportMode | null;

  // LUC (land use change) - from orchard record (FLAG-C3)
  /** IPCC land use category before orchard establishment */
  previous_land_use_type?: PreviousLandUseType | null;
  /** Year land was converted to orchard */
  land_conversion_year?: number | null;
  /** Current harvest year (for LUC amortisation calculation) */
  harvest_year?: number;
}

// ---------------------------------------------------------------------------
// Calculator output (FLAG-separated)
// ---------------------------------------------------------------------------

/**
 * Orchard impact result with FLAG-compliant separation of emissions
 * and removals. Emissions are never netted against removals.
 */
export interface OrchardImpactResult {
  // FLAG emissions (land-based biological/soil processes)
  flag_emissions: {
    /** Direct N2O from managed soils (IPCC Tier 1 EF1) */
    n2o_direct_co2e: number;
    /** Indirect N2O from volatilisation + leaching (IPCC EF4, EF5) */
    n2o_indirect_co2e: number;
    /** N2O from crop residue decomposition (tree prunings, IPCC Ch 11) */
    n2o_crop_residue_co2e: number;
    /** dLUC emissions amortised over 20 years (kg CO2e, FLAG-C3) */
    luc_co2e: number;
    /** Land occupation (m2 per year) */
    land_use_m2: number;
    /** Total FLAG emissions (kg CO2e) */
    total_flag_co2e: number;
    /** Gas-level breakdown within FLAG scope (Section 3.1.6) */
    gas_inventory?: {
      /** kg CO2 from land use change */
      co2_luc: number;
      /** kg N2O (actual mass, not CO2e) */
      n2o_total: number;
      /** kg CH4 (currently 0 for orchards) */
      ch4_total: number;
    };
  };

  // FLAG removals (soil carbon sequestration - reported SEPARATELY)
  flag_removals: {
    /** Soil carbon removed (positive value = CO2 removed from atmosphere) */
    soil_carbon_co2e: number;
    /** Source methodology for the removal estimate */
    methodology: 'practice_based_default' | 'measured';
    /** Whether the value has been independently verified */
    is_verified: boolean;
    /** Whether removals meet GHG Protocol Land Sector and Removals Standard */
    removals_meet_lsr_standard: boolean;
    /** Warning when removals use practice-based defaults without third-party verification */
    removals_warning?: string;
  };

  // Non-FLAG emissions (energy/industrial)
  non_flag_emissions: {
    /** Embodied CO2e from fertiliser manufacture */
    fertiliser_production_co2e: number;
    /** Diesel + petrol combustion (DEFRA factors) */
    machinery_fuel_co2e: number;
    /** Electricity/diesel for irrigation pumping */
    irrigation_energy_co2e: number;
    /** Embodied CO2e from pesticide/herbicide manufacture */
    pesticide_production_co2e: number;
    /** Transport from orchard to processing facility (DEFRA tonne-km) */
    transport_co2e: number;
    /** Total non-FLAG emissions (kg CO2e) */
    total_non_flag_co2e: number;
  };

  // Water impacts
  /** Total blue water consumption (m3) */
  water_m3: number;
  /** AWARE scarcity-weighted water (m3 eq) */
  water_scarcity_m3_eq: number;

  // Ecotoxicity impacts (from pesticide/herbicide application)
  /** Freshwater ecotoxicity (CTUe) */
  freshwater_ecotoxicity: number;
  /** Terrestrial ecotoxicity (CTUe) */
  terrestrial_ecotoxicity: number;
  /** Human toxicity, non-carcinogenic (CTUh) */
  human_toxicity_non_carcinogenic: number;
  /** Freshwater eutrophication (kg P eq) - from nutrient runoff */
  freshwater_eutrophication: number;

  // GHG gas breakdown (ISO 14067)
  /** Actual N2O mass emitted (kg) - not CO2e */
  n2o_kg: number;
  /** Fossil CO2 from fuel combustion and industrial processes (kg) */
  co2_fossil_kg: number;

  // Normalised values
  /** Total emissions per kg of fruit (FLAG + non-FLAG, kg CO2e/kg) */
  total_emissions_per_kg: number;
  /** Soil carbon removals per kg of fruit (kg CO2e/kg) */
  removals_per_kg: number;
  /** Total emissions for entire orchard area (kg CO2e) */
  total_emissions: number;
  /** Total removals for entire orchard area (kg CO2e) */
  total_removals: number;

  // Data quality
  data_quality_grade: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Human-readable methodology notes */
  methodology_notes: string;
}

// ---------------------------------------------------------------------------
// Multi-harvest types
// ---------------------------------------------------------------------------

/** Summary of impacts for one harvest year, used in trend charts */
export interface HarvestImpactSummary {
  harvest_year: number;
  profile_id: string;
  is_complete: boolean;
  is_draft: boolean;
  impacts: OrchardImpactResult;
  // Normalised headline metrics for charts (per hectare)
  emissions_per_ha: number;
  water_per_ha: number;
  removals_per_ha: number;
  yield_tonnes_per_ha: number;
}

/** Multi-harvest averaged result for LCA calculator */
export interface MultiHarvestAveragedResult {
  averaged_impacts: OrchardImpactResult;
  harvests_used: number[];
  method: 'single' | 'average_2yr' | 'median_3yr';
}

// ---------------------------------------------------------------------------
// Soil carbon evidence (uploaded lab reports)
// ---------------------------------------------------------------------------

export interface OrchardSoilCarbonEvidence {
  id: string;
  growing_profile_id: string;
  orchard_id: string;
  organization_id: string;
  document_name: string;
  storage_object_path: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
  /** Signed URL for downloading (populated client-side, not stored in DB) */
  signed_url?: string;
}
