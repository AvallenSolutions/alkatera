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
  SYSTEM_BOUNDARIES,
  ALL_LIFECYCLE_STAGES,
  STAGE_LABELS,
  type SystemBoundary,
  type LifecycleStage,
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
