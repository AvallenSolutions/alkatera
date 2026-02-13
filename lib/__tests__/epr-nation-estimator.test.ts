import { describe, it, expect } from 'vitest';
import {
  postcodeToNation,
  estimateFromAddresses,
  populationWeightedFallback,
} from '@/lib/epr/nation-estimator';
import type { AddressRecord } from '@/lib/epr/nation-estimator';
import { ONS_POPULATION_WEIGHTS } from '@/lib/epr/constants';

// =============================================================================
// postcodeToNation
// =============================================================================

describe('postcodeToNation', () => {
  describe('Northern Ireland postcodes (BT prefix)', () => {
    it('maps "BT1 1AA" to "ni"', () => {
      expect(postcodeToNation('BT1 1AA')).toBe('ni');
    });

    it('maps "BT48 7NN" to "ni"', () => {
      expect(postcodeToNation('BT48 7NN')).toBe('ni');
    });

    it('handles lowercase "bt1 1aa"', () => {
      expect(postcodeToNation('bt1 1aa')).toBe('ni');
    });

    it('handles no-space format "BT11AA"', () => {
      expect(postcodeToNation('BT11AA')).toBe('ni');
    });
  });

  describe('Scotland postcodes', () => {
    it('maps "EH1 1BB" to "scotland"', () => {
      expect(postcodeToNation('EH1 1BB')).toBe('scotland');
    });

    it('maps "AB10 1XA" to "scotland"', () => {
      expect(postcodeToNation('AB10 1XA')).toBe('scotland');
    });

    it('maps "G1 1AA" to "scotland" (single-letter prefix)', () => {
      expect(postcodeToNation('G1 1AA')).toBe('scotland');
    });

    it('maps "DD1 1AA" to "scotland"', () => {
      expect(postcodeToNation('DD1 1AA')).toBe('scotland');
    });

    it('maps "DG1 1AA" to "scotland"', () => {
      expect(postcodeToNation('DG1 1AA')).toBe('scotland');
    });

    it('maps "FK1 1AA" to "scotland"', () => {
      expect(postcodeToNation('FK1 1AA')).toBe('scotland');
    });

    it('maps "HS1 1AA" to "scotland"', () => {
      expect(postcodeToNation('HS1 1AA')).toBe('scotland');
    });

    it('maps "IV1 1AA" to "scotland"', () => {
      expect(postcodeToNation('IV1 1AA')).toBe('scotland');
    });

    it('maps "KA1 1AA" to "scotland"', () => {
      expect(postcodeToNation('KA1 1AA')).toBe('scotland');
    });

    it('maps "KW1 1AA" to "scotland"', () => {
      expect(postcodeToNation('KW1 1AA')).toBe('scotland');
    });

    it('maps "KY1 1AA" to "scotland"', () => {
      expect(postcodeToNation('KY1 1AA')).toBe('scotland');
    });

    it('maps "ML1 1AA" to "scotland"', () => {
      expect(postcodeToNation('ML1 1AA')).toBe('scotland');
    });

    it('maps "PA1 1AA" to "scotland"', () => {
      expect(postcodeToNation('PA1 1AA')).toBe('scotland');
    });

    it('maps "PH1 1AA" to "scotland"', () => {
      expect(postcodeToNation('PH1 1AA')).toBe('scotland');
    });

    it('maps "TD1 1AA" to "scotland"', () => {
      expect(postcodeToNation('TD1 1AA')).toBe('scotland');
    });

    it('maps "ZE1 1AA" to "scotland"', () => {
      expect(postcodeToNation('ZE1 1AA')).toBe('scotland');
    });
  });

  describe('Wales postcodes', () => {
    it('maps "CF10 1AA" to "wales"', () => {
      expect(postcodeToNation('CF10 1AA')).toBe('wales');
    });

    it('maps "LD1 1AA" to "wales"', () => {
      expect(postcodeToNation('LD1 1AA')).toBe('wales');
    });

    it('maps "LL1 1AA" to "wales"', () => {
      expect(postcodeToNation('LL1 1AA')).toBe('wales');
    });

    it('maps "NP1 1AA" to "wales"', () => {
      expect(postcodeToNation('NP1 1AA')).toBe('wales');
    });

    it('maps "SA1 1AA" to "wales"', () => {
      expect(postcodeToNation('SA1 1AA')).toBe('wales');
    });

    it('maps "SY1 1AA" to "wales" (SY treated as Wales per simplification)', () => {
      expect(postcodeToNation('SY1 1AA')).toBe('wales');
    });
  });

  describe('England postcodes (default)', () => {
    it('maps "SW1A 1AA" to "england"', () => {
      expect(postcodeToNation('SW1A 1AA')).toBe('england');
    });

    it('maps "M1 1AA" (Manchester) to "england"', () => {
      expect(postcodeToNation('M1 1AA')).toBe('england');
    });

    it('maps "B1 1AA" (Birmingham) to "england"', () => {
      expect(postcodeToNation('B1 1AA')).toBe('england');
    });

    it('maps "LS1 1AA" (Leeds) to "england"', () => {
      expect(postcodeToNation('LS1 1AA')).toBe('england');
    });

    it('maps "OX1 1AA" (Oxford) to "england"', () => {
      expect(postcodeToNation('OX1 1AA')).toBe('england');
    });

    it('maps "CB1 1AA" (Cambridge) to "england"', () => {
      expect(postcodeToNation('CB1 1AA')).toBe('england');
    });
  });

  describe('format handling', () => {
    it('handles extra whitespace', () => {
      expect(postcodeToNation('  SW1A  1AA  ')).toBe('england');
    });

    it('handles lowercase input', () => {
      expect(postcodeToNation('sw1a 1aa')).toBe('england');
    });

    it('handles mixed case', () => {
      expect(postcodeToNation('Eh1 1Bb')).toBe('scotland');
    });

    it('returns null for empty string', () => {
      expect(postcodeToNation('')).toBeNull();
    });

    it('returns null for numeric-only input', () => {
      expect(postcodeToNation('12345')).toBeNull();
    });
  });
});

// =============================================================================
// estimateFromAddresses
// =============================================================================

describe('estimateFromAddresses', () => {
  describe('with sufficient addresses (>=10)', () => {
    it('produces correct weighted distribution', () => {
      // 8 England, 1 Scotland, 1 Wales = 80/10/10/0
      const addresses: AddressRecord[] = [
        { postcode: 'SW1A 1AA' },
        { postcode: 'M1 1AA' },
        { postcode: 'B1 1AA' },
        { postcode: 'LS1 1AA' },
        { postcode: 'OX1 1AA' },
        { postcode: 'CB1 1AA' },
        { postcode: 'BA1 1AA' },
        { postcode: 'BS1 1AA' },
        { postcode: 'EH1 1BB' },
        { postcode: 'CF10 1AA' },
      ];

      const result = estimateFromAddresses(addresses);
      expect(result.method).toBe('postcode_analysis');
      expect(result.england_pct).toBeGreaterThan(0);
      expect(result.scotland_pct).toBeGreaterThan(0);
      expect(result.wales_pct).toBeGreaterThan(0);
      expect(result.sample_size).toBe(10);
    });

    it('uses quantity weighting when provided', () => {
      const addresses: AddressRecord[] = [
        { postcode: 'SW1A 1AA', quantity: 90 },
        { postcode: 'EH1 1BB', quantity: 5 },
        { postcode: 'CF10 1AA', quantity: 3 },
        { postcode: 'BT1 1AA', quantity: 2 },
        // Need at least 10 valid postcodes
        { postcode: 'M1 1AA', quantity: 0 },
        { postcode: 'B1 1AA', quantity: 0 },
        { postcode: 'LS1 1AA', quantity: 0 },
        { postcode: 'OX1 1AA', quantity: 0 },
        { postcode: 'CB1 1AA', quantity: 0 },
        { postcode: 'BA1 1AA', quantity: 0 },
      ];

      const result = estimateFromAddresses(addresses);
      expect(result.method).toBe('postcode_analysis');
      // England should have the highest pct due to quantity 90
      expect(result.england_pct).toBeGreaterThan(result.scotland_pct);
    });

    it('returns "high" confidence for >= 100 valid addresses', () => {
      const addresses: AddressRecord[] = Array.from({ length: 100 }, (_, i) => ({
        postcode: `SW${i % 20 + 1}A 1AA`,
      }));
      const result = estimateFromAddresses(addresses);
      expect(result.confidence).toBe('high');
    });

    it('returns "medium" confidence for 30-99 valid addresses', () => {
      const addresses: AddressRecord[] = Array.from({ length: 50 }, () => ({
        postcode: 'SW1A 1AA',
      }));
      const result = estimateFromAddresses(addresses);
      expect(result.confidence).toBe('medium');
    });

    it('returns "low" confidence for 10-29 valid addresses', () => {
      const addresses: AddressRecord[] = Array.from({ length: 15 }, () => ({
        postcode: 'SW1A 1AA',
      }));
      const result = estimateFromAddresses(addresses);
      expect(result.confidence).toBe('low');
    });

    it('includes justification mentioning postcode analysis', () => {
      const addresses: AddressRecord[] = Array.from({ length: 10 }, () => ({
        postcode: 'SW1A 1AA',
      }));
      const result = estimateFromAddresses(addresses);
      expect(result.justification).toContain('delivery/customer address records');
    });
  });

  describe('falls back to population weights for <10 addresses', () => {
    it('uses population fallback for 0 addresses', () => {
      const result = estimateFromAddresses([]);
      expect(result.method).toBe('population_weighted');
    });

    it('uses population fallback for 9 valid addresses', () => {
      const addresses: AddressRecord[] = Array.from({ length: 9 }, () => ({
        postcode: 'SW1A 1AA',
      }));
      const result = estimateFromAddresses(addresses);
      expect(result.method).toBe('population_weighted');
    });

    it('uses population fallback for 5 addresses', () => {
      const addresses: AddressRecord[] = Array.from({ length: 5 }, () => ({
        postcode: 'EH1 1BB',
      }));
      const result = estimateFromAddresses(addresses);
      expect(result.method).toBe('population_weighted');
    });
  });

  describe('percentage normalization', () => {
    it('percentages sum to 100', () => {
      const addresses: AddressRecord[] = Array.from({ length: 33 }, (_, i) => {
        if (i < 20) return { postcode: 'SW1A 1AA' };
        if (i < 25) return { postcode: 'EH1 1BB' };
        if (i < 30) return { postcode: 'CF10 1AA' };
        return { postcode: 'BT1 1AA' };
      });

      const result = estimateFromAddresses(addresses);
      const sum = result.england_pct + result.scotland_pct + result.wales_pct + result.ni_pct;
      expect(sum).toBe(100);
    });
  });
});

// =============================================================================
// populationWeightedFallback
// =============================================================================

describe('populationWeightedFallback', () => {
  it('returns exact ONS population percentages', () => {
    const result = populationWeightedFallback();
    expect(result.england_pct).toBe(ONS_POPULATION_WEIGHTS.england); // 84.3
    expect(result.scotland_pct).toBe(ONS_POPULATION_WEIGHTS.scotland); // 8.2
    expect(result.wales_pct).toBe(ONS_POPULATION_WEIGHTS.wales); // 4.7
    expect(result.ni_pct).toBe(ONS_POPULATION_WEIGHTS.ni); // 2.8
  });

  it('has method "population_weighted"', () => {
    const result = populationWeightedFallback();
    expect(result.method).toBe('population_weighted');
  });

  it('has confidence "low"', () => {
    const result = populationWeightedFallback();
    expect(result.confidence).toBe('low');
  });

  it('has sample_size 0', () => {
    const result = populationWeightedFallback();
    expect(result.sample_size).toBe(0);
  });

  it('includes justification mentioning ONS Census 2021', () => {
    const result = populationWeightedFallback();
    expect(result.justification).toContain('ONS Census 2021');
  });

  it('percentages sum to 100', () => {
    const result = populationWeightedFallback();
    const sum = result.england_pct + result.scotland_pct + result.wales_pct + result.ni_pct;
    expect(sum).toBe(100);
  });
});
