/**
 * EPR Compliance Tool — Fee Calculator
 *
 * Calculates EPR waste management fees based on packaging weight, material
 * type, RAM rating, and fee year. Handles DRS exclusions.
 */

import type { EPRRAMRating } from '@/lib/types/lca';
import type { RPDMaterialCode, EPRFeeRate } from './types';

// =============================================================================
// Core Fee Calculation
// =============================================================================

/**
 * Calculate the EPR waste management fee for a single packaging line.
 *
 * @param weightKg - Total weight of packaging in kg
 * @param feeRate - Fee rate record for the material and year
 * @param ramRating - RAM recyclability rating (used for modulated years)
 * @param isDRSExcluded - Whether this item is excluded from EPR fees (DRS)
 * @returns Fee in GBP
 */
export function calculateLineFee(
  weightKg: number,
  feeRate: EPRFeeRate,
  ramRating: EPRRAMRating | null | undefined,
  isDRSExcluded: boolean
): number {
  // DRS-excluded items pay zero EPR fees
  if (isDRSExcluded) return 0;

  // Safety: no fee for zero or negative weight
  if (weightKg <= 0) return 0;

  const weightTonnes = weightKg / 1000;

  // Modulated year: use green/amber/red rates
  if (feeRate.is_modulated && ramRating) {
    const rateMap: Record<string, number | null> = {
      green: feeRate.green_rate_per_tonne,
      amber: feeRate.amber_rate_per_tonne,
      red: feeRate.red_rate_per_tonne,
    };
    const rate = rateMap[ramRating];
    if (rate != null) {
      return roundToTwoDecimals(weightTonnes * rate);
    }
  }

  // Modulated year but no RAM rating: default to RED (unassessed = worst case)
  if (feeRate.is_modulated && !ramRating && feeRate.red_rate_per_tonne != null) {
    return roundToTwoDecimals(weightTonnes * feeRate.red_rate_per_tonne);
  }

  // Flat rate (Year 1)
  if (feeRate.flat_rate_per_tonne != null) {
    return roundToTwoDecimals(weightTonnes * feeRate.flat_rate_per_tonne);
  }

  return 0;
}

/**
 * Get the applicable fee rate per tonne for display purposes.
 */
export function getApplicableRate(
  feeRate: EPRFeeRate,
  ramRating: EPRRAMRating | null | undefined,
  isDRSExcluded: boolean
): number {
  if (isDRSExcluded) return 0;

  if (feeRate.is_modulated && ramRating) {
    const rateMap: Record<string, number | null> = {
      green: feeRate.green_rate_per_tonne,
      amber: feeRate.amber_rate_per_tonne,
      red: feeRate.red_rate_per_tonne,
    };
    return rateMap[ramRating] ?? feeRate.flat_rate_per_tonne ?? 0;
  }

  if (feeRate.is_modulated && !ramRating) {
    return feeRate.red_rate_per_tonne ?? feeRate.flat_rate_per_tonne ?? 0;
  }

  return feeRate.flat_rate_per_tonne ?? 0;
}

/**
 * Look up the fee rate for a material in a given year.
 */
export function findFeeRate(
  feeRates: EPRFeeRate[],
  materialCode: RPDMaterialCode,
  feeYear: string
): EPRFeeRate | undefined {
  return feeRates.find(r => r.material_code === materialCode && r.fee_year === feeYear);
}

// =============================================================================
// Helpers
// =============================================================================

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}
