/**
 * Maturation Impact Calculator
 *
 * Calculates the environmental impact of spirit/wine maturation (barrel aging).
 *
 * Three impact categories:
 *   1. Barrel allocation — manufacturing CO2e (cut-off: new barrel = full burden)
 *   2. Angel's share   — ethanol evaporation as NMVOC → photochemical ozone formation
 *   3. Warehouse energy — kWh-based CO2e via grid emission factors
 *
 * Per-bottle allocation correctness depends on modelling ABV dilution at
 * bottling: spirits are cask-filled at higher strength (~63% Scotch, 70% cognac)
 * and diluted with water to bottle strength (~46%, ~40%). The water addition
 * inflates the bottled-volume bottle yield by (cask_abv / bottle_abv). Without
 * this, per-bottle maturation CO2e is over-stated by 40-75% for typical spirits.
 *
 * Methodology references:
 *   - SWA (2006) Life Cycle Assessment of Scotch Whisky
 *   - Pettersson (2016) LCA of Swedish single malt whisky
 *   - ISO 14044 cut-off allocation for multi-use barrels
 *   - DEFRA 2025 UK conversion factors for grid electricity
 */

import type {
  MaturationProfile,
  MaturationImpactResult,
  EnergySource,
} from './types/maturation';

import {
  BARREL_CO2E_DEFAULTS,
} from './types/maturation';

import { getGridFactor, GLOBAL_AVERAGE_GRID_FACTOR } from './grid-emission-factors';

// ---------------------------------------------------------------------------
// Non-electricity energy emission factors (kg CO2e per kWh) — DEFRA 2025
// ---------------------------------------------------------------------------
// Note: grid_electricity factor is NOT stored here — it is resolved at
// calculation time using the warehouse country code.

const NON_ELECTRIC_ENERGY_FACTORS: Record<Exclude<EnergySource, 'grid_electricity'>, number> = {
  natural_gas: 0.183,   // DEFRA 2025 natural gas (kg CO2e/kWh)
  renewable: 0.0,       // Zero operational emissions
  mixed: 0.120,         // Approximate 50% renewable blend — ~50% renewable
};

// Angel's share ethanol assumptions
// Source: SWA (2006) Life Cycle Assessment of Scotch Whisky; Pettersson (2016)
/** Typical cask-strength fill ABV as percent — industry fallback when unknown. */
const DEFAULT_CASK_FILL_ABV_PERCENT = 63;
const ETHANOL_DENSITY = 0.789;   // kg/L at 20°C — NIST standard value

/**
 * Ethanol Photochemical Ozone Creation Potential (POCP)
 * Units: kg NMVOC-equivalent per kg ethanol
 *
 * Source: van Zelm et al. (2008) "European characterization factors for human
 * health damage of PM10 and ozone in life cycle impact assessment"
 * Int J Life Cycle Assess 13:299–306. Ethanol POCP ≈ 0.40 kg NMVOC-eq/kg.
 */
const ETHANOL_POCP = 0.40;

/**
 * Reconditioning CO2e for reused barrels (kg CO2e per barrel per use)
 *
 * Covers: hot water cleaning, sulphur candle treatment, minor repairs.
 * Source: SWA (2006) estimated ~0.3–0.7 kg CO2e for reconditioning;
 * Pettersson (2016) uses 0.5 kg. We use 0.5 as central estimate.
 */
const REUSED_BARREL_CO2E = 0.5;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MaturationCalculationOptions {
  /**
   * ISO 3166-1 alpha-2 country code for the warehouse. Drives the electricity
   * grid emission factor for warehouse_energy when source = grid_electricity.
   * If omitted, falls back to profile.warehouse_country_code, then the global
   * average grid factor.
   */
  warehouseCountryCode?: string | null;
  /**
   * Cask-fill ABV as PERCENT 0-100 (e.g. 63.5 for Scotch). If omitted, falls
   * back to profile.cask_fill_abv_percent, then 63%.
   */
  caskFillAbvPercent?: number | null;
  /**
   * Final bottled ABV as PERCENT 0-100 (e.g. 46 for Scotch). If omitted, the
   * calculator assumes no dilution (bottle ABV = cask ABV). Pass the product's
   * alcohol_content_abv for correct per-bottle allocation.
   */
  bottleAbvPercent?: number | null;
}

// ---------------------------------------------------------------------------
// Main calculator
// ---------------------------------------------------------------------------

/**
 * Calculate maturation impacts.
 *
 * @param profile - Maturation profile from database
 * @param optionsOrLegacyCountry - Options object, OR a legacy positional ISO2
 *   country code string (preserved for backward compatibility with existing
 *   callers that predate the options-object form).
 * @param legacyAbvFraction - Legacy positional ABV as FRACTION 0-1 (e.g. 0.63).
 *   Only used when the second argument is the legacy string/null form. Ignored
 *   when passing an options object.
 */
export function calculateMaturationImpacts(
  profile: MaturationProfile,
  optionsOrLegacyCountry: MaturationCalculationOptions | string | null = {},
  legacyAbvFraction?: number
): MaturationImpactResult {
  // Backward-compat: (profile, 'GB', 0.63) form from pre-options callers.
  const options: MaturationCalculationOptions =
    typeof optionsOrLegacyCountry === 'string' || optionsOrLegacyCountry === null
      ? {
          warehouseCountryCode: optionsOrLegacyCountry ?? null,
          caskFillAbvPercent:
            typeof legacyAbvFraction === 'number' ? legacyAbvFraction * 100 : undefined,
        }
      : optionsOrLegacyCountry;

  const caskAbvPct =
    (options.caskFillAbvPercent ?? profile.cask_fill_abv_percent ?? DEFAULT_CASK_FILL_ABV_PERCENT) as number;
  // If bottle ABV is unknown, assume no dilution (conservative for per-bottle CO2e)
  const bottleAbvPct = (options.bottleAbvPercent ?? caskAbvPct) as number;

  if (caskAbvPct <= 0 || bottleAbvPct <= 0) {
    throw new Error(`Invalid ABV: cask=${caskAbvPct}%, bottle=${bottleAbvPct}%`);
  }

  // Dilution factor: water added at bottling inflates bottled volume.
  // Scotch 63.5 / 46 = 1.380   |   Cognac 70 / 40 = 1.750   |   Wine 14/14 = 1.0
  const dilutionFactor = caskAbvPct / bottleAbvPct;

  const agingYears = profile.aging_duration_months / 12;
  const totalFillVolume = profile.fill_volume_litres * profile.number_of_barrels;

  // ---- 1. BARREL ALLOCATION (Cut-off method) ----
  let barrelCO2ePerBarrel: number;
  if (profile.barrel_use_number === 1) {
    // New barrel: full manufacturing burden
    barrelCO2ePerBarrel =
      profile.barrel_co2e_new ?? BARREL_CO2E_DEFAULTS[profile.barrel_type] ?? 40;
  } else {
    // Reused barrel (cut-off): only reconditioning/cleaning
    barrelCO2ePerBarrel = REUSED_BARREL_CO2E;
  }

  const barrelTotalCO2e = barrelCO2ePerBarrel * profile.number_of_barrels;
  const barrelCO2ePerLitre = barrelTotalCO2e / totalFillVolume;

  // ---- 2. ANGEL'S SHARE ----
  // Compound volume loss at cask strength: V_out = V_in × (1 - rate)^years
  const annualLossRate = profile.angel_share_percent_per_year / 100;
  const retentionFactor = Math.pow(1 - annualLossRate, agingYears);
  const outputCaskStrengthLitres = totalFillVolume * retentionFactor;
  const volumeLoss = totalFillVolume - outputCaskStrengthLitres;
  const totalLossPercent = (1 - retentionFactor) * 100;

  // Bottled volume after water addition at bottling strength
  const outputBottledLitres = outputCaskStrengthLitres * dilutionFactor;

  // Ethanol lost as VOC (NMVOC emission, NOT direct GHG)
  const ethanolLostLitres = volumeLoss * (caskAbvPct / 100);
  const ethanolLostKg = ethanolLostLitres * ETHANOL_DENSITY;
  const vocKg = ethanolLostKg;
  const photochemicalOzone = ethanolLostKg * ETHANOL_POCP;

  // ---- 3. WAREHOUSE ENERGY ----
  const warehouseKwhTotal =
    profile.warehouse_energy_kwh_per_barrel_year *
    profile.number_of_barrels *
    agingYears;

  // Country priority: options arg > profile column > null (global fallback)
  const resolvedWarehouseCountry =
    options.warehouseCountryCode ?? profile.warehouse_country_code ?? null;

  let gridFactor: number;
  if (profile.warehouse_energy_source === 'grid_electricity') {
    const gridFactorResult = getGridFactor(resolvedWarehouseCountry, 'global');
    gridFactor = gridFactorResult.factor;
    if (gridFactorResult.isEstimated) {
      console.warn(
        `[calculateMaturationImpacts] Warehouse grid factor for ${profile.barrel_type}: ` +
        `${gridFactorResult.source} (${gridFactor} kg CO2e/kWh). ` +
        `Set warehouseCountryCode for country-specific accuracy.`
      );
    }
  } else if (profile.warehouse_energy_source === 'renewable') {
    gridFactor = NON_ELECTRIC_ENERGY_FACTORS.renewable;
  } else if (profile.warehouse_energy_source === 'natural_gas') {
    gridFactor = NON_ELECTRIC_ENERGY_FACTORS.natural_gas;
  } else if (profile.warehouse_energy_source === 'mixed') {
    gridFactor = NON_ELECTRIC_ENERGY_FACTORS.mixed;
  } else {
    gridFactor = GLOBAL_AVERAGE_GRID_FACTOR;
    console.warn(
      `[calculateMaturationImpacts] Unknown warehouse_energy_source '${profile.warehouse_energy_source}', using global average grid factor.`
    );
  }
  const warehouseCO2eTotal = warehouseKwhTotal * gridFactor;
  const warehouseCO2ePerLitre =
    outputBottledLitres > 0 ? warehouseCO2eTotal / outputBottledLitres : 0;

  // ---- 4. TOTALS ----
  // Angel's share is NMVOC → photochemical ozone, NOT counted in climate GWP
  const totalMaturationCO2e = barrelTotalCO2e + warehouseCO2eTotal;
  const totalPerLitreOutput =
    outputBottledLitres > 0 ? totalMaturationCO2e / outputBottledLitres : 0;

  return {
    barrel_co2e_per_litre: barrelCO2ePerLitre,
    barrel_total_co2e: barrelTotalCO2e,

    angel_share_volume_loss_litres: volumeLoss,
    angel_share_loss_percent_total: totalLossPercent,
    angel_share_voc_kg: vocKg,
    angel_share_photochemical_ozone: photochemicalOzone,

    warehouse_co2e_total: warehouseCO2eTotal,
    warehouse_co2e_per_litre: warehouseCO2ePerLitre,

    output_volume_litres: outputCaskStrengthLitres,
    output_volume_bottled_litres: outputBottledLitres,
    dilution_factor: dilutionFactor,
    volume_loss_factor: retentionFactor,

    total_maturation_co2e: totalMaturationCO2e,
    total_maturation_co2e_per_litre_output: totalPerLitreOutput,

    methodology_notes: buildMethodologyNotes(profile, agingYears, caskAbvPct, bottleAbvPct),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMethodologyNotes(
  profile: MaturationProfile,
  agingYears: number,
  caskAbvPct: number,
  bottleAbvPct: number
): string {
  const parts = [
    'Cut-off allocation (ISO 14044).',
    `Barrel: ${profile.barrel_type} (use #${profile.barrel_use_number}).`,
    `Aging: ${profile.aging_duration_months} months (${agingYears.toFixed(1)} years).`,
    `Angel's share: ${profile.angel_share_percent_per_year}%/yr (${profile.climate_zone}).`,
    `Warehouse: ${profile.warehouse_energy_kwh_per_barrel_year} kWh/barrel/yr (${profile.warehouse_energy_source}).`,
    `Cask fill ${caskAbvPct}% ABV → bottle ${bottleAbvPct}% ABV (dilution ${(caskAbvPct / bottleAbvPct).toFixed(2)}×).`,
  ];
  return parts.join(' ');
}
