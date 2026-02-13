/**
 * EPR Compliance Tool — PRN Calculator
 *
 * Calculates PRN (Packaging Recovery Note) obligations per material
 * and tracks fulfilment status.
 */

import type { EPRPRNObligation, EPRPRNTarget } from './types';

// =============================================================================
// Obligation Calculation
// =============================================================================

/**
 * Calculate the PRN obligation tonnage for a material.
 *
 * obligation_tonnage = total_tonnage_placed × recycling_target_pct / 100
 */
export function calculateObligationTonnage(
  totalTonnagePlaced: number,
  recyclingTargetPct: number
): number {
  return roundToThreeDecimals(totalTonnagePlaced * recyclingTargetPct / 100);
}

/**
 * Determine the fulfilment status of a PRN obligation.
 */
export function determinePRNStatus(
  obligationTonnage: number,
  purchasedTonnage: number
): 'not_started' | 'partial' | 'fulfilled' | 'exceeded' {
  if (obligationTonnage <= 0) return 'fulfilled';
  if (purchasedTonnage <= 0) return 'not_started';
  if (purchasedTonnage >= obligationTonnage * 1.001) return 'exceeded'; // Allow 0.1% tolerance
  if (purchasedTonnage >= obligationTonnage * 0.999) return 'fulfilled'; // Allow 0.1% tolerance
  return 'partial';
}

/**
 * Calculate the remaining PRN tonnage to purchase.
 */
export function remainingObligation(
  obligationTonnage: number,
  purchasedTonnage: number
): number {
  const remaining = obligationTonnage - purchasedTonnage;
  return Math.max(0, roundToThreeDecimals(remaining));
}

/**
 * Calculate the total PRN cost from tonnage and price per tonne.
 */
export function calculatePRNCost(
  tonnage: number,
  costPerTonneGBP: number
): number {
  return roundToTwoDecimals(tonnage * costPerTonneGBP);
}

// =============================================================================
// Summary Calculations
// =============================================================================

/**
 * Calculate total PRN spend across all materials for a year.
 */
export function totalPRNSpend(obligations: EPRPRNObligation[]): number {
  return roundToTwoDecimals(
    obligations.reduce((sum, o) => sum + o.total_prn_cost_gbp, 0)
  );
}

/**
 * Calculate overall PRN fulfilment percentage across all materials.
 */
export function overallFulfilmentPct(obligations: EPRPRNObligation[]): number {
  const totalObligation = obligations.reduce((sum, o) => sum + o.obligation_tonnage, 0);
  const totalPurchased = obligations.reduce((sum, o) => sum + o.prns_purchased_tonnage, 0);

  if (totalObligation <= 0) return 100;
  return Math.min(100, Math.round((totalPurchased / totalObligation) * 100));
}

/**
 * Build initial PRN obligations from packaging tonnage data and recycling targets.
 *
 * @param tonnageByMaterial - Map of material_code → total tonnes placed on market
 * @param targets - PRN recycling targets for the year
 * @param organizationId - Organisation ID
 * @param year - Obligation year
 */
export function buildPRNObligations(
  tonnageByMaterial: Record<string, number>,
  targets: EPRPRNTarget[],
  organizationId: string,
  year: number
): Omit<EPRPRNObligation, 'id' | 'created_at' | 'updated_at'>[] {
  return targets
    .filter(t => t.obligation_year === year)
    .map(target => {
      const tonnage = tonnageByMaterial[target.material_code] ?? 0;
      const obligationTonnage = calculateObligationTonnage(tonnage, target.recycling_target_pct);

      return {
        organization_id: organizationId,
        obligation_year: year,
        material_code: target.material_code,
        material_name: target.material_name,
        total_tonnage_placed: tonnage,
        recycling_target_pct: target.recycling_target_pct,
        obligation_tonnage: obligationTonnage,
        prns_purchased_tonnage: 0,
        prn_cost_per_tonne_gbp: 0,
        total_prn_cost_gbp: 0,
        status: tonnage > 0 ? 'not_started' as const : 'fulfilled' as const,
      };
    });
}

// =============================================================================
// Helpers
// =============================================================================

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundToThreeDecimals(value: number): number {
  return Math.round(value * 1000) / 1000;
}
