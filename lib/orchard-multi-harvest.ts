/**
 * Multi-Harvest Averaging for Orchard LCA
 *
 * Fruit production has high seasonal variability (weather, pest pressure, yield).
 * Best practice recommends using 3+ years of data with median averaging to
 * produce a representative environmental footprint.
 *
 * Pure function, no database access.
 *
 * Methodology:
 *   - 1 harvest: return that single result (method: 'single')
 *   - 2 harvests: arithmetic mean (method: 'average_2yr')
 *   - 3+ harvests: median (method: 'median_3yr')
 *
 * References:
 *   - GHG Protocol Product Standard: multi-year averaging guidance
 *   - FAO Fruit Tree Guidelines (2020)
 */

import { calculateOrchardImpacts } from './orchard-calculator';
import type {
  OrchardCalculatorInput,
  OrchardImpactResult,
  MultiHarvestAveragedResult,
} from './types/orchard';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface HarvestInput {
  harvest_year: number;
  input: OrchardCalculatorInput;
}

/**
 * Calculate and average impacts across multiple harvest years.
 *
 * @param harvestInputs - Array of harvest inputs (one per year)
 * @returns Averaged result with method and harvests used
 */
export function calculateMultiHarvestAverage(
  harvestInputs: HarvestInput[]
): MultiHarvestAveragedResult {
  if (harvestInputs.length === 0) {
    throw new Error('At least one harvest input is required');
  }

  const results = harvestInputs.map((h) => ({
    year: h.harvest_year,
    impacts: calculateOrchardImpacts(h.input),
  }));

  results.sort((a, b) => a.year - b.year);

  const harvestsUsed = results.map((r) => r.year);

  if (results.length === 1) {
    return {
      averaged_impacts: results[0].impacts,
      harvests_used: harvestsUsed,
      method: 'single',
    };
  }

  const impacts = results.map((r) => r.impacts);

  if (results.length === 2) {
    return {
      averaged_impacts: averageImpacts(impacts),
      harvests_used: harvestsUsed,
      method: 'average_2yr',
    };
  }

  return {
    averaged_impacts: medianImpacts(impacts),
    harvests_used: harvestsUsed,
    method: 'median_3yr',
  };
}

// ---------------------------------------------------------------------------
// Averaging helpers
// ---------------------------------------------------------------------------

function averageImpacts(results: OrchardImpactResult[]): OrchardImpactResult {
  const n = results.length;
  return combineImpacts(results, (values) => values.reduce((a, b) => a + b, 0) / n);
}

function medianImpacts(results: OrchardImpactResult[]): OrchardImpactResult {
  return combineImpacts(results, getMedian);
}

function getMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function combineImpacts(
  results: OrchardImpactResult[],
  reduce: (values: number[]) => number
): OrchardImpactResult {
  const first = results[0];

  return {
    flag_emissions: {
      n2o_direct_co2e: reduce(results.map((r) => r.flag_emissions.n2o_direct_co2e)),
      n2o_indirect_co2e: reduce(results.map((r) => r.flag_emissions.n2o_indirect_co2e)),
      n2o_crop_residue_co2e: reduce(results.map((r) => r.flag_emissions.n2o_crop_residue_co2e)),
      luc_co2e: reduce(results.map((r) => r.flag_emissions.luc_co2e)),
      land_use_m2: reduce(results.map((r) => r.flag_emissions.land_use_m2)),
      total_flag_co2e: reduce(results.map((r) => r.flag_emissions.total_flag_co2e)),
    },
    flag_removals: {
      soil_carbon_co2e: reduce(results.map((r) => r.flag_removals.soil_carbon_co2e)),
      methodology: first.flag_removals.methodology,
      is_verified: results.every((r) => r.flag_removals.is_verified),
      removals_meet_lsr_standard: results.every((r) => r.flag_removals.removals_meet_lsr_standard),
      removals_warning: first.flag_removals.removals_warning,
    },
    non_flag_emissions: {
      fertiliser_production_co2e: reduce(results.map((r) => r.non_flag_emissions.fertiliser_production_co2e)),
      machinery_fuel_co2e: reduce(results.map((r) => r.non_flag_emissions.machinery_fuel_co2e)),
      irrigation_energy_co2e: reduce(results.map((r) => r.non_flag_emissions.irrigation_energy_co2e)),
      pesticide_production_co2e: reduce(results.map((r) => r.non_flag_emissions.pesticide_production_co2e)),
      transport_co2e: reduce(results.map((r) => r.non_flag_emissions.transport_co2e)),
      total_non_flag_co2e: reduce(results.map((r) => r.non_flag_emissions.total_non_flag_co2e)),
    },
    water_m3: reduce(results.map((r) => r.water_m3)),
    water_scarcity_m3_eq: reduce(results.map((r) => r.water_scarcity_m3_eq)),
    freshwater_ecotoxicity: reduce(results.map((r) => r.freshwater_ecotoxicity)),
    terrestrial_ecotoxicity: reduce(results.map((r) => r.terrestrial_ecotoxicity)),
    human_toxicity_non_carcinogenic: reduce(results.map((r) => r.human_toxicity_non_carcinogenic)),
    freshwater_eutrophication: reduce(results.map((r) => r.freshwater_eutrophication)),
    n2o_kg: reduce(results.map((r) => r.n2o_kg)),
    co2_fossil_kg: reduce(results.map((r) => r.co2_fossil_kg)),
    total_emissions_per_kg: reduce(results.map((r) => r.total_emissions_per_kg)),
    removals_per_kg: reduce(results.map((r) => r.removals_per_kg)),
    total_emissions: reduce(results.map((r) => r.total_emissions)),
    total_removals: reduce(results.map((r) => r.total_removals)),
    data_quality_grade: getWorstGrade(results.map((r) => r.data_quality_grade)),
    methodology_notes: buildMultiHarvestNotes(results, first.methodology_notes),
  };
}

function getWorstGrade(grades: Array<'HIGH' | 'MEDIUM' | 'LOW'>): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (grades.includes('LOW')) return 'LOW';
  if (grades.includes('MEDIUM')) return 'MEDIUM';
  return 'HIGH';
}

function buildMultiHarvestNotes(
  results: OrchardImpactResult[],
  baseNotes: string
): string {
  const n = results.length;
  if (n <= 1) return baseNotes;

  const method = n === 2 ? '2-year arithmetic mean' : `${n}-year median`;
  return `Multi-harvest averaging (${method}). ${baseNotes}`;
}
