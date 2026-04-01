/**
 * System Boundaries Test Suite
 *
 * Tests all boundary definitions, stage inclusion/exclusion,
 * helper functions, and DB enum conversion.
 */

import { describe, it, expect } from 'vitest';
import {
  getBoundaryDefinition,
  getBoundaryLabel,
  getBoundaryIncludedStages,
  getBoundaryExcludedStages,
  isStageIncluded,
  boundaryNeedsUsePhase,
  boundaryNeedsEndOfLife,
  boundaryToDbEnum,
  boundaryFromDbEnum,
  calculateLossMultiplier,
  getDefaultConsumerWaste,
  getDefaultLossConfig,
  getConsumerWasteEntry,
  DEFAULT_PRODUCT_LOSS_CONFIG,
  CONSUMER_WASTE_BY_CATEGORY,
  CONSUMER_WASTE_BY_GROUP,
  CONSUMER_WASTE_DATA,
  SYSTEM_BOUNDARIES,
  ALL_LIFECYCLE_STAGES,
  STAGE_LABELS,
  type SystemBoundary,
  type LifecycleStage,
  type ProductLossConfig,
} from '../system-boundaries';

// ============================================================================
// BOUNDARY DEFINITIONS
// ============================================================================

describe('System Boundaries', () => {
  describe('SYSTEM_BOUNDARIES constant', () => {
    it('defines exactly 4 boundaries', () => {
      expect(SYSTEM_BOUNDARIES).toHaveLength(4);
    });

    it('boundaries are in progressive order (gate → shelf → consumer → grave)', () => {
      const values = SYSTEM_BOUNDARIES.map(b => b.value);
      expect(values).toEqual([
        'cradle-to-gate',
        'cradle-to-shelf',
        'cradle-to-consumer',
        'cradle-to-grave',
      ]);
    });

    it('each boundary has label, shortLabel, description, and includedStages', () => {
      for (const boundary of SYSTEM_BOUNDARIES) {
        expect(boundary.value).toBeTruthy();
        expect(boundary.label).toBeTruthy();
        expect(boundary.shortLabel).toBeTruthy();
        expect(boundary.description).toBeTruthy();
        expect(boundary.includedStages.length).toBeGreaterThan(0);
      }
    });

    it('wider boundaries include all stages from narrower boundaries', () => {
      for (let i = 1; i < SYSTEM_BOUNDARIES.length; i++) {
        const wider = new Set(SYSTEM_BOUNDARIES[i].includedStages);
        const narrower = SYSTEM_BOUNDARIES[i - 1].includedStages;
        for (const stage of narrower) {
          expect(wider.has(stage)).toBe(true);
        }
      }
    });
  });

  describe('ALL_LIFECYCLE_STAGES', () => {
    it('contains exactly 6 stages', () => {
      expect(ALL_LIFECYCLE_STAGES).toHaveLength(6);
    });

    it('includes all expected stages', () => {
      expect(ALL_LIFECYCLE_STAGES).toContain('raw_materials');
      expect(ALL_LIFECYCLE_STAGES).toContain('processing');
      expect(ALL_LIFECYCLE_STAGES).toContain('packaging');
      expect(ALL_LIFECYCLE_STAGES).toContain('distribution');
      expect(ALL_LIFECYCLE_STAGES).toContain('use_phase');
      expect(ALL_LIFECYCLE_STAGES).toContain('end_of_life');
    });
  });

  describe('STAGE_LABELS', () => {
    it('has a label for every lifecycle stage', () => {
      for (const stage of ALL_LIFECYCLE_STAGES) {
        expect(STAGE_LABELS[stage]).toBeTruthy();
      }
    });
  });
});

// ============================================================================
// CRADLE-TO-GATE
// ============================================================================

describe('Cradle-to-Gate boundary', () => {
  const boundary = 'cradle-to-gate';

  it('includes raw_materials, processing, packaging', () => {
    const stages = getBoundaryIncludedStages(boundary);
    expect(stages).toContain('raw_materials');
    expect(stages).toContain('processing');
    expect(stages).toContain('packaging');
  });

  it('excludes distribution, use_phase, end_of_life', () => {
    const excluded = getBoundaryExcludedStages(boundary);
    expect(excluded).toContain('distribution');
    expect(excluded).toContain('use_phase');
    expect(excluded).toContain('end_of_life');
  });

  it('has 3 included stages', () => {
    expect(getBoundaryIncludedStages(boundary)).toHaveLength(3);
  });
});

// ============================================================================
// CRADLE-TO-SHELF
// ============================================================================

describe('Cradle-to-Shelf boundary', () => {
  const boundary = 'cradle-to-shelf';

  it('includes distribution in addition to gate stages', () => {
    const stages = getBoundaryIncludedStages(boundary);
    expect(stages).toContain('raw_materials');
    expect(stages).toContain('processing');
    expect(stages).toContain('packaging');
    expect(stages).toContain('distribution');
  });

  it('excludes use_phase and end_of_life', () => {
    const excluded = getBoundaryExcludedStages(boundary);
    expect(excluded).toContain('use_phase');
    expect(excluded).toContain('end_of_life');
  });

  it('has 4 included stages', () => {
    expect(getBoundaryIncludedStages(boundary)).toHaveLength(4);
  });
});

// ============================================================================
// CRADLE-TO-CONSUMER
// ============================================================================

describe('Cradle-to-Consumer boundary', () => {
  const boundary = 'cradle-to-consumer';

  it('includes use_phase in addition to shelf stages', () => {
    const stages = getBoundaryIncludedStages(boundary);
    expect(stages).toContain('use_phase');
    expect(stages).toContain('distribution');
  });

  it('excludes only end_of_life', () => {
    const excluded = getBoundaryExcludedStages(boundary);
    expect(excluded).toEqual(['end_of_life']);
  });

  it('has 5 included stages', () => {
    expect(getBoundaryIncludedStages(boundary)).toHaveLength(5);
  });
});

// ============================================================================
// CRADLE-TO-GRAVE
// ============================================================================

describe('Cradle-to-Grave boundary', () => {
  const boundary = 'cradle-to-grave';

  it('includes all 6 lifecycle stages', () => {
    const stages = getBoundaryIncludedStages(boundary);
    expect(stages).toHaveLength(6);
    for (const stage of ALL_LIFECYCLE_STAGES) {
      expect(stages).toContain(stage);
    }
  });

  it('excludes no stages', () => {
    const excluded = getBoundaryExcludedStages(boundary);
    expect(excluded).toHaveLength(0);
  });
});

// ============================================================================
// getBoundaryDefinition
// ============================================================================

describe('getBoundaryDefinition', () => {
  it('returns the correct definition for each valid boundary', () => {
    const boundaries: SystemBoundary[] = [
      'cradle-to-gate', 'cradle-to-shelf', 'cradle-to-consumer', 'cradle-to-grave',
    ];
    for (const b of boundaries) {
      const def = getBoundaryDefinition(b);
      expect(def.value).toBe(b);
    }
  });

  it('defaults to cradle-to-gate for unknown boundary', () => {
    const def = getBoundaryDefinition('unknown-boundary');
    expect(def.value).toBe('cradle-to-gate');
  });

  it('defaults to cradle-to-gate for empty string', () => {
    const def = getBoundaryDefinition('');
    expect(def.value).toBe('cradle-to-gate');
  });
});

// ============================================================================
// getBoundaryLabel
// ============================================================================

describe('getBoundaryLabel', () => {
  it('returns human-readable labels', () => {
    expect(getBoundaryLabel('cradle-to-gate')).toBe('Cradle-to-Gate');
    expect(getBoundaryLabel('cradle-to-shelf')).toBe('Cradle-to-Shelf');
    expect(getBoundaryLabel('cradle-to-consumer')).toBe('Cradle-to-Consumer');
    expect(getBoundaryLabel('cradle-to-grave')).toBe('Cradle-to-Grave');
  });

  it('returns gate label for unknown boundary', () => {
    expect(getBoundaryLabel('nonsense')).toBe('Cradle-to-Gate');
  });
});

// ============================================================================
// isStageIncluded
// ============================================================================

describe('isStageIncluded', () => {
  it('returns true for raw_materials in all boundaries', () => {
    const boundaries = ['cradle-to-gate', 'cradle-to-shelf', 'cradle-to-consumer', 'cradle-to-grave'];
    for (const b of boundaries) {
      expect(isStageIncluded(b, 'raw_materials')).toBe(true);
    }
  });

  it('returns false for use_phase in gate boundary', () => {
    expect(isStageIncluded('cradle-to-gate', 'use_phase')).toBe(false);
  });

  it('returns false for use_phase in shelf boundary', () => {
    expect(isStageIncluded('cradle-to-shelf', 'use_phase')).toBe(false);
  });

  it('returns true for use_phase in consumer boundary', () => {
    expect(isStageIncluded('cradle-to-consumer', 'use_phase')).toBe(true);
  });

  it('returns true for end_of_life only in grave boundary', () => {
    expect(isStageIncluded('cradle-to-gate', 'end_of_life')).toBe(false);
    expect(isStageIncluded('cradle-to-shelf', 'end_of_life')).toBe(false);
    expect(isStageIncluded('cradle-to-consumer', 'end_of_life')).toBe(false);
    expect(isStageIncluded('cradle-to-grave', 'end_of_life')).toBe(true);
  });

  it('returns false for unknown stage names', () => {
    expect(isStageIncluded('cradle-to-grave', 'unknown_stage')).toBe(false);
  });
});

// ============================================================================
// boundaryNeedsUsePhase / boundaryNeedsEndOfLife
// ============================================================================

describe('boundaryNeedsUsePhase', () => {
  it('returns false for cradle-to-gate', () => {
    expect(boundaryNeedsUsePhase('cradle-to-gate')).toBe(false);
  });

  it('returns false for cradle-to-shelf', () => {
    expect(boundaryNeedsUsePhase('cradle-to-shelf')).toBe(false);
  });

  it('returns true for cradle-to-consumer', () => {
    expect(boundaryNeedsUsePhase('cradle-to-consumer')).toBe(true);
  });

  it('returns true for cradle-to-grave', () => {
    expect(boundaryNeedsUsePhase('cradle-to-grave')).toBe(true);
  });

  it('returns false for unknown boundary', () => {
    expect(boundaryNeedsUsePhase('unknown')).toBe(false);
  });
});

describe('boundaryNeedsEndOfLife', () => {
  it('returns true only for cradle-to-grave', () => {
    expect(boundaryNeedsEndOfLife('cradle-to-gate')).toBe(false);
    expect(boundaryNeedsEndOfLife('cradle-to-shelf')).toBe(false);
    expect(boundaryNeedsEndOfLife('cradle-to-consumer')).toBe(false);
    expect(boundaryNeedsEndOfLife('cradle-to-grave')).toBe(true);
  });

  it('returns false for unknown boundary', () => {
    expect(boundaryNeedsEndOfLife('nonsense')).toBe(false);
  });
});

// ============================================================================
// DB ENUM CONVERSION
// ============================================================================

describe('boundaryToDbEnum', () => {
  it('converts hyphens to underscores', () => {
    expect(boundaryToDbEnum('cradle-to-gate')).toBe('cradle_to_gate');
    expect(boundaryToDbEnum('cradle-to-shelf')).toBe('cradle_to_shelf');
    expect(boundaryToDbEnum('cradle-to-consumer')).toBe('cradle_to_consumer');
    expect(boundaryToDbEnum('cradle-to-grave')).toBe('cradle_to_grave');
  });

  it('handles strings with no hyphens unchanged', () => {
    expect(boundaryToDbEnum('nohyphens')).toBe('nohyphens');
  });
});

describe('boundaryFromDbEnum', () => {
  it('converts underscores to hyphens', () => {
    expect(boundaryFromDbEnum('cradle_to_gate')).toBe('cradle-to-gate');
    expect(boundaryFromDbEnum('cradle_to_shelf')).toBe('cradle-to-shelf');
    expect(boundaryFromDbEnum('cradle_to_consumer')).toBe('cradle-to-consumer');
    expect(boundaryFromDbEnum('cradle_to_grave')).toBe('cradle-to-grave');
  });

  it('round-trips correctly with boundaryToDbEnum', () => {
    const boundaries: SystemBoundary[] = [
      'cradle-to-gate', 'cradle-to-shelf', 'cradle-to-consumer', 'cradle-to-grave',
    ];
    for (const b of boundaries) {
      expect(boundaryFromDbEnum(boundaryToDbEnum(b))).toBe(b);
    }
  });
});

// ============================================================================
// PRODUCT LOSS MULTIPLIER
// ============================================================================

describe('calculateLossMultiplier', () => {
  it('returns 1.0 when no config is provided', () => {
    expect(calculateLossMultiplier('cradle-to-grave')).toBe(1.0);
    expect(calculateLossMultiplier('cradle-to-grave', undefined)).toBe(1.0);
  });

  it('returns 1.0 for cradle-to-gate regardless of config', () => {
    expect(calculateLossMultiplier('cradle-to-gate', DEFAULT_PRODUCT_LOSS_CONFIG)).toBe(1.0);
  });

  it('applies distribution + retail loss for cradle-to-shelf', () => {
    const config: ProductLossConfig = {
      distributionLossPercent: 2,
      retailLossPercent: 3,
      consumerWastePercent: 10,
    };
    const result = calculateLossMultiplier('cradle-to-shelf', config);
    // Distribution + retail (retail is a distribution-stage phenomenon): 1 / (0.98 × 0.97) ≈ 1.0520
    expect(result).toBeCloseTo(1 / (0.98 * 0.97), 4);
  });

  it('applies distribution + retail + consumer loss for cradle-to-consumer', () => {
    const config: ProductLossConfig = {
      distributionLossPercent: 2,
      retailLossPercent: 3,
      consumerWastePercent: 10,
    };
    const result = calculateLossMultiplier('cradle-to-consumer', config);
    // All distribution-chain + use-phase losses: 1 / (0.98 × 0.97 × 0.90) ≈ 1.1689
    expect(result).toBeCloseTo(1 / (0.98 * 0.97 * 0.90), 4);
  });

  it('applies all three loss stages for cradle-to-grave', () => {
    const config: ProductLossConfig = {
      distributionLossPercent: 2,
      retailLossPercent: 3,
      consumerWastePercent: 10,
    };
    const result = calculateLossMultiplier('cradle-to-grave', config);
    // All three: 1 / (0.98 × 0.97 × 0.90) ≈ 1.1689
    expect(result).toBeCloseTo(1 / (0.98 * 0.97 * 0.90), 4);
  });

  it('returns 1.0 when all loss rates are zero', () => {
    const config: ProductLossConfig = {
      distributionLossPercent: 0,
      retailLossPercent: 0,
      consumerWastePercent: 0,
    };
    expect(calculateLossMultiplier('cradle-to-grave', config)).toBe(1.0);
  });

  it('handles 100% loss rate safely (returns 1.0, no division by zero)', () => {
    const config: ProductLossConfig = {
      distributionLossPercent: 100,
      retailLossPercent: 0,
      consumerWastePercent: 0,
    };
    // Survival = 0 → should return 1.0 (guard)
    expect(calculateLossMultiplier('cradle-to-shelf', config)).toBe(1.0);
  });

  it('handles single-stage loss correctly', () => {
    // Only 5% distribution loss
    const config: ProductLossConfig = {
      distributionLossPercent: 5,
      retailLossPercent: 0,
      consumerWastePercent: 0,
    };
    const result = calculateLossMultiplier('cradle-to-grave', config);
    // Only distribution applies (retail and consumer are 0)
    expect(result).toBeCloseTo(1 / 0.95, 4);
  });

  it('DEFAULT_PRODUCT_LOSS_CONFIG has expected values', () => {
    expect(DEFAULT_PRODUCT_LOSS_CONFIG.distributionLossPercent).toBe(2);
    expect(DEFAULT_PRODUCT_LOSS_CONFIG.retailLossPercent).toBe(3);
    expect(DEFAULT_PRODUCT_LOSS_CONFIG.consumerWastePercent).toBe(5);
  });
});

// ============================================================================
// CATEGORY-AWARE CONSUMER WASTE DEFAULTS
// ============================================================================

describe('CONSUMER_WASTE_BY_CATEGORY', () => {
  it('has entries for all spirits categories', () => {
    const spirits = ['Gin', 'Vodka', 'Rum', 'Whisky', 'Tequila', 'Mezcal', 'Brandy', 'Bourbon', 'Rye Whiskey', 'Calvados', 'Baijiu', 'Aquavit'];
    for (const s of spirits) {
      expect(CONSUMER_WASTE_BY_CATEGORY[s]).toBeDefined();
      expect(CONSUMER_WASTE_BY_CATEGORY[s]).toBeLessThanOrEqual(3); // Spirits are low waste
    }
  });

  it('has entries for all beer & cider categories', () => {
    const beers = ['Lager', 'Ale', 'IPA', 'Stout & Porter', 'Wheat Beer', 'Sour Beer', 'Cider', 'Perry'];
    for (const b of beers) {
      expect(CONSUMER_WASTE_BY_CATEGORY[b]).toBe(3);
    }
  });

  it('has entries for wine categories', () => {
    expect(CONSUMER_WASTE_BY_CATEGORY['Red Wine']).toBe(10);
    expect(CONSUMER_WASTE_BY_CATEGORY['White Wine']).toBe(10);
    expect(CONSUMER_WASTE_BY_CATEGORY['Sparkling Wine']).toBe(15); // Higher due to carbonation loss
    expect(CONSUMER_WASTE_BY_CATEGORY['Fortified Wine']).toBe(3); // Higher ABV, self-preserving
  });

  it('spirits have lower waste than wine', () => {
    expect(CONSUMER_WASTE_BY_CATEGORY['Gin']).toBeLessThan(CONSUMER_WASTE_BY_CATEGORY['Red Wine']);
    expect(CONSUMER_WASTE_BY_CATEGORY['Vodka']).toBeLessThan(CONSUMER_WASTE_BY_CATEGORY['White Wine']);
  });

  it('all values are between 0 and 50', () => {
    for (const [, value] of Object.entries(CONSUMER_WASTE_BY_CATEGORY)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(50);
    }
  });
});

describe('CONSUMER_WASTE_BY_GROUP', () => {
  it('covers all product type groups', () => {
    expect(CONSUMER_WASTE_BY_GROUP['Spirits']).toBe(1);
    expect(CONSUMER_WASTE_BY_GROUP['Beer & Cider']).toBe(3);
    expect(CONSUMER_WASTE_BY_GROUP['Wine']).toBe(10);
    expect(CONSUMER_WASTE_BY_GROUP['Ready-to-Drink & Cocktails']).toBe(2);
    expect(CONSUMER_WASTE_BY_GROUP['Non-Alcoholic']).toBe(4);
  });
});

describe('getDefaultConsumerWaste', () => {
  it('returns category-specific value when category is recognised', () => {
    expect(getDefaultConsumerWaste('Gin', 'Spirits')).toBe(1);
    expect(getDefaultConsumerWaste('Red Wine', 'Wine')).toBe(10);
    expect(getDefaultConsumerWaste('Sparkling Wine', 'Wine')).toBe(15);
    expect(getDefaultConsumerWaste('Lager', 'Beer & Cider')).toBe(3);
  });

  it('falls back to group default when category is not recognised', () => {
    expect(getDefaultConsumerWaste('Unknown Category', 'Spirits')).toBe(1);
    expect(getDefaultConsumerWaste('Unknown Category', 'Wine')).toBe(10);
  });

  it('falls back to 5% when neither category nor group is recognised', () => {
    expect(getDefaultConsumerWaste('Unknown', 'Unknown')).toBe(5);
    expect(getDefaultConsumerWaste(null, null)).toBe(5);
    expect(getDefaultConsumerWaste(undefined, undefined)).toBe(5);
  });

  it('prefers category over group', () => {
    // Fortified Wine is 3%, but Wine group default is 10%
    expect(getDefaultConsumerWaste('Fortified Wine', 'Wine')).toBe(3);
    // Liqueur is 3%, but Spirits group default is 1%
    expect(getDefaultConsumerWaste('Liqueur', 'Spirits')).toBe(3);
  });
});

describe('CONSUMER_WASTE_DATA (source annotations)', () => {
  it('every entry has a non-empty source string', () => {
    for (const [category, entry] of Object.entries(CONSUMER_WASTE_DATA)) {
      expect(entry.source).toBeTruthy();
      expect(entry.source.length).toBeGreaterThan(5);
    }
  });

  it('every entry has a valid confidence level', () => {
    for (const [, entry] of Object.entries(CONSUMER_WASTE_DATA)) {
      expect(['high', 'medium', 'low']).toContain(entry.confidence);
    }
  });

  it('rate in CONSUMER_WASTE_DATA matches CONSUMER_WASTE_BY_CATEGORY', () => {
    for (const [category, entry] of Object.entries(CONSUMER_WASTE_DATA)) {
      expect(CONSUMER_WASTE_BY_CATEGORY[category]).toBe(entry.rate);
    }
  });

  it('spirits have high confidence', () => {
    expect(CONSUMER_WASTE_DATA['Gin'].confidence).toBe('high');
    expect(CONSUMER_WASTE_DATA['Vodka'].confidence).toBe('high');
    expect(CONSUMER_WASTE_DATA['Whisky'].confidence).toBe('high');
  });

  it('beer has high confidence', () => {
    expect(CONSUMER_WASTE_DATA['Lager'].confidence).toBe('high');
    expect(CONSUMER_WASTE_DATA['Ale'].confidence).toBe('high');
  });

  it('still wine has high confidence', () => {
    expect(CONSUMER_WASTE_DATA['Red Wine'].confidence).toBe('high');
    expect(CONSUMER_WASTE_DATA['White Wine'].confidence).toBe('high');
  });

  it('non-alcoholic categories have low confidence (estimated by analogy)', () => {
    expect(CONSUMER_WASTE_DATA['Non-Alcoholic Beer'].confidence).toBe('low');
    expect(CONSUMER_WASTE_DATA['Non-Alcoholic Wine'].confidence).toBe('low');
  });
});

describe('getConsumerWasteEntry', () => {
  it('returns full entry for known category', () => {
    const entry = getConsumerWasteEntry('Red Wine');
    expect(entry).not.toBeNull();
    expect(entry!.rate).toBe(10);
    expect(entry!.source).toContain('WRAP');
    expect(entry!.confidence).toBe('high');
  });

  it('returns null for unknown category', () => {
    expect(getConsumerWasteEntry('Unknown')).toBeNull();
    expect(getConsumerWasteEntry(null)).toBeNull();
    expect(getConsumerWasteEntry(undefined)).toBeNull();
  });
});

describe('getDefaultLossConfig', () => {
  it('returns a full ProductLossConfig with category-aware consumer waste', () => {
    const config = getDefaultLossConfig('Gin', 'Spirits');
    expect(config.distributionLossPercent).toBe(2);
    expect(config.retailLossPercent).toBe(3);
    expect(config.consumerWastePercent).toBe(1);
  });

  it('uses group fallback when category unknown', () => {
    const config = getDefaultLossConfig(null, 'Wine');
    expect(config.consumerWastePercent).toBe(10);
  });

  it('uses global fallback when nothing recognised', () => {
    const config = getDefaultLossConfig(null, null);
    expect(config.consumerWastePercent).toBe(5);
  });
});
