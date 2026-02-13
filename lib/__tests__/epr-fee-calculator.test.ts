import { describe, it, expect } from 'vitest';
import {
  calculateLineFee,
  getApplicableRate,
  findFeeRate,
} from '@/lib/epr/fee-calculator';
import type { EPRFeeRate } from '@/lib/epr/types';

// =============================================================================
// Helpers — fee rate fixtures
// =============================================================================

function flatFeeRate(overrides: Partial<EPRFeeRate> = {}): EPRFeeRate {
  return {
    fee_year: '2025-26',
    material_code: 'PL',
    material_name: 'Plastic',
    flat_rate_per_tonne: 200,
    green_rate_per_tonne: null,
    amber_rate_per_tonne: null,
    red_rate_per_tonne: null,
    is_modulated: false,
    ...overrides,
  };
}

function modulatedFeeRate(overrides: Partial<EPRFeeRate> = {}): EPRFeeRate {
  return {
    fee_year: '2026-27',
    material_code: 'PL',
    material_name: 'Plastic',
    flat_rate_per_tonne: null,
    green_rate_per_tonne: 100,
    amber_rate_per_tonne: 200,
    red_rate_per_tonne: 300,
    is_modulated: true,
    ...overrides,
  };
}

// =============================================================================
// calculateLineFee
// =============================================================================

describe('calculateLineFee', () => {
  describe('Year 1 — flat rate', () => {
    it('calculates fee as weightTonnes * flat_rate_per_tonne', () => {
      const rate = flatFeeRate({ flat_rate_per_tonne: 200 });
      // 500 kg = 0.5 tonnes, 0.5 * 200 = 100
      expect(calculateLineFee(500, rate, null, false)).toBe(100);
    });

    it('calculates fee for 1000 kg (1 tonne)', () => {
      const rate = flatFeeRate({ flat_rate_per_tonne: 150 });
      // 1000 kg = 1 tonne, 1 * 150 = 150
      expect(calculateLineFee(1000, rate, null, false)).toBe(150);
    });

    it('rounds result to two decimal places', () => {
      const rate = flatFeeRate({ flat_rate_per_tonne: 333 });
      // 1 kg = 0.001 tonnes, 0.001 * 333 = 0.333 → rounds to 0.33
      expect(calculateLineFee(1, rate, null, false)).toBe(0.33);
    });

    it('ignores RAM rating for non-modulated rates', () => {
      const rate = flatFeeRate({ flat_rate_per_tonne: 200 });
      expect(calculateLineFee(1000, rate, 'green', false)).toBe(200);
    });
  });

  describe('Year 2 — modulated rates', () => {
    it('uses green rate when RAM rating is green', () => {
      const rate = modulatedFeeRate({ green_rate_per_tonne: 100 });
      // 1000 kg = 1 tonne, 1 * 100 = 100
      expect(calculateLineFee(1000, rate, 'green', false)).toBe(100);
    });

    it('uses amber rate when RAM rating is amber', () => {
      const rate = modulatedFeeRate({ amber_rate_per_tonne: 200 });
      // 1000 kg = 1 tonne, 1 * 200 = 200
      expect(calculateLineFee(1000, rate, 'amber', false)).toBe(200);
    });

    it('uses red rate when RAM rating is red', () => {
      const rate = modulatedFeeRate({ red_rate_per_tonne: 300 });
      // 1000 kg = 1 tonne, 1 * 300 = 300
      expect(calculateLineFee(1000, rate, 'red', false)).toBe(300);
    });

    it('defaults to red rate when RAM rating is null (unassessed = worst case)', () => {
      const rate = modulatedFeeRate({ red_rate_per_tonne: 300 });
      // No RAM rating → default to red
      expect(calculateLineFee(1000, rate, null, false)).toBe(300);
    });

    it('defaults to red rate when RAM rating is undefined', () => {
      const rate = modulatedFeeRate({ red_rate_per_tonne: 300 });
      expect(calculateLineFee(1000, rate, undefined, false)).toBe(300);
    });
  });

  describe('DRS exclusion', () => {
    it('returns 0 when isDRSExcluded is true (flat rate)', () => {
      const rate = flatFeeRate({ flat_rate_per_tonne: 200 });
      expect(calculateLineFee(1000, rate, null, true)).toBe(0);
    });

    it('returns 0 when isDRSExcluded is true (modulated rate)', () => {
      const rate = modulatedFeeRate();
      expect(calculateLineFee(1000, rate, 'green', true)).toBe(0);
    });
  });

  describe('zero and negative weight', () => {
    it('returns 0 for zero weight', () => {
      const rate = flatFeeRate({ flat_rate_per_tonne: 200 });
      expect(calculateLineFee(0, rate, null, false)).toBe(0);
    });

    it('returns 0 for negative weight', () => {
      const rate = flatFeeRate({ flat_rate_per_tonne: 200 });
      expect(calculateLineFee(-100, rate, null, false)).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('returns 0 when flat_rate_per_tonne is null on non-modulated rate', () => {
      const rate = flatFeeRate({ flat_rate_per_tonne: null });
      expect(calculateLineFee(1000, rate, null, false)).toBe(0);
    });

    it('returns 0 for modulated rate with no RAM and null red rate', () => {
      const rate = modulatedFeeRate({ red_rate_per_tonne: null });
      // Modulated + no RAM + no red rate → falls through to flat_rate (also null) → 0
      expect(calculateLineFee(1000, rate, null, false)).toBe(0);
    });
  });
});

// =============================================================================
// getApplicableRate
// =============================================================================

describe('getApplicableRate', () => {
  it('returns 0 when DRS excluded', () => {
    const rate = flatFeeRate({ flat_rate_per_tonne: 200 });
    expect(getApplicableRate(rate, null, true)).toBe(0);
  });

  it('returns flat rate for non-modulated fee year', () => {
    const rate = flatFeeRate({ flat_rate_per_tonne: 200 });
    expect(getApplicableRate(rate, null, false)).toBe(200);
  });

  it('returns green rate for modulated year with green rating', () => {
    const rate = modulatedFeeRate({ green_rate_per_tonne: 100 });
    expect(getApplicableRate(rate, 'green', false)).toBe(100);
  });

  it('returns amber rate for modulated year with amber rating', () => {
    const rate = modulatedFeeRate({ amber_rate_per_tonne: 200 });
    expect(getApplicableRate(rate, 'amber', false)).toBe(200);
  });

  it('returns red rate for modulated year with red rating', () => {
    const rate = modulatedFeeRate({ red_rate_per_tonne: 300 });
    expect(getApplicableRate(rate, 'red', false)).toBe(300);
  });

  it('defaults to red rate for modulated year with no RAM rating', () => {
    const rate = modulatedFeeRate({ red_rate_per_tonne: 300 });
    expect(getApplicableRate(rate, null, false)).toBe(300);
  });

  it('falls back to flat_rate when modulated rate is null for a given rating', () => {
    const rate = modulatedFeeRate({
      green_rate_per_tonne: null,
      flat_rate_per_tonne: 150,
    });
    expect(getApplicableRate(rate, 'green', false)).toBe(150);
  });

  it('returns 0 when flat_rate_per_tonne is null on non-modulated rate', () => {
    const rate = flatFeeRate({ flat_rate_per_tonne: null });
    expect(getApplicableRate(rate, null, false)).toBe(0);
  });
});

// =============================================================================
// findFeeRate
// =============================================================================

describe('findFeeRate', () => {
  const rates: EPRFeeRate[] = [
    flatFeeRate({ material_code: 'PL', fee_year: '2025-26' }),
    flatFeeRate({ material_code: 'GL', fee_year: '2025-26', flat_rate_per_tonne: 180 }),
    modulatedFeeRate({ material_code: 'PL', fee_year: '2026-27' }),
    modulatedFeeRate({ material_code: 'AL', fee_year: '2026-27' }),
  ];

  it('finds matching fee rate by material and year', () => {
    const result = findFeeRate(rates, 'PL', '2025-26');
    expect(result).toBeDefined();
    expect(result!.material_code).toBe('PL');
    expect(result!.fee_year).toBe('2025-26');
  });

  it('returns correct fee rate for glass in Year 1', () => {
    const result = findFeeRate(rates, 'GL', '2025-26');
    expect(result).toBeDefined();
    expect(result!.flat_rate_per_tonne).toBe(180);
  });

  it('finds modulated rate for correct year', () => {
    const result = findFeeRate(rates, 'PL', '2026-27');
    expect(result).toBeDefined();
    expect(result!.is_modulated).toBe(true);
  });

  it('returns undefined for non-existent material/year combination', () => {
    expect(findFeeRate(rates, 'WD', '2025-26')).toBeUndefined();
  });

  it('returns undefined for non-existent year', () => {
    expect(findFeeRate(rates, 'PL', '2030-31')).toBeUndefined();
  });

  it('returns undefined from empty array', () => {
    expect(findFeeRate([], 'PL', '2025-26')).toBeUndefined();
  });
});
