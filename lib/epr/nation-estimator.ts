/**
 * EPR Compliance Tool — Nation-of-Sale Estimator
 *
 * Auto-estimates the UK nation distribution of packaging based on
 * customer/delivery address data. Falls back to ONS population-weighted
 * defaults when insufficient data is available.
 */

import type { NationEstimationResult } from './types';
import {
  NI_POSTCODE_PREFIXES,
  SCOTLAND_POSTCODE_PREFIXES,
  WALES_POSTCODE_PREFIXES,
  ONS_POPULATION_WEIGHTS,
} from './constants';

// =============================================================================
// Postcode-to-Nation Mapping
// =============================================================================

/**
 * Determine the UK nation from a postcode string.
 * Extracts the alphabetic prefix from the outward code and matches
 * against known nation prefixes.
 *
 * @param postcode - UK postcode (any format: "SW1A 1AA", "sw1a1aa", "BT1 1AA")
 * @returns 'england' | 'scotland' | 'wales' | 'ni' | null
 */
export function postcodeToNation(postcode: string): 'england' | 'scotland' | 'wales' | 'ni' | null {
  if (!postcode) return null;

  // Clean and extract the outward code prefix (alphabetic part)
  const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, '');
  const match = cleaned.match(/^([A-Z]{1,2})/);
  if (!match) return null;

  const prefix = match[1];

  // Northern Ireland
  if (NI_POSTCODE_PREFIXES.includes(prefix)) return 'ni';

  // Scotland
  if (SCOTLAND_POSTCODE_PREFIXES.includes(prefix)) return 'scotland';

  // Wales
  if (WALES_POSTCODE_PREFIXES.includes(prefix)) return 'wales';

  // Default: England (all remaining valid UK postcodes)
  return 'england';
}

// =============================================================================
// Estimation from Address Data
// =============================================================================

export interface AddressRecord {
  postcode: string;
  quantity?: number; // Optional weight — e.g., units sold to this location
}

/**
 * Estimate nation-of-sale distribution from a list of delivery/customer addresses.
 *
 * @param addresses - Array of address records with postcodes
 * @returns Nation estimation result with percentages, method, and confidence
 */
export function estimateFromAddresses(addresses: AddressRecord[]): NationEstimationResult {
  if (addresses.length === 0) {
    return populationWeightedFallback();
  }

  const totals = { england: 0, scotland: 0, wales: 0, ni: 0 };
  let validCount = 0;

  for (const addr of addresses) {
    const nation = postcodeToNation(addr.postcode);
    if (nation) {
      const weight = addr.quantity ?? 1;
      totals[nation] += weight;
      validCount++;
    }
  }

  // If too few valid postcodes, fall back to population weights
  if (validCount < 10) {
    return populationWeightedFallback();
  }

  const totalWeight = totals.england + totals.scotland + totals.wales + totals.ni;
  if (totalWeight === 0) {
    return populationWeightedFallback();
  }

  const result: NationEstimationResult = {
    england_pct: roundPct(totals.england / totalWeight * 100),
    scotland_pct: roundPct(totals.scotland / totalWeight * 100),
    wales_pct: roundPct(totals.wales / totalWeight * 100),
    ni_pct: roundPct(totals.ni / totalWeight * 100),
    method: 'postcode_analysis',
    confidence: validCount >= 100 ? 'high' : validCount >= 30 ? 'medium' : 'low',
    sample_size: validCount,
    justification: generateJustification('postcode_analysis', validCount, totals, totalWeight),
  };

  // Ensure percentages sum to 100
  normalizePercentages(result);

  return result;
}

/**
 * Return ONS population-weighted fallback when no address data is available.
 */
export function populationWeightedFallback(): NationEstimationResult {
  return {
    england_pct: ONS_POPULATION_WEIGHTS.england,
    scotland_pct: ONS_POPULATION_WEIGHTS.scotland,
    wales_pct: ONS_POPULATION_WEIGHTS.wales,
    ni_pct: ONS_POPULATION_WEIGHTS.ni,
    method: 'population_weighted',
    confidence: 'low',
    sample_size: 0,
    justification: generateJustification('population_weighted', 0, null, 0),
  };
}

// =============================================================================
// Audit Justification Generator
// =============================================================================

/**
 * Generate a human-readable justification for the nation-of-sale methodology.
 * This text can be included in an "Audit Defence Pack" for regulators.
 */
function generateJustification(
  method: string,
  sampleSize: number,
  totals: { england: number; scotland: number; wales: number; ni: number } | null,
  totalWeight: number
): string {
  if (method === 'population_weighted') {
    return (
      'Nation-of-sale distribution was estimated using ONS Census 2021 population weights ' +
      '(England 84.3%, Scotland 8.2%, Wales 4.7%, Northern Ireland 2.8%). ' +
      'This proxy methodology was applied because insufficient customer-level delivery data was available. ' +
      'The population-weighted approach is a recognised proxy method as referenced in Defra guidance ' +
      'for producers who supply via intermediary wholesalers without direct nation-of-sale visibility.'
    );
  }

  if (method === 'postcode_analysis' && totals) {
    return (
      `Nation-of-sale distribution was estimated by analysing ${sampleSize} delivery/customer address records. ` +
      `UK postcode outward codes were mapped to constituent nations using Royal Mail postcode area definitions. ` +
      `Weighted distribution: England ${roundPct(totals.england / totalWeight * 100)}%, ` +
      `Scotland ${roundPct(totals.scotland / totalWeight * 100)}%, ` +
      `Wales ${roundPct(totals.wales / totalWeight * 100)}%, ` +
      `Northern Ireland ${roundPct(totals.ni / totalWeight * 100)}%. ` +
      `This methodology provides a robust, evidence-based proxy for nation-of-sale allocation ` +
      `as recommended by Defra and the Environment Agency.`
    );
  }

  return 'Methodology not specified.';
}

// =============================================================================
// Helpers
// =============================================================================

function roundPct(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Ensure the 4 nation percentages sum exactly to 100 by adjusting England.
 */
function normalizePercentages(result: NationEstimationResult): void {
  const sum = result.england_pct + result.scotland_pct + result.wales_pct + result.ni_pct;
  if (sum !== 100) {
    result.england_pct = roundPct(result.england_pct + (100 - sum));
  }
}
