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

  /**
   * Cask-fill ABV as percent (e.g. 63.5 for Scotch). Spirits are typically
   * filled into casks at higher strength than they are bottled at; water is
   * added at bottling. Drives dilution factor for per-bottle allocation.
   * NULL falls back to category default then 63%.
   */
  cask_fill_abv_percent: number | null;

  // Warehouse energy
  warehouse_energy_kwh_per_barrel_year: number;
  warehouse_energy_source: EnergySource;
  /** ISO 3166-1 alpha-2 country code for the maturation warehouse. */
  warehouse_country_code: string | null;

  // Allocation method
  allocation_method: AllocationMethod;

  // Optional: exact bottle count for per-unit allocation (single-cask bottlings)
  // When null, per-bottle allocation is derived from output_volume ÷ product bottle size
  bottles_produced: number | null;

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

  /** Bottled volume after water addition at bottling strength (L). */
  output_volume_bottled_litres: number;
  /** Dilution factor applied at bottling: cask_abv / bottle_abv (>= 1). */
  dilution_factor: number;

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

/**
 * Manufacturing CO2e per NEW barrel (kg CO2e per barrel, cradle-to-cooperage-gate)
 *
 * Covers: timber harvesting, kiln-drying, cooperage energy, barrel transport to distillery.
 * Does NOT include barrel transport from forest to sawmill (minor, <5% of total).
 *
 * Sources:
 *   - American oak (200L): ~35–45 kg CO2e. Central estimate 40 kg.
 *     Source: Renouf & Wegener (2007) approximated from Ecoinvent 3.x "wooden barrel" dataset;
 *     SWA (2006) LCA uses 38 kg for ex-bourbon barrel.
 *   - French oak (225L barrique): ~50–60 kg CO2e. Central estimate 55 kg.
 *     Source: French oak has higher transport distance (France → distillery) and
 *     denser wood requiring more energy to work. Estimate from SWA (2006) + Pettersson (2016).
 *   - American oak (500L puncheon): ~60–70 kg CO2e. Central estimate 65 kg.
 *     Source: Scaled from 200L barrel by volume ratio with cooperage efficiency factor.
 *
 * Uncertainty: ±25% — varies significantly by cooperage, wood origin, kiln type.
 * These are secondary estimates; primary data from cooperage suppliers preferred.
 *
 * Fossil/biogenic split: ~40% fossil (cooperage energy + transport), 60% biogenic
 * (wood carbon in offcuts + drying). See product-lca-calculator.ts barrel material record.
 */
export const BARREL_CO2E_DEFAULTS: Record<string, number> = {
  american_oak_200: 40,  // 200L bourbon barrel — SWA (2006) / Ecoinvent 3.x
  french_oak_225: 55,    // 225L barrique — SWA (2006) + Pettersson (2016) adjusted
  american_oak_500: 65,  // 500L puncheon — scaled estimate from 200L baseline
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

// ---------------------------------------------------------------------------
// Smart defaults by product category
// ---------------------------------------------------------------------------

/**
 * Category-driven defaults for the maturation form. When a user opens the
 * Maturation card on a new aged-spirit or wine product, these values pre-fill
 * the form based on the product_category so distillers see a sensible starting
 * point instead of a blank form. Regex-based substring matching handles free
 * text categories like "Single Malt Whisky" that do not exactly match the
 * canonical PRODUCT_CATEGORIES enum.
 */
export interface SpiritTypeDefaults {
  barrel_type: BarrelType;
  cask_fill_abv_percent: number;
  bottle_abv_percent: number;
  climate_zone: ClimateZone;
  aging_months: number;
  /** 1 = new, 2 = refill (cut-off, near-zero embodied burden). */
  barrel_use_number: number;
}

/**
 * Rules ordered most-specific first. First substring match wins.
 *
 * Order matters: bourbon/rye are whiskies, so those rules must precede the
 * generic whisky rule. Similarly "Single Malt Whisky" needs to match the
 * whisky rule via case-insensitive substring test.
 */
const SPIRIT_DEFAULT_RULES: Array<[RegExp, SpiritTypeDefaults]> = [
  // Bourbon and rye: new American oak 200L, Kentucky continental climate
  [/bourbon/i, {
    barrel_type: 'american_oak_200',
    cask_fill_abv_percent: 62.5,
    bottle_abv_percent: 45,
    climate_zone: 'continental',
    aging_months: 48,
    barrel_use_number: 1,
  }],
  [/rye/i, {
    barrel_type: 'american_oak_200',
    cask_fill_abv_percent: 62.5,
    bottle_abv_percent: 45,
    climate_zone: 'continental',
    aging_months: 48,
    barrel_use_number: 1,
  }],
  // Scotch, Irish, Japanese, single malt, blended. First-fill ex-bourbon barrels.
  [/whisk(e)?y|scotch/i, {
    barrel_type: 'american_oak_200',
    cask_fill_abv_percent: 63.5,
    bottle_abv_percent: 46,
    climate_zone: 'temperate',
    aging_months: 120,
    barrel_use_number: 2,
  }],
  // Cognac, armagnac: new French oak, 70% cask fill, heavy dilution to 40%
  [/cognac|armagnac/i, {
    barrel_type: 'french_oak_225',
    cask_fill_abv_percent: 70,
    bottle_abv_percent: 40,
    climate_zone: 'temperate',
    aging_months: 72,
    barrel_use_number: 1,
  }],
  [/calvados/i, {
    barrel_type: 'french_oak_225',
    cask_fill_abv_percent: 70,
    bottle_abv_percent: 40,
    climate_zone: 'temperate',
    aging_months: 48,
    barrel_use_number: 2,
  }],
  [/brandy/i, {
    barrel_type: 'french_oak_225',
    cask_fill_abv_percent: 70,
    bottle_abv_percent: 40,
    climate_zone: 'temperate',
    aging_months: 60,
    barrel_use_number: 1,
  }],
  [/rum/i, {
    barrel_type: 'american_oak_200',
    cask_fill_abv_percent: 65,
    bottle_abv_percent: 40,
    climate_zone: 'tropical',
    aging_months: 36,
    barrel_use_number: 2,
  }],
  [/tequila|mezcal/i, {
    barrel_type: 'american_oak_200',
    cask_fill_abv_percent: 55,
    bottle_abv_percent: 40,
    climate_zone: 'continental',
    aging_months: 12,
    barrel_use_number: 2,
  }],
  // Wines: no dilution at bottling, cask ABV == bottle ABV
  [/red wine/i, {
    barrel_type: 'french_oak_225',
    cask_fill_abv_percent: 14,
    bottle_abv_percent: 14,
    climate_zone: 'temperate',
    aging_months: 18,
    barrel_use_number: 2,
  }],
  [/white wine/i, {
    barrel_type: 'french_oak_225',
    cask_fill_abv_percent: 13,
    bottle_abv_percent: 13,
    climate_zone: 'temperate',
    aging_months: 12,
    barrel_use_number: 2,
  }],
];

const SPIRIT_DEFAULT_FALLBACK: SpiritTypeDefaults = {
  barrel_type: 'american_oak_200',
  cask_fill_abv_percent: 63,
  bottle_abv_percent: 40,
  climate_zone: 'temperate',
  aging_months: 36,
  barrel_use_number: 1,
};

/**
 * Resolve smart defaults for the maturation form from a free-text product
 * category. Returns a sensible generic fallback when the category is missing
 * or does not match any known spirit type.
 */
export function getSpiritTypeDefaults(productCategory?: string | null): SpiritTypeDefaults {
  if (!productCategory) return SPIRIT_DEFAULT_FALLBACK;
  const match = SPIRIT_DEFAULT_RULES.find(([re]) => re.test(productCategory));
  return match ? match[1] : SPIRIT_DEFAULT_FALLBACK;
}
