/**
 * EPR Compliance Tool — Obligation Checker
 *
 * Determines whether an organisation is classified as Large, Small,
 * or Below Threshold for EPR obligations.
 */

import type { ObligationResult, ObligationSize } from './types';
import { OBLIGATION_THRESHOLDS } from './constants';

/**
 * Determine the EPR obligation status of an organisation.
 *
 * Rules (from The Producer Responsibility Obligations Regulations 2024):
 * - Large: turnover >= £2M AND packaging tonnage >= 50t
 *   → Full fees + PRNs + biannual reporting
 * - Small: turnover >= £1M AND packaging tonnage >= 25t (but below Large)
 *   → Annual reporting only, no fees, no PRNs
 * - Below threshold: does not meet Small thresholds
 *   → No EPR obligations
 *
 * @param turnoverGBP - Annual turnover in GBP
 * @param packagingTonnes - Total packaging tonnage placed on market per year
 * @returns Obligation determination with explanation
 */
export function checkObligation(
  turnoverGBP: number | null | undefined,
  packagingTonnes: number | null | undefined
): ObligationResult {
  const turnover = turnoverGBP ?? 0;
  const tonnage = packagingTonnes ?? 0;

  // Check Large threshold first
  if (
    turnover >= OBLIGATION_THRESHOLDS.large.turnover_gbp &&
    tonnage >= OBLIGATION_THRESHOLDS.large.tonnage
  ) {
    return {
      size: 'large',
      turnover_gbp: turnover,
      total_packaging_tonnes: tonnage,
      reporting_frequency: 'biannual',
      pays_fees: true,
      pays_prns: true,
      explanation:
        `Your organisation is classified as a Large Producer (turnover £${formatNumber(turnover)} ≥ £2M and ${formatTonnes(tonnage)} ≥ 50 tonnes). ` +
        `You must report packaging data biannually (H1 and H2), pay EPR waste management fees, and purchase PRNs to meet recycling targets.`,
    };
  }

  // Check Small threshold
  if (
    turnover >= OBLIGATION_THRESHOLDS.small.turnover_gbp &&
    tonnage >= OBLIGATION_THRESHOLDS.small.tonnage
  ) {
    return {
      size: 'small',
      turnover_gbp: turnover,
      total_packaging_tonnes: tonnage,
      reporting_frequency: 'annual',
      pays_fees: false,
      pays_prns: false,
      explanation:
        `Your organisation is classified as a Small Producer (turnover £${formatNumber(turnover)} ≥ £1M and ${formatTonnes(tonnage)} ≥ 25 tonnes, but below Large thresholds). ` +
        `You must report packaging data annually (full year), but you do not pay EPR waste management fees or purchase PRNs.`,
    };
  }

  // Below threshold
  return {
    size: 'below_threshold',
    turnover_gbp: turnover,
    total_packaging_tonnes: tonnage,
    reporting_frequency: 'none',
    pays_fees: false,
    pays_prns: false,
    explanation:
      `Your organisation is below the EPR obligation thresholds (turnover £${formatNumber(turnover)}, ${formatTonnes(tonnage)} tonnes). ` +
      `You do not have EPR reporting obligations. Note: thresholds are turnover ≥ £1M AND packaging ≥ 25 tonnes for Small, or turnover ≥ £2M AND packaging ≥ 50 tonnes for Large.`,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function formatNumber(n: number): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

function formatTonnes(t: number): string {
  return t.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}
