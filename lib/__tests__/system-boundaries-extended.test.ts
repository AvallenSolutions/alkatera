/**
 * System Boundaries — Extended Test Suite
 *
 * Covers functions and edge cases not in the base test file:
 * getDefaultLossConfig, getDefaultConsumerWaste, getConsumerWasteEntry,
 * and calculateLossMultiplier with deeper boundary/config combinations.
 */

import { vi, beforeEach } from 'vitest';
import {
  getDefaultLossConfig,
  getDefaultConsumerWaste,
  getConsumerWasteEntry,
  calculateLossMultiplier,
  type ProductLossConfig,
} from '@/lib/system-boundaries';

// Suppress console output during tests
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ============================================================================
// HELPERS
// ============================================================================

function makeLossConfig(overrides: Partial<ProductLossConfig> = {}): ProductLossConfig {
  return {
    distributionLossPercent: 2,
    retailLossPercent: 3,
    consumerWastePercent: 5,
    ...overrides,
  };
}

// ============================================================================
// getDefaultLossConfig
// ============================================================================

describe('getDefaultLossConfig (extended)', () => {
  describe('beer category', () => {
    it('returns beer-specific consumer waste for Lager', () => {
      const config = getDefaultLossConfig('Lager', 'Beer & Cider');
      expect(config.consumerWastePercent).toBe(3);
    });

    it('returns beer-specific consumer waste for IPA', () => {
      const config = getDefaultLossConfig('IPA', 'Beer & Cider');
      expect(config.consumerWastePercent).toBe(3);
    });

    it('returns beer-specific consumer waste for Stout & Porter', () => {
      const config = getDefaultLossConfig('Stout & Porter', 'Beer & Cider');
      expect(config.consumerWastePercent).toBe(3);
    });
  });

  describe('wine category', () => {
    it('returns wine-specific consumer waste for Red Wine', () => {
      const config = getDefaultLossConfig('Red Wine', 'Wine');
      expect(config.consumerWastePercent).toBe(10);
    });

    it('returns wine-specific consumer waste for White Wine', () => {
      const config = getDefaultLossConfig('White Wine', 'Wine');
      expect(config.consumerWastePercent).toBe(10);
    });

    it('returns higher waste for Sparkling Wine (carbonation loss)', () => {
      const config = getDefaultLossConfig('Sparkling Wine', 'Wine');
      expect(config.consumerWastePercent).toBe(15);
    });

    it('returns lower waste for Fortified Wine (higher ABV)', () => {
      const config = getDefaultLossConfig('Fortified Wine', 'Wine');
      expect(config.consumerWastePercent).toBe(3);
    });
  });

  describe('spirits category', () => {
    it('returns spirits-specific consumer waste for Gin', () => {
      const config = getDefaultLossConfig('Gin', 'Spirits');
      expect(config.consumerWastePercent).toBe(1);
    });

    it('returns spirits-specific consumer waste for Whisky', () => {
      const config = getDefaultLossConfig('Whisky', 'Spirits');
      expect(config.consumerWastePercent).toBe(1);
    });

    it('returns spirits-specific consumer waste for Tequila', () => {
      const config = getDefaultLossConfig('Tequila', 'Spirits');
      expect(config.consumerWastePercent).toBe(1);
    });

    it('returns higher waste for Liqueur (shorter shelf life)', () => {
      const config = getDefaultLossConfig('Liqueur', 'Spirits');
      expect(config.consumerWastePercent).toBe(3);
    });
  });

  describe('null/undefined category', () => {
    it('falls back to group default when category is null', () => {
      const config = getDefaultLossConfig(null, 'Wine');
      expect(config.consumerWastePercent).toBe(10);
    });

    it('falls back to group default when category is undefined', () => {
      const config = getDefaultLossConfig(undefined, 'Spirits');
      expect(config.consumerWastePercent).toBe(1);
    });

    it('falls back to global 5% when both category and type are null', () => {
      const config = getDefaultLossConfig(null, null);
      expect(config.consumerWastePercent).toBe(5);
    });

    it('falls back to global 5% when both are undefined', () => {
      const config = getDefaultLossConfig(undefined, undefined);
      expect(config.consumerWastePercent).toBe(5);
    });

    it('falls back to global 5% with no arguments', () => {
      const config = getDefaultLossConfig();
      expect(config.consumerWastePercent).toBe(5);
    });
  });

  describe('common fields across all configs', () => {
    it.each([
      ['Gin', 'Spirits'],
      ['Lager', 'Beer & Cider'],
      ['Red Wine', 'Wine'],
      [null, null],
    ] as const)('distributionLossPercent is always 2 for (%s, %s)', (cat, type) => {
      const config = getDefaultLossConfig(cat, type);
      expect(config.distributionLossPercent).toBe(2);
    });

    it.each([
      ['Gin', 'Spirits'],
      ['Lager', 'Beer & Cider'],
      ['Red Wine', 'Wine'],
      [null, null],
    ] as const)('retailLossPercent is always 3 for (%s, %s)', (cat, type) => {
      const config = getDefaultLossConfig(cat, type);
      expect(config.retailLossPercent).toBe(3);
    });

    it('every config has all three loss fields defined', () => {
      const config = getDefaultLossConfig('Vodka', 'Spirits');
      expect(config).toHaveProperty('distributionLossPercent');
      expect(config).toHaveProperty('retailLossPercent');
      expect(config).toHaveProperty('consumerWastePercent');
    });
  });
});

// ============================================================================
// getDefaultConsumerWaste (extended)
// ============================================================================

describe('getDefaultConsumerWaste (extended)', () => {
  describe('spirits categories return 1%', () => {
    it.each(['Gin', 'Vodka', 'Rum', 'Whisky', 'Tequila', 'Mezcal', 'Brandy', 'Bourbon'])(
      '%s returns 1',
      (category) => {
        expect(getDefaultConsumerWaste(category)).toBe(1);
      },
    );
  });

  describe('beer categories return 3%', () => {
    it.each(['Lager', 'Ale', 'IPA', 'Stout & Porter', 'Wheat Beer', 'Sour Beer', 'Cider'])(
      '%s returns 3',
      (category) => {
        expect(getDefaultConsumerWaste(category)).toBe(3);
      },
    );
  });

  describe('wine categories', () => {
    it('Red Wine returns 10', () => {
      expect(getDefaultConsumerWaste('Red Wine')).toBe(10);
    });

    it('White Wine returns 10', () => {
      expect(getDefaultConsumerWaste('White Wine')).toBe(10);
    });

    it('Natural Wine returns 12', () => {
      expect(getDefaultConsumerWaste('Natural Wine')).toBe(12);
    });

    it('Sparkling Wine returns 15', () => {
      expect(getDefaultConsumerWaste('Sparkling Wine')).toBe(15);
    });
  });

  describe('unknown category with group fallback', () => {
    it('uses Beer & Cider group default of 3', () => {
      expect(getDefaultConsumerWaste('Obscure Brew', 'Beer & Cider')).toBe(3);
    });

    it('uses Non-Alcoholic group default of 4', () => {
      expect(getDefaultConsumerWaste('Obscure NA', 'Non-Alcoholic')).toBe(4);
    });

    it('uses Ready-to-Drink group default of 2', () => {
      expect(getDefaultConsumerWaste('Obscure RTD', 'Ready-to-Drink & Cocktails')).toBe(2);
    });
  });

  describe('unknown category and unknown group', () => {
    it('returns global fallback of 5', () => {
      expect(getDefaultConsumerWaste('Totally Unknown', 'Totally Unknown Group')).toBe(5);
    });
  });
});

// ============================================================================
// getConsumerWasteEntry (extended)
// ============================================================================

describe('getConsumerWasteEntry (extended)', () => {
  describe('returns full entry with rate, source, and confidence', () => {
    it('Gin entry has rate=1, high confidence, and a source citation', () => {
      const entry = getConsumerWasteEntry('Gin');
      expect(entry).not.toBeNull();
      expect(entry!.rate).toBe(1);
      expect(entry!.confidence).toBe('high');
      expect(entry!.source).toBeTruthy();
      expect(entry!.source.length).toBeGreaterThan(0);
    });

    it('Lager entry has rate=3, high confidence', () => {
      const entry = getConsumerWasteEntry('Lager');
      expect(entry).not.toBeNull();
      expect(entry!.rate).toBe(3);
      expect(entry!.confidence).toBe('high');
    });

    it('Red Wine entry has rate=10, high confidence', () => {
      const entry = getConsumerWasteEntry('Red Wine');
      expect(entry).not.toBeNull();
      expect(entry!.rate).toBe(10);
      expect(entry!.confidence).toBe('high');
    });

    it('Natural Wine entry has rate=12, medium confidence', () => {
      const entry = getConsumerWasteEntry('Natural Wine');
      expect(entry).not.toBeNull();
      expect(entry!.rate).toBe(12);
      expect(entry!.confidence).toBe('medium');
    });

    it('Hard Kombucha has low confidence (estimated by analogy)', () => {
      const entry = getConsumerWasteEntry('Hard Kombucha');
      expect(entry).not.toBeNull();
      expect(entry!.confidence).toBe('low');
    });
  });

  describe('returns null for unknown or missing categories', () => {
    it('returns null for an unrecognised category string', () => {
      expect(getConsumerWasteEntry('Imaginary Drink')).toBeNull();
    });

    it('returns null for null', () => {
      expect(getConsumerWasteEntry(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(getConsumerWasteEntry(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(getConsumerWasteEntry('')).toBeNull();
    });
  });
});

// ============================================================================
// calculateLossMultiplier (extended)
// ============================================================================

describe('calculateLossMultiplier (extended)', () => {
  describe('cradle-to-gate returns 1.0 (no downstream losses)', () => {
    it('returns 1.0 with default config', () => {
      expect(calculateLossMultiplier('cradle-to-gate', makeLossConfig())).toBe(1.0);
    });

    it('returns 1.0 even with high loss rates', () => {
      expect(
        calculateLossMultiplier(
          'cradle-to-gate',
          makeLossConfig({
            distributionLossPercent: 50,
            retailLossPercent: 50,
            consumerWastePercent: 50,
          }),
        ),
      ).toBe(1.0);
    });
  });

  describe('cradle-to-grave with typical config', () => {
    it('compounds all three loss stages correctly', () => {
      const config = makeLossConfig({
        distributionLossPercent: 2,
        retailLossPercent: 3,
        consumerWastePercent: 10,
      });
      const result = calculateLossMultiplier('cradle-to-grave', config);
      const expected = 1 / ((1 - 0.02) * (1 - 0.03) * (1 - 0.10));
      expect(result).toBeCloseTo(expected, 6);
    });

    it('multiplier is always >= 1.0 for valid loss rates', () => {
      const config = makeLossConfig({
        distributionLossPercent: 5,
        retailLossPercent: 5,
        consumerWastePercent: 5,
      });
      expect(calculateLossMultiplier('cradle-to-grave', config)).toBeGreaterThanOrEqual(1.0);
    });
  });

  describe('zero-loss config returns multiplier of 1.0', () => {
    it('all rates at zero', () => {
      const config = makeLossConfig({
        distributionLossPercent: 0,
        retailLossPercent: 0,
        consumerWastePercent: 0,
      });
      expect(calculateLossMultiplier('cradle-to-grave', config)).toBe(1.0);
    });
  });

  describe('max-loss edge cases', () => {
    it('all rates at 50% returns guarded value', () => {
      const config = makeLossConfig({
        distributionLossPercent: 50,
        retailLossPercent: 50,
        consumerWastePercent: 50,
      });
      const result = calculateLossMultiplier('cradle-to-grave', config);
      // survival = 0.5 * 0.5 * 0.5 = 0.125 -> multiplier = 8.0
      expect(result).toBeCloseTo(8.0, 4);
    });

    it('100% distribution loss returns 1.0 (survival guard)', () => {
      const config = makeLossConfig({
        distributionLossPercent: 100,
        retailLossPercent: 0,
        consumerWastePercent: 0,
      });
      // survival = 0 -> guard returns 1.0
      expect(calculateLossMultiplier('cradle-to-grave', config)).toBe(1.0);
    });

    it('all rates at 100% returns 1.0 (survival guard)', () => {
      const config = makeLossConfig({
        distributionLossPercent: 100,
        retailLossPercent: 100,
        consumerWastePercent: 100,
      });
      expect(calculateLossMultiplier('cradle-to-grave', config)).toBe(1.0);
    });
  });

  describe('different boundaries include different loss stages', () => {
    const config: ProductLossConfig = {
      distributionLossPercent: 10,
      retailLossPercent: 10,
      consumerWastePercent: 10,
    };

    it('cradle-to-gate: no losses, multiplier = 1.0', () => {
      expect(calculateLossMultiplier('cradle-to-gate', config)).toBe(1.0);
    });

    it('cradle-to-shelf: distribution + retail loss', () => {
      // Retail loss is a distribution-chain event, included at distribution stage
      const result = calculateLossMultiplier('cradle-to-shelf', config);
      expect(result).toBeCloseTo(1 / (0.9 * 0.9), 6);
    });

    it('cradle-to-consumer: distribution + retail + consumer loss', () => {
      // Consumer waste is a use-phase event
      const result = calculateLossMultiplier('cradle-to-consumer', config);
      expect(result).toBeCloseTo(1 / (0.9 * 0.9 * 0.9), 6);
    });

    it('cradle-to-grave: all three loss stages', () => {
      const result = calculateLossMultiplier('cradle-to-grave', config);
      expect(result).toBeCloseTo(1 / (0.9 * 0.9 * 0.9), 6);
    });

    it('wider boundaries produce larger multipliers', () => {
      const gate = calculateLossMultiplier('cradle-to-gate', config);
      const shelf = calculateLossMultiplier('cradle-to-shelf', config);
      const consumer = calculateLossMultiplier('cradle-to-consumer', config);
      const grave = calculateLossMultiplier('cradle-to-grave', config);
      expect(gate).toBeLessThanOrEqual(shelf);
      expect(shelf).toBeLessThanOrEqual(consumer);
      expect(consumer).toBeLessThanOrEqual(grave);
    });
  });

  describe('no config provided', () => {
    it('returns 1.0 when config is undefined', () => {
      expect(calculateLossMultiplier('cradle-to-grave', undefined)).toBe(1.0);
    });

    it('returns 1.0 when config is omitted', () => {
      expect(calculateLossMultiplier('cradle-to-grave')).toBe(1.0);
    });
  });
});
