/**
 * Maturation/Aging Profile types for spirits and wine
 *
 * Maturation is modeled as a separate profile (not a material_type) because
 * barrel aging is a time-based process with compound volume loss (angel's share),
 * not a bill-of-materials item.
 */

// ---------------------------------------------------------------------------
// Barrel & environment enums
// ---------------------------------------------------------------------------

export type BarrelType =
  | 'american_oak_200'
  | 'french_oak_225'
  | 'american_oak_500'
  | 'custom';

export type ClimateZone = 'temperate' | 'continental' | 'tropical';

export type EnergySource =
  | 'grid_electricity'
  | 'natural_gas'
  | 'renewable'
  | 'mixed';

export type AllocationMethod = 'cut_off' | 'avoided_burden';

// ---------------------------------------------------------------------------
// Database row — mirrors public.maturation_profiles
// ---------------------------------------------------------------------------

export interface MaturationProfile {
  id: string;
  product_id: number;
  organization_id: string;

  // Barrel specification
  barrel_type: BarrelType;
  barrel_volume_litres: number;
  barrel_use_number: number; // 1 = new, 2+ = reused
  barrel_co2e_new: number | null; // Override for custom barrels (kg CO2e per barrel)

  // Maturation parameters
  aging_duration_months: number;
  angel_share_percent_per_year: number;
  climate_zone: ClimateZone;
  fill_volume_litres: number;
  number_of_barrels: number;

  // Warehouse energy
  warehouse_energy_kwh_per_barrel_year: number;
  warehouse_energy_source: EnergySource;

  // Allocation method
  allocation_method: AllocationMethod;

  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Calculator output
// ---------------------------------------------------------------------------

export interface MaturationImpactResult {
  // Barrel allocation impact
  barrel_co2e_per_litre: number;
  barrel_total_co2e: number;

  // Angel's share (VOC emissions — not GWP, goes to photochemical ozone)
  angel_share_volume_loss_litres: number;
  angel_share_loss_percent_total: number;
  angel_share_voc_kg: number;
  angel_share_photochemical_ozone: number; // kg NMVOC eq

  // Warehouse energy impact
  warehouse_co2e_total: number;
  warehouse_co2e_per_litre: number;

  // Volume adjustment
  output_volume_litres: number;
  volume_loss_factor: number; // output / input ratio (0-1)

  // Total maturation climate impact (barrel + warehouse; NOT angel's share)
  total_maturation_co2e: number;
  total_maturation_co2e_per_litre_output: number;

  // Provenance
  methodology_notes: string;
}

// ---------------------------------------------------------------------------
// Constants & defaults
// ---------------------------------------------------------------------------

/** Default angel's share % per year by climate zone */
export const ANGEL_SHARE_DEFAULTS: Record<ClimateZone, number> = {
  temperate: 2.0,   // Scotland, Ireland, France
  continental: 5.0,  // Kentucky, Spain
  tropical: 12.0,    // Caribbean, India, Taiwan
};

/** Manufacturing CO2e per NEW barrel (kg CO2e) */
export const BARREL_CO2E_DEFAULTS: Record<string, number> = {
  american_oak_200: 40,  // 200L bourbon barrel
  french_oak_225: 55,    // 225L barrique
  american_oak_500: 65,  // 500L puncheon
};

/** Standard barrel volumes (litres) */
export const BARREL_VOLUME_DEFAULTS: Record<string, number> = {
  american_oak_200: 200,
  french_oak_225: 225,
  american_oak_500: 500,
};

/** Human-readable barrel labels */
export const BARREL_TYPE_LABELS: Record<BarrelType, string> = {
  american_oak_200: 'American Oak (200L Barrel)',
  french_oak_225: 'French Oak (225L Barrique)',
  american_oak_500: 'American Oak (500L Puncheon)',
  custom: 'Custom Vessel',
};

/** Human-readable climate zone labels */
export const CLIMATE_ZONE_LABELS: Record<ClimateZone, string> = {
  temperate: 'Temperate (Scotland, Ireland, France)',
  continental: 'Continental (Kentucky, Spain)',
  tropical: 'Tropical (Caribbean, India, Taiwan)',
};

/** Human-readable energy source labels */
export const ENERGY_SOURCE_LABELS: Record<EnergySource, string> = {
  grid_electricity: 'Grid Electricity',
  natural_gas: 'Natural Gas',
  renewable: 'Renewable',
  mixed: 'Mixed (~50% Renewable)',
};
