/**
 * Use Phase Factors Test Suite
 *
 * Tests refrigeration + carbonation emissions calculations,
 * default config generation, and country-specific grid factors.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the grid-emission-factors module
vi.mock('../grid-emission-factors', () => ({
  getGridFactor: vi.fn((countryCode: string | null | undefined, _fallback?: string) => {
    // Return realistic country-specific factors for testing
    const MOCK_FACTORS: Record<string, number> = {
      GB: 0.207,
      FR: 0.052,
      DE: 0.380,
      US: 0.386,
      IN: 0.708,
      SE: 0.013,
      NO: 0.017,
    };
    if (countryCode) {
      const normalized = countryCode.toUpperCase().trim();
      const factor = MOCK_FACTORS[normalized];
      if (factor !== undefined) {
        return { factor, source: `Mock ${normalized}`, isEstimated: false };
      }
    }
    // Global average fallback
    return { factor: 0.490, source: 'Mock global average', isEstimated: true };
  }),
}));

import {
  calculateUsePhaseEmissions,
  getDefaultUsePhaseConfig,
  type UsePhaseConfig,
} from '../use-phase-factors';

// ============================================================================
// CONSTANTS (from source file for verification)
// ============================================================================

const DOMESTIC_KWH_PER_LITRE_PER_DAY = 0.00356;
const RETAIL_KWH_PER_LITRE_PER_DAY = 0.00636;
const DEFAULT_GRID_FACTOR = 0.490; // Global average

// Carbonation factors (kg CO2 per reference volume)
const BEER_CO2 = 0.0025;   // per 330ml
const BEER_VOL = 0.33;     // litres
const SPARKLING_WINE_CO2 = 0.0045; // per 750ml
const SPARKLING_WINE_VOL = 0.75;
const SOFT_DRINK_CO2 = 0.0035; // per 500ml
const SOFT_DRINK_VOL = 0.5;

// ============================================================================
// REFRIGERATION TESTS
// ============================================================================

describe('Refrigeration emissions', () => {
  it('calculates domestic + retail refrigeration for a 330ml beer, 7 days, GB grid', () => {
    const config: UsePhaseConfig = {
      needsRefrigeration: true,
      refrigerationDays: 7,
      retailRefrigerationSplit: 0.5,
      isCarbonated: false,
      consumerCountryCode: 'GB',
    };
    const volumeL = 0.33;
    const result = calculateUsePhaseEmissions(config, volumeL);

    const gbGrid = 0.207;
    const domesticExpected = volumeL * DOMESTIC_KWH_PER_LITRE_PER_DAY * gbGrid * 7 * 0.5;
    const retailExpected = volumeL * RETAIL_KWH_PER_LITRE_PER_DAY * gbGrid * 7 * 0.5;

    expect(result.breakdown.domesticRefrigeration).toBeCloseTo(domesticExpected, 6);
    expect(result.breakdown.retailRefrigeration).toBeCloseTo(retailExpected, 6);
    expect(result.refrigeration).toBeCloseTo(domesticExpected + retailExpected, 6);
    expect(result.carbonation).toBe(0);
    expect(result.total).toBeCloseTo(result.refrigeration, 6);
  });

  it('uses global average when no country code specified', () => {
    const config: UsePhaseConfig = {
      needsRefrigeration: true,
      refrigerationDays: 7,
      retailRefrigerationSplit: 0.5,
      isCarbonated: false,
      consumerCountryCode: undefined,
    };
    const volumeL = 0.33;
    const result = calculateUsePhaseEmissions(config, volumeL);

    const domesticExpected = volumeL * DOMESTIC_KWH_PER_LITRE_PER_DAY * DEFAULT_GRID_FACTOR * 7 * 0.5;
    const retailExpected = volumeL * RETAIL_KWH_PER_LITRE_PER_DAY * DEFAULT_GRID_FACTOR * 7 * 0.5;

    expect(result.refrigeration).toBeCloseTo(domesticExpected + retailExpected, 6);
  });

  it('French grid (0.052) produces much lower emissions than Indian grid (0.708)', () => {
    const baseConfig: UsePhaseConfig = {
      needsRefrigeration: true,
      refrigerationDays: 7,
      retailRefrigerationSplit: 0.5,
      isCarbonated: false,
    };
    const volumeL = 0.33;

    const frResult = calculateUsePhaseEmissions({ ...baseConfig, consumerCountryCode: 'FR' }, volumeL);
    const inResult = calculateUsePhaseEmissions({ ...baseConfig, consumerCountryCode: 'IN' }, volumeL);

    // India grid is ~13.6× higher than France
    expect(inResult.refrigeration).toBeGreaterThan(frResult.refrigeration * 10);
  });

  it('returns zero when needsRefrigeration is false', () => {
    const config: UsePhaseConfig = {
      needsRefrigeration: false,
      refrigerationDays: 7,
      retailRefrigerationSplit: 0.5,
      isCarbonated: false,
    };
    const result = calculateUsePhaseEmissions(config, 0.33);
    expect(result.refrigeration).toBe(0);
    expect(result.breakdown.domesticRefrigeration).toBe(0);
    expect(result.breakdown.retailRefrigeration).toBe(0);
  });

  it('returns zero when volume is zero', () => {
    const config: UsePhaseConfig = {
      needsRefrigeration: true,
      refrigerationDays: 7,
      retailRefrigerationSplit: 0.5,
      isCarbonated: false,
      consumerCountryCode: 'GB',
    };
    const result = calculateUsePhaseEmissions(config, 0);
    expect(result.refrigeration).toBe(0);
    expect(result.total).toBe(0);
  });

  it('scales linearly with volume (1L = ~3x of 330ml)', () => {
    const config: UsePhaseConfig = {
      needsRefrigeration: true,
      refrigerationDays: 7,
      retailRefrigerationSplit: 0.5,
      isCarbonated: false,
      consumerCountryCode: 'GB',
    };
    const small = calculateUsePhaseEmissions(config, 0.33);
    const large = calculateUsePhaseEmissions(config, 1.0);

    expect(large.refrigeration / small.refrigeration).toBeCloseTo(1.0 / 0.33, 2);
  });

  it('scales linearly with refrigeration days', () => {
    const base: UsePhaseConfig = {
      needsRefrigeration: true,
      refrigerationDays: 7,
      retailRefrigerationSplit: 0.5,
      isCarbonated: false,
      consumerCountryCode: 'GB',
    };
    const r7 = calculateUsePhaseEmissions(base, 0.33);
    const r14 = calculateUsePhaseEmissions({ ...base, refrigerationDays: 14 }, 0.33);

    expect(r14.refrigeration).toBeCloseTo(r7.refrigeration * 2, 6);
  });

  it('100% retail split puts all emissions in retail bucket', () => {
    const config: UsePhaseConfig = {
      needsRefrigeration: true,
      refrigerationDays: 7,
      retailRefrigerationSplit: 1.0,
      isCarbonated: false,
      consumerCountryCode: 'GB',
    };
    const result = calculateUsePhaseEmissions(config, 0.33);

    expect(result.breakdown.domesticRefrigeration).toBe(0);
    expect(result.breakdown.retailRefrigeration).toBeGreaterThan(0);
    expect(result.refrigeration).toBe(result.breakdown.retailRefrigeration);
  });

  it('100% domestic split puts all emissions in domestic bucket', () => {
    const config: UsePhaseConfig = {
      needsRefrigeration: true,
      refrigerationDays: 7,
      retailRefrigerationSplit: 0.0,
      isCarbonated: false,
      consumerCountryCode: 'GB',
    };
    const result = calculateUsePhaseEmissions(config, 0.33);

    expect(result.breakdown.retailRefrigeration).toBe(0);
    expect(result.breakdown.domesticRefrigeration).toBeGreaterThan(0);
    expect(result.refrigeration).toBe(result.breakdown.domesticRefrigeration);
  });

  it('defaults refrigerationDays to 7 when 0 (falsy)', () => {
    const config: UsePhaseConfig = {
      needsRefrigeration: true,
      refrigerationDays: 0,
      retailRefrigerationSplit: 0.5,
      isCarbonated: false,
      consumerCountryCode: 'GB',
    };
    const result = calculateUsePhaseEmissions(config, 0.33);
    const expected7Days = calculateUsePhaseEmissions(
      { ...config, refrigerationDays: 7 },
      0.33,
    );
    expect(result.refrigeration).toBeCloseTo(expected7Days.refrigeration, 6);
  });
});

// ============================================================================
// CARBONATION TESTS
// ============================================================================

describe('Carbonation emissions', () => {
  it('calculates beer carbonation for 330ml', () => {
    const config: UsePhaseConfig = {
      needsRefrigeration: false,
      refrigerationDays: 0,
      retailRefrigerationSplit: 0,
      isCarbonated: true,
      carbonationType: 'beer',
    };
    const result = calculateUsePhaseEmissions(config, 0.33);

    // beer: 0.0025 kg CO2 per 330ml, so per litre = 0.0025/0.33
    const perLitre = BEER_CO2 / BEER_VOL;
    const expected = 0.33 * perLitre;
    expect(result.carbonation).toBeCloseTo(expected, 6);
    expect(result.breakdown.carbonationRelease).toBeCloseTo(expected, 6);
  });

  it('calculates sparkling wine carbonation for 750ml', () => {
    const config: UsePhaseConfig = {
      needsRefrigeration: false,
      refrigerationDays: 0,
      retailRefrigerationSplit: 0,
      isCarbonated: true,
      carbonationType: 'sparkling_wine',
    };
    const result = calculateUsePhaseEmissions(config, 0.75);

    const perLitre = SPARKLING_WINE_CO2 / SPARKLING_WINE_VOL;
    const expected = 0.75 * perLitre;
    expect(result.carbonation).toBeCloseTo(expected, 6);
  });

  it('calculates soft drink carbonation for 500ml', () => {
    const config: UsePhaseConfig = {
      needsRefrigeration: false,
      refrigerationDays: 0,
      retailRefrigerationSplit: 0,
      isCarbonated: true,
      carbonationType: 'soft_drink',
    };
    const result = calculateUsePhaseEmissions(config, 0.5);

    const perLitre = SOFT_DRINK_CO2 / SOFT_DRINK_VOL;
    const expected = 0.5 * perLitre;
    expect(result.carbonation).toBeCloseTo(expected, 6);
  });

  it('returns zero carbonation when isCarbonated is false', () => {
    const config: UsePhaseConfig = {
      needsRefrigeration: false,
      refrigerationDays: 0,
      retailRefrigerationSplit: 0,
      isCarbonated: false,
      carbonationType: 'beer',
    };
    const result = calculateUsePhaseEmissions(config, 0.33);
    expect(result.carbonation).toBe(0);
  });

  it('returns zero carbonation when carbonationType is undefined', () => {
    const config: UsePhaseConfig = {
      needsRefrigeration: false,
      refrigerationDays: 0,
      retailRefrigerationSplit: 0,
      isCarbonated: true,
      carbonationType: undefined,
    };
    const result = calculateUsePhaseEmissions(config, 0.33);
    expect(result.carbonation).toBe(0);
  });

  it('scales linearly with volume', () => {
    const config: UsePhaseConfig = {
      needsRefrigeration: false,
      refrigerationDays: 0,
      retailRefrigerationSplit: 0,
      isCarbonated: true,
      carbonationType: 'beer',
    };
    const small = calculateUsePhaseEmissions(config, 0.33);
    const big = calculateUsePhaseEmissions(config, 0.66);

    expect(big.carbonation).toBeCloseTo(small.carbonation * 2, 6);
  });
});

// ============================================================================
// COMBINED (REFRIGERATION + CARBONATION)
// ============================================================================

describe('Combined use-phase emissions', () => {
  it('total = refrigeration + carbonation', () => {
    const config: UsePhaseConfig = {
      needsRefrigeration: true,
      refrigerationDays: 7,
      retailRefrigerationSplit: 0.5,
      isCarbonated: true,
      carbonationType: 'beer',
      consumerCountryCode: 'GB',
    };
    const result = calculateUsePhaseEmissions(config, 0.33);

    expect(result.total).toBeCloseTo(result.refrigeration + result.carbonation, 6);
    expect(result.total).toBeGreaterThan(0);
    expect(result.refrigeration).toBeGreaterThan(0);
    expect(result.carbonation).toBeGreaterThan(0);
  });

  it('returns all-zero result when nothing is enabled', () => {
    const config: UsePhaseConfig = {
      needsRefrigeration: false,
      refrigerationDays: 0,
      retailRefrigerationSplit: 0,
      isCarbonated: false,
    };
    const result = calculateUsePhaseEmissions(config, 0.33);

    expect(result.total).toBe(0);
    expect(result.refrigeration).toBe(0);
    expect(result.carbonation).toBe(0);
    expect(result.breakdown.domesticRefrigeration).toBe(0);
    expect(result.breakdown.retailRefrigeration).toBe(0);
    expect(result.breakdown.carbonationRelease).toBe(0);
  });
});

// ============================================================================
// DEFAULT CONFIG GENERATION
// ============================================================================

describe('getDefaultUsePhaseConfig', () => {
  it('beer_cider gets refrigeration + beer carbonation', () => {
    const config = getDefaultUsePhaseConfig('beer_cider');
    expect(config.needsRefrigeration).toBe(true);
    expect(config.isCarbonated).toBe(true);
    expect(config.carbonationType).toBe('beer');
    expect(config.refrigerationDays).toBe(7);
    expect(config.retailRefrigerationSplit).toBe(0.5);
  });

  it('"Beer & Cider" (display name) also gets refrigeration + beer carbonation', () => {
    const config = getDefaultUsePhaseConfig('Beer & Cider');
    expect(config.needsRefrigeration).toBe(true);
    expect(config.isCarbonated).toBe(true);
    expect(config.carbonationType).toBe('beer');
  });

  it('rtd_cocktails gets refrigeration + soft_drink carbonation', () => {
    const config = getDefaultUsePhaseConfig('rtd_cocktails');
    expect(config.needsRefrigeration).toBe(true);
    expect(config.isCarbonated).toBe(true);
    expect(config.carbonationType).toBe('soft_drink');
  });

  it('spirits gets no refrigeration and no carbonation', () => {
    const config = getDefaultUsePhaseConfig('spirits');
    expect(config.needsRefrigeration).toBe(false);
    expect(config.isCarbonated).toBe(false);
    expect(config.carbonationType).toBeUndefined();
  });

  it('"Single Malt Spirits" also detected as spirits', () => {
    const config = getDefaultUsePhaseConfig('Single Malt Spirits');
    expect(config.needsRefrigeration).toBe(false);
    expect(config.isCarbonated).toBe(false);
  });

  it('wine gets no refrigeration (conservative default)', () => {
    const config = getDefaultUsePhaseConfig('wine');
    expect(config.needsRefrigeration).toBe(false);
  });

  it('non-alcoholic gets no refrigeration (category too broad)', () => {
    const config = getDefaultUsePhaseConfig('non_alcoholic');
    expect(config.needsRefrigeration).toBe(false);
  });

  it('unknown category gets no refrigeration and no carbonation', () => {
    const config = getDefaultUsePhaseConfig('unknown_product');
    expect(config.needsRefrigeration).toBe(false);
    expect(config.isCarbonated).toBe(false);
    expect(config.carbonationType).toBeUndefined();
    expect(config.refrigerationDays).toBe(7);
    expect(config.retailRefrigerationSplit).toBe(0.5);
  });

  it('handles empty string input (matches all categories due to String.includes("") = true)', () => {
    // NOTE: Empty string causes `cat.includes("")` to be true for all categories.
    // This is a known edge case in the source code's matching logic.
    // In practice, empty strings should not be passed (product_type is always set).
    const config = getDefaultUsePhaseConfig('');
    // Empty string matches REFRIGERATED_CATEGORIES and CARBONATED_CATEGORIES
    // because ''.includes('') and 'beer_cider'.includes('') are both true
    expect(config.needsRefrigeration).toBe(true);
    expect(config.isCarbonated).toBe(true);
  });
});
