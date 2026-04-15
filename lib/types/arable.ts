/**
 * Arable Crop LCA types
 *
 * Types for the arable growing module that calculates environmental impacts
 * for producers who grow their own grain crops (barley, wheat, oats, etc.).
 *
 * FLAG Alignment (SBTi Forest, Land and Agriculture):
 *   - Emissions and removals are ALWAYS reported separately (never netted)
 *   - FLAG emissions = land-based (N2O from soils, land use change, lime CO2)
 *   - Non-FLAG emissions = energy/industrial (diesel, fertiliser production, transport, drying)
 *   - Removals = soil carbon sequestration (practice-based defaults or measured)
 *
 * Methodology references:
 *   - IPCC 2019 Refinement, Chapter 11 (N2O from managed soils)
 *   - IPCC 2019 Refinement, Chapter 11 (CO2 from lime application)
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

// Re-export transport mode from orchard
export type { TransportMode } from './orchard';

// ---------------------------------------------------------------------------
// Arable-specific enums
// ---------------------------------------------------------------------------

export type CropType =
  | 'barley'
  | 'wheat'
  | 'oats'
  | 'rye'
  | 'maize'
  | 'other';

export type ArableCertification =
  | 'conventional'
  | 'organic'
  | 'other';

export type SowingMethod =
  | 'drilled'
  | 'broadcast'
  | 'direct_drill'
  | 'other';

export type StrawManagement =
  | 'incorporated'
  | 'baled_removed'
  | 'burned'
  | 'mulched';

export type GrainDryingFuel =
  | 'natural_gas'
  | 'lpg'
  | 'diesel'
  | 'biomass'
  | 'grid_electricity'
  | 'none';

export type ArablePesticideType =
  | 'generic'
  | 'sulfur'
  | 'synthetic_fungicide'
  | 'herbicide_glyphosate'
  | 'growth_regulator';

/** IPCC land use categories for dLUC calculation (FLAG-C3) */
export type PreviousLandUseType =
  | 'permanent_arable'
  | 'grassland'
  | 'forest'
  | 'wetland'
  | 'settlement'
  | 'other_land';

// ---------------------------------------------------------------------------
// Database row - mirrors public.arable_fields
// ---------------------------------------------------------------------------

export interface ArableField {
  id: string;
  organization_id: string;
  facility_id: string | null;
  name: string;
  hectares: number;
  crop_type: CropType;
  crop_varieties: string[];
  annual_yield_tonnes: number | null;
  yield_tonnes_per_ha: number | null;
  certification: ArableCertification;
  climate_zone: 'wet' | 'dry' | 'temperate';

  // Arable-specific
  sowing_method: SowingMethod | null;
  seed_rate_kg_per_ha: number | null;

  // Location
  address_line1: string | null;
  address_city: string | null;
  address_country: string | null;
  address_postcode: string | null;
  address_lat: number | null;
  address_lng: number | null;
  location_country_code: string | null;

  /** Land use before current arable use (FLAG dLUC) */
  previous_land_use_type: PreviousLandUseType | null;
  /** Year land was converted to arable (FLAG 20-year amortisation) */
  land_conversion_year: number | null;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Database row - mirrors public.arable_growing_profiles
// ---------------------------------------------------------------------------

export interface ArableGrowingProfile {
  id: string;
  arable_field_id: string;
  organization_id: string;
  harvest_year: number;

  // Step 1: Soil & Land
  area_ha: number;
  soil_management: string; // SoilManagement type

  // Step 1: Straw / crop residue
  straw_management: StrawManagement;
  straw_yield_tonnes_per_ha: number;

  // Step 1: Lime application
  lime_applied_kg_per_ha: number;
  lime_type: 'ite' | 'dolomite' | 'none';

  // Step 2: Inputs - Fertiliser
  fertiliser_type: string; // FertiliserType
  fertiliser_quantity_kg: number;
  fertiliser_n_content_percent: number;

  // Step 2: Inputs - Pesticide/Herbicide
  uses_pesticides: boolean;
  pesticide_applications_per_year: number;
  pesticide_type: ArablePesticideType;
  uses_herbicides: boolean;
  herbicide_applications_per_year: number;
  herbicide_type: ArablePesticideType;

  // Step 2: Inputs - Growth regulators
  uses_growth_regulators: boolean;
  growth_regulator_applications: number;

  // Step 2: Inputs - Seed
  seed_rate_kg_per_ha: number;

  // Step 3: Machinery & Fuel
  diesel_litres_per_year: number;
  petrol_litres_per_year: number;

  // Step 3: Grain drying
  grain_drying_fuel: GrainDryingFuel;
  grain_drying_energy_kwh_per_tonne: number;

  // Step 4: Irrigation
  is_irrigated: boolean;
  water_m3_per_ha: number;
  irrigation_energy_source: string; // IrrigationEnergySource

  // Yield (allocation denominator)
  grain_yield_tonnes: number;
  grain_moisture_percent: number;

  // Transport from field to facility
  transport_distance_km: number | null;
  transport_mode: 'road' | 'rail' | null;

  // Phase 2: Soil carbon measured override
  soil_carbon_override_kg_co2e_per_ha: number | null;
  soil_carbon_measurement_date: string | null;
  soil_carbon_methodology: string | null;
  soil_carbon_lab_name: string | null;
  soil_carbon_sampling_points: number | null;

  // Removal verification (FLAG compliance)
  removal_verification_status?: string | null;
  removal_verifier_body?: string | null;
  removal_verifier_standard?: string | null;
  removal_verification_date?: string | null;
  removal_verification_expiry?: string | null;

  // TNFD location sensitivity
  ecosystem_type?: string | null;
  in_biodiversity_sensitive_area?: boolean;
  sensitive_area_details?: string | null;
  water_stress_index?: string | null;

  // Land ownership boundary
  land_ownership_type?: string | null;
  lease_expiry_date?: string | null;
  is_boundary_controlled?: boolean;

  // Draft support
  is_draft: boolean;

  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Calculator input (subset of profile + field metadata)
// ---------------------------------------------------------------------------

export interface ArableCalculatorInput {
  // From arable field
  crop_type: CropType;
  climate_zone: 'wet' | 'dry' | 'temperate';
  certification: ArableCertification;
  location_country_code: string | null;

  // From growing profile
  area_ha: number;
  soil_management: string; // SoilManagement

  // Straw / crop residue
  straw_management: StrawManagement;
  straw_yield_tonnes_per_ha: number;

  // Lime
  lime_applied_kg_per_ha: number;
  lime_type: 'ite' | 'dolomite' | 'none';

  // Fertiliser
  fertiliser_type: string; // FertiliserType
  fertiliser_quantity_kg: number;
  fertiliser_n_content_percent: number;

  // Pesticide/Herbicide
  uses_pesticides: boolean;
  pesticide_applications_per_year: number;
  pesticide_type?: ArablePesticideType;
  uses_herbicides: boolean;
  herbicide_applications_per_year: number;
  herbicide_type?: ArablePesticideType;

  // Growth regulators
  uses_growth_regulators: boolean;
  growth_regulator_applications: number;

  // Seed
  seed_rate_kg_per_ha: number;

  // Machinery & Fuel
  diesel_litres_per_year: number;
  petrol_litres_per_year: number;

  // Grain drying
  grain_drying_fuel: GrainDryingFuel;
  grain_drying_energy_kwh_per_tonne: number;

  // Irrigation
  is_irrigated: boolean;
  water_m3_per_ha: number;
  irrigation_energy_source: string; // IrrigationEnergySource

  // Yield
  grain_yield_tonnes: number;
  grain_moisture_percent: number;

  // Soil carbon
  soil_carbon_override_kg_co2e_per_ha: number | null;
  /** AWARE water scarcity factor for the field location (caller resolves from DB) */
  aware_factor?: number;

  // Transport from field to processing facility
  transport_distance_km?: number | null;
  transport_mode?: 'road' | 'rail' | null;

  // LUC (land use change) - from field record (FLAG-C3)
  /** IPCC land use category before arable establishment */
  previous_land_use_type?: PreviousLandUseType | null;
  /** Year land was converted to arable */
  land_conversion_year?: number | null;
  /** Current harvest year (for LUC amortisation calculation) */
  harvest_year?: number;

  // Land ownership boundary (GHG Protocol LSR v1.0)
  /** Operational boundary: owned, leased, rental, or contract growing */
  land_ownership_type?: 'owned' | 'leased' | 'rental' | 'contract_growing';
  /** Lease expiry date (required when leased or rental) */
  lease_expiry_date?: string | null;
  /** Whether the organisation controls land management decisions */
  is_boundary_controlled?: boolean;

  // Removal verification (SBTi FLAG / GHG Protocol LSR v1.0)
  /** Third-party verification status for soil carbon removal claims */
  removal_verification_status?: 'unverified' | 'pending' | 'verified' | 'rejected' | 'expired';
  /** Name of the verification body */
  removal_verifier_body?: string;
  /** Verification standard used */
  removal_verifier_standard?: string;
  /** Date verification was completed */
  removal_verification_date?: string;
  /** Date verification expires */
  removal_verification_expiry?: string;

  // TNFD LEAP Locate phase
  /** Ecosystem type at the field location (IPBES classification) */
  ecosystem_type?: 'temperate_forest' | 'mediterranean' | 'grassland' | 'wetland' | 'shrubland' | 'tropical_forest' | 'boreal_forest' | 'semi_arid' | 'other';
  /** Whether the site is within or adjacent to a Key Biodiversity Area or protected area */
  in_biodiversity_sensitive_area?: boolean;
  /** Name/designation of the sensitive area if applicable */
  sensitive_area_details?: string;
  /** WRI Aqueduct water stress classification for the location */
  water_stress_index?: 'low' | 'medium' | 'high' | 'very_high';
}

// ---------------------------------------------------------------------------
// Calculator output (FLAG-separated)
// ---------------------------------------------------------------------------

/**
 * Arable impact result with FLAG-compliant separation of emissions
 * and removals. Emissions are never netted against removals.
 */
export interface ArableImpactResult {
  // FLAG emissions (land-based biological/soil processes)
  flag_emissions: {
    /** Direct N2O from managed soils (IPCC Tier 1 EF1) */
    n2o_direct_co2e: number;
    /** Indirect N2O from volatilisation + leaching (IPCC EF4, EF5) */
    n2o_indirect_co2e: number;
    /** N2O from crop residue decomposition (straw, IPCC Ch 11) */
    n2o_crop_residue_co2e: number;
    /** CO2 from lime application (IPCC Tier 1) */
    lime_co2e: number;
    /** dLUC emissions amortised over 20 years (kg CO2e, FLAG-C3) */
    luc_co2e: number;
    /** Land occupation (m2 per year) */
    land_use_m2: number;
    /** Total FLAG emissions (kg CO2e) */
    total_flag_co2e: number;
    /** Gas-level breakdown within FLAG scope (Section 3.1.6) */
    gas_inventory?: {
      /** kg CO2 from land use change + lime */
      co2_luc_and_lime: number;
      /** kg N2O (actual mass, not CO2e) */
      n2o_total: number;
      /** kg CH4 (currently 0 for arable in this module) */
      ch4_total: number;
    };
  };

  // FLAG removals (soil carbon sequestration - reported SEPARATELY)
  flag_removals: {
    /** Soil carbon removed (positive value = CO2 removed from atmosphere) */
    soil_carbon_co2e: number;
    /** Source methodology for the removal estimate */
    methodology: 'practice_based_default' | 'measured';
    /** Whether the value has been independently verified (backward compat) */
    is_verified: boolean;
    /** Third-party verification status */
    removal_verification_status: 'unverified' | 'pending' | 'verified' | 'rejected' | 'expired';
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
    /** Grain drying energy (fuel-specific) */
    grain_drying_co2e: number;
    /** Embodied CO2e from seed production */
    seed_production_co2e: number;
    /** Embodied CO2e from growth regulator manufacture */
    growth_regulator_co2e: number;
    /** Transport from field to processing facility (DEFRA tonne-km) */
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
  /** Terrestrial acidification (kg SO2 eq) - from diesel combustion and ammonia volatilisation */
  terrestrial_acidification: number;

  // TNFD LEAP Locate phase metadata (pass-through from input)
  tnfd_location?: {
    ecosystem_type?: string;
    in_biodiversity_sensitive_area: boolean;
    sensitive_area_details?: string;
    water_stress_index?: string;
  };

  // GHG gas breakdown (ISO 14067)
  /** Actual N2O mass emitted (kg) - not CO2e */
  n2o_kg: number;
  /** Fossil CO2 from fuel combustion and industrial processes (kg) */
  co2_fossil_kg: number;

  // Normalised values
  /** Total emissions per kg of grain (FLAG + non-FLAG, kg CO2e/kg) */
  total_emissions_per_kg: number;
  /** Soil carbon removals per kg of grain (kg CO2e/kg) */
  removals_per_kg: number;
  /** Total emissions for entire field area (kg CO2e) */
  total_emissions: number;
  /** Total removals for entire field area (kg CO2e) */
  total_removals: number;

  // Data quality
  data_quality_grade: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Human-readable methodology notes */
  methodology_notes: string;

  // FLAG threshold (SBTi FLAG Guidance v1.2)
  /** Percentage of total emissions that are FLAG-classified */
  flag_emissions_pct: number;
  /** True if FLAG emissions >= 20% of total, triggering mandatory FLAG target-setting */
  flag_threshold_exceeded: boolean;
  /** Warning message when threshold is exceeded */
  flag_threshold_message?: string;
}

// ---------------------------------------------------------------------------
// Multi-harvest types
// ---------------------------------------------------------------------------

/** Summary of impacts for one harvest year, used in trend charts */
export interface ArableHarvestImpactSummary {
  harvest_year: number;
  profile_id: string;
  is_complete: boolean;
  is_draft: boolean;
  impacts: ArableImpactResult;
  // Normalised headline metrics for charts (per hectare)
  emissions_per_ha: number;
  water_per_ha: number;
  removals_per_ha: number;
  yield_tonnes_per_ha: number;
}

/** Multi-harvest averaged result for LCA calculator */
export interface ArableMultiHarvestAveragedResult {
  averaged_impacts: ArableImpactResult;
  harvests_used: number[];
  method: 'single' | 'average_2yr' | 'median_3yr';
}

// ---------------------------------------------------------------------------
// Spray chemical types (mirrors vineyard spray diary pattern)
// ---------------------------------------------------------------------------

export type ArableChemicalType = 'fertiliser' | 'fungicide' | 'herbicide' | 'insecticide' | 'growth_regulator' | 'seed_treatment' | 'other';

export interface ArableSprayChemical {
  id: string;
  growing_profile_id: string;
  arable_field_id: string;
  organization_id: string;
  chemical_name: string;
  chemical_type: ArableChemicalType;
  unit: string;
  rate_per_ha: number;
  water_rate_l_per_ha: number | null;
  total_ha_sprayed: number;
  total_amount_used: number;
  applications_count: number;
  /** Nitrogen content of this product as sold (% by weight/volume). 0 for non-fertilisers. */
  n_content_percent: number;
  /** Maps to FertiliserType for calculator emission factors. Null for non-fertilisers. */
  fertiliser_subtype: 'synthetic_n' | 'organic_manure' | 'organic_compost' | 'mixed' | null;
  /** True when this chemical was enriched from arable_chemical_library. */
  library_matched: boolean;
  created_at: string;
  updated_at: string;
}

/** Draft type for form state - no DB identity fields */
export type ArableSprayChemicalDraft = Omit<
  ArableSprayChemical,
  'id' | 'growing_profile_id' | 'arable_field_id' | 'organization_id' | 'created_at' | 'updated_at'
>;

/** Row from arable_chemical_library */
export interface ArableChemicalLibraryRow {
  id: string;
  chemical_name: string;
  name_variants: string[];
  chemical_type: ArableChemicalType;
  n_content_percent: number;
  fertiliser_subtype: 'synthetic_n' | 'organic_manure' | 'organic_compost' | 'mixed' | null;
  active_ingredient: string | null;
  is_verified: boolean;
}

// ---------------------------------------------------------------------------
// Soil carbon evidence (uploaded lab reports)
// ---------------------------------------------------------------------------

export interface ArableSoilCarbonEvidence {
  id: string;
  growing_profile_id: string;
  arable_field_id: string;
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
