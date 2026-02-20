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
// calculation time using the warehouse country code (HIGH FIX #11).
// Using a hardcoded UK factor for a Kentucky or Speyside warehouse would
// produce incorrect results (US grid: 0.386 vs UK: 0.207).

const NON_ELECTRIC_ENERGY_FACTORS: Record<Exclude<EnergySource, 'grid_electricity'>, number> = {
  natural_gas: 0.183,   // DEFRA 2025 natural gas (kg CO2e/kWh)
  renewable: 0.0,       // Zero operational emissions
  mixed: 0.120,         // Approximate 50% renewable blend — ~50% renewable
};

// Angel's share ethanol assumptions
// Source: SWA (2006) Life Cycle Assessment of Scotch Whisky; Pettersson (2016)
const DEFAULT_ABV = 0.63;        // Typical cask-strength fill ABV (63%) — industry standard fill strength
const ETHANOL_DENSITY = 0.789;   // kg/L at 20°C — NIST standard value

/**
 * Ethanol Photochemical Ozone Creation Potential (POCP)
 * Units: kg NMVOC-equivalent per kg ethanol
 *
 * Source: van Zelm et al. (2008) "European characterization factors for human
 * health damage of PM10 and ozone in life cycle impact assessment"
 * Int J Life Cycle Assess 13:299–306. Ethanol POCP ≈ 0.40 kg NMVOC-eq/kg.
 *
 * Range in literature: 0.30–0.60 kg NMVOC-eq/kg (sensitivity should be noted
 * in LCA reports). ReCiPe midpoint method uses 0.40 as central estimate.
 *
 * Note: This is a photochemical ozone formation factor, NOT a GWP climate
 * factor. Angel's share is NOT added to the CO2e climate total.
 */
const ETHANOL_POCP = 0.40;

/**
 * Reconditioning CO2e for reused barrels (kg CO2e per barrel per use)
 *
 * Covers: hot water cleaning, sulphur candle treatment, minor repairs.
 * Source: SWA (2006) estimated ~0.3–0.7 kg CO2e for reconditioning;
 * Pettersson (2016) uses 0.5 kg. We use 0.5 as central estimate.
 * Uncertainty: ±50% (highly variable by cooperage practice).
 */
const REUSED_BARREL_CO2E = 0.5;

// ---------------------------------------------------------------------------
// Main calculator
// ---------------------------------------------------------------------------

/**
 * Calculate maturation impacts.
 *
 * @param profile - Maturation profile from database
 * @param warehouseCountryCode - ISO 3166-1 alpha-2 country code for the warehouse
 *   location. Used to select the correct electricity grid emission factor.
 *   HIGH FIX #11: Previously used facility country (wrong) or hardcoded UK (wrong).
 *   Pass the warehouse country explicitly for accuracy. Defaults to global average
 *   (0.490 kg CO2e/kWh) when not specified.
 */
export function calculateMaturationImpacts(
  profile: MaturationProfile,
  warehouseCountryCode?: string | null
): MaturationImpactResult {
  const agingYears = profile.aging_duration_months / 12;
  const totalFillVolume = profile.fill_volume_litres * profile.number_of_barrels;

  // ---- 1. BARREL ALLOCATION (Cut-off method) ----
  let barrelCO2ePerBarrel: number;

  if (profile.barrel_use_number === 1) {
    // New barrel: full manufacturing burden
    barrelCO2ePerBarrel = profile.barrel_co2e_new
      ?? BARREL_CO2E_DEFAULTS[profile.barrel_type]
      ?? 40;
  } else {
    // Reused barrel (cut-off): only reconditioning/cleaning
    barrelCO2ePerBarrel = REUSED_BARREL_CO2E;
  }

  const barrelTotalCO2e = barrelCO2ePerBarrel * profile.number_of_barrels;
  const barrelCO2ePerLitre = barrelTotalCO2e / totalFillVolume;

  // ---- 2. ANGEL'S SHARE ----
  // Compound volume loss: V_out = V_in × (1 - rate)^years
  const annualLossRate = profile.angel_share_percent_per_year / 100;
  const retentionFactor = Math.pow(1 - annualLossRate, agingYears);
  const outputVolume = totalFillVolume * retentionFactor;
  const volumeLoss = totalFillVolume - outputVolume;
  const totalLossPercent = (1 - retentionFactor) * 100;

  // Ethanol lost as VOC (NMVOC emission, NOT direct GHG)
  // Assume cask-strength ABV, ethanol density 0.789 kg/L
  const ethanolLostLitres = volumeLoss * DEFAULT_ABV;
  const ethanolLostKg = ethanolLostLitres * ETHANOL_DENSITY;

  // POCP characterization: ethanol → photochemical ozone formation
  const vocKg = ethanolLostKg;
  const photochemicalOzone = ethanolLostKg * ETHANOL_POCP;

  // ---- 3. WAREHOUSE ENERGY ----
  const warehouseKwhTotal =
    profile.warehouse_energy_kwh_per_barrel_year *
    profile.number_of_barrels *
    agingYears;

  // HIGH FIX #11: Use the warehouse country's grid factor for electricity,
  // not the facility's production country (which was the previous default).
  // A Scotch whisky warehouse in Scotland (GB: 0.207) vs a Kentucky bourbon
  // warehouse (US: 0.386) produce very different electricity emissions.
  // For non-electric energy sources, use the fuel-specific DEFRA factors.
  let gridFactor: number;
  if (profile.warehouse_energy_source === 'grid_electricity') {
    const gridFactorResult = getGridFactor(warehouseCountryCode ?? null, 'global');
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
    // Unknown energy source — use global average as conservative fallback
    gridFactor = GLOBAL_AVERAGE_GRID_FACTOR;
    console.warn(`[calculateMaturationImpacts] Unknown warehouse_energy_source '${profile.warehouse_energy_source}', using global average grid factor.`);
  }
  const warehouseCO2eTotal = warehouseKwhTotal * gridFactor;
  const warehouseCO2ePerLitre = outputVolume > 0 ? warehouseCO2eTotal / outputVolume : 0;

  // ---- 4. TOTALS ----
  // Angel's share is NMVOC → photochemical ozone, NOT counted in climate GWP
  const totalMaturationCO2e = barrelTotalCO2e + warehouseCO2eTotal;
  const totalPerLitreOutput = outputVolume > 0 ? totalMaturationCO2e / outputVolume : 0;

  return {
    barrel_co2e_per_litre: barrelCO2ePerLitre,
    barrel_total_co2e: barrelTotalCO2e,

    angel_share_volume_loss_litres: volumeLoss,
    angel_share_loss_percent_total: totalLossPercent,
    angel_share_voc_kg: vocKg,
    angel_share_photochemical_ozone: photochemicalOzone,

    warehouse_co2e_total: warehouseCO2eTotal,
    warehouse_co2e_per_litre: warehouseCO2ePerLitre,

    output_volume_litres: outputVolume,
    volume_loss_factor: retentionFactor,

    total_maturation_co2e: totalMaturationCO2e,
    total_maturation_co2e_per_litre_output: totalPerLitreOutput,

    methodology_notes: buildMethodologyNotes(profile, agingYears),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMethodologyNotes(profile: MaturationProfile, agingYears: number): string {
  const parts = [
    'Cut-off allocation (ISO 14044).',
    `Barrel: ${profile.barrel_type} (use #${profile.barrel_use_number}).`,
    `Aging: ${profile.aging_duration_months} months (${agingYears.toFixed(1)} years).`,
    `Angel's share: ${profile.angel_share_percent_per_year}%/yr (${profile.climate_zone}).`,
    `Warehouse: ${profile.warehouse_energy_kwh_per_barrel_year} kWh/barrel/yr (${profile.warehouse_energy_source}).`,
  ];
  return parts.join(' ');
}
