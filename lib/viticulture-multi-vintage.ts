/**
 * Multi-Vintage Averaging for Viticulture LCA
 *
 * Wine production has high vintage variability (weather, pest pressure, yield).
 * Best practice (OIV, AWRI) recommends using 3+ years of data with median
 * averaging to produce a representative environmental footprint.
 *
 * Pure function, no database access.
 *
 * Methodology:
 *   - 1 vintage: return that single result (method: 'single')
 *   - 2 vintages: arithmetic mean (method: 'average_2yr')
 *   - 3+ vintages: median (method: 'median_3yr')
 *
 * References:
 *   - OIV Resolution OIV-VITI 641-2020
 *   - AWRI Wine LCA Study (2018-21): 3-year data collection, median values
 *   - GHG Protocol Product Standard: multi-year averaging guidance
 */

import { calculateViticultureImpacts } from './viticulture-calculator';
import type {
  ViticultureCalculatorInput,
  ViticultureImpactResult,
  MultiVintageAveragedResult,
} from './types/viticulture';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface VintageInput {
  vintage_year: number;
  input: ViticultureCalculatorInput;
}

/**
 * Calculate and average impacts across multiple vintages.
 *
 * @param vintageInputs - Array of vintage inputs (one per year)
 * @returns Averaged result with method and vintages used
 */
export function calculateMultiVintageAverage(
  vintageInputs: VintageInput[]
): MultiVintageAveragedResult {
  if (vintageInputs.length === 0) {
    throw new Error('At least one vintage input is required');
  }

  // Calculate impacts for each vintage
  const results = vintageInputs.map((v) => ({
    year: v.vintage_year,
    impacts: calculateViticultureImpacts(v.input),
  }));

  // Sort by year for consistent ordering
  results.sort((a, b) => a.year - b.year);

  const vintagesUsed = results.map((r) => r.year);

  if (results.length === 1) {
    return {
      averaged_impacts: results[0].impacts,
      vintages_used: vintagesUsed,
      method: 'single',
    };
  }

  const impacts = results.map((r) => r.impacts);

  if (results.length === 2) {
    return {
      averaged_impacts: averageImpacts(impacts),
      vintages_used: vintagesUsed,
      method: 'average_2yr',
    };
  }

  // 3+ vintages: use median
  return {
    averaged_impacts: medianImpacts(impacts),
    vintages_used: vintagesUsed,
    method: 'median_3yr',
  };
}

// ---------------------------------------------------------------------------
// Averaging helpers
// ---------------------------------------------------------------------------

/** Arithmetic mean of all numeric fields across impact results */
function averageImpacts(results: ViticultureImpactResult[]): ViticultureImpactResult {
  const n = results.length;
  return combineImpacts(results, (values) => values.reduce((a, b) => a + b, 0) / n);
}

/** Median of all numeric fields across impact results */
function medianImpacts(results: ViticultureImpactResult[]): ViticultureImpactResult {
  return combineImpacts(results, getMedian);
}

/** Extract the median from a sorted array of numbers */
function getMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Combine multiple ViticultureImpactResult objects by applying a reducer
 * function to each numeric field. Non-numeric fields use the first result's value.
 */
function combineImpacts(
  results: ViticultureImpactResult[],
  reduce: (values: number[]) => number
): ViticultureImpactResult {
  // Median is used (rather than mean) per OIV Resolution VITI 564-2019 guidance
  // on multi-vintage environmental accounting. Median is more robust to outlier
  // vintages (e.g. frost years with abnormally low yield but normal input use).
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
    methodology_notes: buildMultiVintageNotes(results, first.methodology_notes),
  };
}

/** Return the lowest quality grade across all vintages */
function getWorstGrade(grades: Array<'HIGH' | 'MEDIUM' | 'LOW'>): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (grades.includes('LOW')) return 'LOW';
  if (grades.includes('MEDIUM')) return 'MEDIUM';
  return 'HIGH';
}

/** Build methodology notes for multi-vintage results */
function buildMultiVintageNotes(
  results: ViticultureImpactResult[],
  baseNotes: string
): string {
  const n = results.length;
  if (n <= 1) return baseNotes;

  const method = n === 2 ? '2-year arithmetic mean' : `${n}-year median`;
  return `Multi-vintage averaging (${method}). ${baseNotes}`;
}
