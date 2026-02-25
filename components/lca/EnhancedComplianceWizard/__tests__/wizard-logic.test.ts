/**
 * LCA Wizard Logic Tests
 *
 * Tests the exported pure functions from WizardContext and WizardProgress:
 *   - Step ID ordering for all 4 system boundaries
 *   - Dynamic step insertion (distribution, use-phase, end-of-life)
 *   - Guide step prepending
 *   - Total step counts
 *   - Time estimates alignment with step IDs
 *   - Step definitions completeness
 */

import { describe, it, expect, vi } from 'vitest';

// Mock Supabase modules before importing WizardContext (they run at module load)
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: { getUser: vi.fn(), getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
    from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })),
  },
}));

vi.mock('@/lib/supabase/browser-client', () => ({
  getSupabaseBrowserClient: vi.fn(() => ({
    auth: { getUser: vi.fn(), getSession: vi.fn() },
    from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) })),
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import {
  getTotalSteps,
  getStepIdsForBoundary,
} from '../WizardContext';
import { getWizardSteps } from '../WizardProgress';

// ============================================================================
// STEP ID ORDERING
// ============================================================================

describe('getStepIdsForBoundary', () => {
  describe('cradle-to-gate (base, no dynamic steps)', () => {
    it('returns exactly 10 step IDs', () => {
      const ids = getStepIdsForBoundary('cradle-to-gate');
      expect(ids).toHaveLength(10);
    });

    it('starts with materials and ends with summary', () => {
      const ids = getStepIdsForBoundary('cradle-to-gate');
      expect(ids[0]).toBe('materials');
      expect(ids[ids.length - 1]).toBe('summary');
    });

    it('has boundary before calculate', () => {
      const ids = getStepIdsForBoundary('cradle-to-gate');
      const boundaryIdx = ids.indexOf('boundary');
      const calculateIdx = ids.indexOf('calculate');
      expect(boundaryIdx).toBeLessThan(calculateIdx);
    });

    it('does NOT include distribution, use-phase or end-of-life', () => {
      const ids = getStepIdsForBoundary('cradle-to-gate');
      expect(ids).not.toContain('distribution');
      expect(ids).not.toContain('use-phase');
      expect(ids).not.toContain('end-of-life');
    });

    it('has the correct full order', () => {
      const ids = getStepIdsForBoundary('cradle-to-gate');
      expect(ids).toEqual([
        'materials',
        'facilities',
        'boundary',
        'calculate',
        'goal',
        'cutoff',
        'data-quality',
        'interpretation',
        'review',
        'summary',
      ]);
    });
  });

  describe('cradle-to-shelf (adds distribution)', () => {
    it('returns exactly 11 step IDs', () => {
      const ids = getStepIdsForBoundary('cradle-to-shelf');
      expect(ids).toHaveLength(11);
    });

    it('includes distribution', () => {
      const ids = getStepIdsForBoundary('cradle-to-shelf');
      expect(ids).toContain('distribution');
    });

    it('does NOT include use-phase or end-of-life', () => {
      const ids = getStepIdsForBoundary('cradle-to-shelf');
      expect(ids).not.toContain('use-phase');
      expect(ids).not.toContain('end-of-life');
    });

    it('inserts distribution between boundary and calculate', () => {
      const ids = getStepIdsForBoundary('cradle-to-shelf');
      const boundaryIdx = ids.indexOf('boundary');
      const distIdx = ids.indexOf('distribution');
      const calculateIdx = ids.indexOf('calculate');
      expect(distIdx).toBe(boundaryIdx + 1);
      expect(calculateIdx).toBe(distIdx + 1);
    });
  });

  describe('cradle-to-consumer (adds distribution and use-phase)', () => {
    it('returns 12 step IDs', () => {
      const ids = getStepIdsForBoundary('cradle-to-consumer');
      expect(ids).toHaveLength(12);
    });

    it('includes distribution and use-phase', () => {
      const ids = getStepIdsForBoundary('cradle-to-consumer');
      expect(ids).toContain('distribution');
      expect(ids).toContain('use-phase');
    });

    it('does NOT include end-of-life', () => {
      const ids = getStepIdsForBoundary('cradle-to-consumer');
      expect(ids).not.toContain('end-of-life');
    });

    it('inserts distribution then use-phase between boundary and calculate', () => {
      const ids = getStepIdsForBoundary('cradle-to-consumer');
      const boundaryIdx = ids.indexOf('boundary');
      const distIdx = ids.indexOf('distribution');
      const usePhaseIdx = ids.indexOf('use-phase');
      const calculateIdx = ids.indexOf('calculate');
      expect(distIdx).toBe(boundaryIdx + 1);
      expect(usePhaseIdx).toBe(distIdx + 1);
      expect(calculateIdx).toBe(usePhaseIdx + 1);
    });
  });

  describe('cradle-to-grave (adds distribution, use-phase AND end-of-life)', () => {
    it('returns 13 step IDs', () => {
      const ids = getStepIdsForBoundary('cradle-to-grave');
      expect(ids).toHaveLength(13);
    });

    it('includes distribution, use-phase and end-of-life', () => {
      const ids = getStepIdsForBoundary('cradle-to-grave');
      expect(ids).toContain('distribution');
      expect(ids).toContain('use-phase');
      expect(ids).toContain('end-of-life');
    });

    it('inserts distribution, use-phase then end-of-life between boundary and calculate', () => {
      const ids = getStepIdsForBoundary('cradle-to-grave');
      const boundaryIdx = ids.indexOf('boundary');
      const distIdx = ids.indexOf('distribution');
      const usePhaseIdx = ids.indexOf('use-phase');
      const eolIdx = ids.indexOf('end-of-life');
      const calculateIdx = ids.indexOf('calculate');
      expect(distIdx).toBe(boundaryIdx + 1);
      expect(usePhaseIdx).toBe(distIdx + 1);
      expect(eolIdx).toBe(usePhaseIdx + 1);
      expect(calculateIdx).toBe(eolIdx + 1);
    });

    it('has the correct full order', () => {
      const ids = getStepIdsForBoundary('cradle-to-grave');
      expect(ids).toEqual([
        'materials',
        'facilities',
        'boundary',
        'distribution',
        'use-phase',
        'end-of-life',
        'calculate',
        'goal',
        'cutoff',
        'data-quality',
        'interpretation',
        'review',
        'summary',
      ]);
    });
  });

  describe('case sensitivity', () => {
    it('boundary matching is case-sensitive (lowercase only)', () => {
      // The system uses lowercase hyphenated values (e.g. 'cradle-to-grave').
      // Capital case values from the DB are normalised by boundaryFromDbEnum()
      // before reaching these functions. Passing capital case directly is a no-op.
      const ids = getStepIdsForBoundary('Cradle-to-Grave');
      expect(ids).not.toContain('use-phase');
      expect(ids).toHaveLength(10); // Falls back to base steps
    });

    it('DB enum format (underscores) is also not handled directly', () => {
      // DB stores 'cradle_to_grave' — must be converted via boundaryFromDbEnum() first
      const ids = getStepIdsForBoundary('cradle_to_grave');
      expect(ids).not.toContain('use-phase');
      expect(ids).toHaveLength(10);
    });
  });

  describe('with showGuide=true', () => {
    it('prepends guide step for cradle-to-gate', () => {
      const ids = getStepIdsForBoundary('cradle-to-gate', true);
      expect(ids[0]).toBe('guide');
      expect(ids).toHaveLength(11);
    });

    it('prepends guide step for cradle-to-grave', () => {
      const ids = getStepIdsForBoundary('cradle-to-grave', true);
      expect(ids[0]).toBe('guide');
      expect(ids).toHaveLength(14);
    });

    it('still places distribution/use-phase/end-of-life after boundary', () => {
      const ids = getStepIdsForBoundary('cradle-to-grave', true);
      const boundaryIdx = ids.indexOf('boundary');
      const distIdx = ids.indexOf('distribution');
      const usePhaseIdx = ids.indexOf('use-phase');
      const eolIdx = ids.indexOf('end-of-life');
      const calculateIdx = ids.indexOf('calculate');
      expect(distIdx).toBe(boundaryIdx + 1);
      expect(usePhaseIdx).toBe(distIdx + 1);
      expect(eolIdx).toBe(usePhaseIdx + 1);
      expect(calculateIdx).toBe(eolIdx + 1);
    });

    it('guide is at index 0, materials at index 1', () => {
      const ids = getStepIdsForBoundary('cradle-to-gate', true);
      expect(ids[0]).toBe('guide');
      expect(ids[1]).toBe('materials');
    });
  });

  describe('unknown/default boundary', () => {
    it('treats unknown boundary as cradle-to-gate', () => {
      const ids = getStepIdsForBoundary('some-unknown-value');
      expect(ids).toHaveLength(10);
      expect(ids).not.toContain('distribution');
      expect(ids).not.toContain('use-phase');
      expect(ids).not.toContain('end-of-life');
    });
  });
});

// ============================================================================
// TOTAL STEPS
// ============================================================================

describe('getTotalSteps', () => {
  it('returns 10 for cradle-to-gate', () => {
    expect(getTotalSteps('cradle-to-gate')).toBe(10);
  });

  it('returns 11 for cradle-to-shelf', () => {
    expect(getTotalSteps('cradle-to-shelf')).toBe(11);
  });

  it('returns 12 for cradle-to-consumer', () => {
    expect(getTotalSteps('cradle-to-consumer')).toBe(12);
  });

  it('returns 13 for cradle-to-grave', () => {
    expect(getTotalSteps('cradle-to-grave')).toBe(13);
  });

  it('returns 11 for cradle-to-gate with guide', () => {
    expect(getTotalSteps('cradle-to-gate', true)).toBe(11);
  });

  it('returns 14 for cradle-to-grave with guide', () => {
    expect(getTotalSteps('cradle-to-grave', true)).toBe(14);
  });

  it('matches getStepIdsForBoundary length for all boundaries', () => {
    const boundaries = ['cradle-to-gate', 'cradle-to-shelf', 'cradle-to-consumer', 'cradle-to-grave'];
    for (const boundary of boundaries) {
      for (const showGuide of [false, true]) {
        const total = getTotalSteps(boundary, showGuide);
        const ids = getStepIdsForBoundary(boundary, showGuide);
        expect(total).toBe(ids.length);
      }
    }
  });
});

// ============================================================================
// WIZARD STEPS (WizardProgress)
// ============================================================================

describe('getWizardSteps', () => {
  it('returns WizardStep objects with id, number, title, shortTitle, description', () => {
    const steps = getWizardSteps('cradle-to-gate');
    for (const step of steps) {
      expect(step).toHaveProperty('id');
      expect(step).toHaveProperty('number');
      expect(step).toHaveProperty('title');
      expect(step).toHaveProperty('shortTitle');
      expect(step).toHaveProperty('description');
      expect(step).toHaveProperty('estimatedMinutes');
    }
  });

  it('numbers steps sequentially starting at 1', () => {
    const steps = getWizardSteps('cradle-to-grave', true);
    steps.forEach((step, index) => {
      expect(step.number).toBe(index + 1);
    });
  });

  it('step IDs match getStepIdsForBoundary output', () => {
    const boundaries = ['cradle-to-gate', 'cradle-to-shelf', 'cradle-to-consumer', 'cradle-to-grave'];
    for (const boundary of boundaries) {
      const stepIds = getStepIdsForBoundary(boundary);
      const steps = getWizardSteps(boundary);
      expect(steps.map((s) => s.id)).toEqual(stepIds);
    }
  });

  it('step IDs match when showGuide=true', () => {
    const stepIds = getStepIdsForBoundary('cradle-to-grave', true);
    const steps = getWizardSteps('cradle-to-grave', true);
    expect(steps.map((s) => s.id)).toEqual(stepIds);
    expect(steps[0].id).toBe('guide');
    expect(steps[0].number).toBe(1);
  });

  it('all step definitions have non-empty titles', () => {
    const steps = getWizardSteps('cradle-to-grave', true);
    for (const step of steps) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.shortTitle.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
      expect(step.estimatedMinutes).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// STEP ID UNIQUENESS
// ============================================================================

describe('Step ID integrity', () => {
  it('all step IDs are unique within each boundary configuration', () => {
    const boundaries = ['cradle-to-gate', 'cradle-to-shelf', 'cradle-to-consumer', 'cradle-to-grave'];
    for (const boundary of boundaries) {
      for (const showGuide of [false, true]) {
        const ids = getStepIdsForBoundary(boundary, showGuide);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
      }
    }
  });

  it('every step ID has a title in STEP_DEFINITIONS', () => {
    const allIds = new Set<string>();
    const boundaries = ['cradle-to-gate', 'cradle-to-shelf', 'cradle-to-consumer', 'cradle-to-grave'];
    for (const boundary of boundaries) {
      for (const id of getStepIdsForBoundary(boundary, true)) {
        allIds.add(id);
      }
    }

    // getWizardSteps should return known definitions for all IDs
    const steps = getWizardSteps('cradle-to-grave', true);
    const stepsById = new Map(steps.map((s) => [s.id, s]));
    for (const id of allIds) {
      const step = stepsById.get(id);
      // If it came from cradle-to-grave+guide, it should be in the map
      if (step) {
        expect(step.title).not.toBe(id); // Should NOT fall back to the ID as title
      }
    }
  });
});

// ============================================================================
// INVARIANTS
// ============================================================================

describe('Wizard invariants', () => {
  it('boundary always appears before calculate in all configurations', () => {
    const boundaries = ['cradle-to-gate', 'cradle-to-shelf', 'cradle-to-consumer', 'cradle-to-grave'];
    for (const boundary of boundaries) {
      for (const showGuide of [false, true]) {
        const ids = getStepIdsForBoundary(boundary, showGuide);
        expect(ids.indexOf('boundary')).toBeLessThan(ids.indexOf('calculate'));
      }
    }
  });

  it('materials is always the first non-guide step', () => {
    const boundaries = ['cradle-to-gate', 'cradle-to-consumer', 'cradle-to-grave'];
    for (const boundary of boundaries) {
      const idsNoGuide = getStepIdsForBoundary(boundary, false);
      expect(idsNoGuide[0]).toBe('materials');

      const idsWithGuide = getStepIdsForBoundary(boundary, true);
      expect(idsWithGuide[0]).toBe('guide');
      expect(idsWithGuide[1]).toBe('materials');
    }
  });

  it('summary is always the last step', () => {
    const boundaries = ['cradle-to-gate', 'cradle-to-shelf', 'cradle-to-consumer', 'cradle-to-grave'];
    for (const boundary of boundaries) {
      for (const showGuide of [false, true]) {
        const ids = getStepIdsForBoundary(boundary, showGuide);
        expect(ids[ids.length - 1]).toBe('summary');
      }
    }
  });

  it('distribution always comes before use-phase when both present', () => {
    const boundaries = ['cradle-to-consumer', 'cradle-to-grave'];
    for (const boundary of boundaries) {
      const ids = getStepIdsForBoundary(boundary);
      expect(ids.indexOf('distribution')).toBeLessThan(ids.indexOf('use-phase'));
    }
  });

  it('use-phase always comes before end-of-life when both present', () => {
    const ids = getStepIdsForBoundary('cradle-to-grave');
    expect(ids.indexOf('use-phase')).toBeLessThan(ids.indexOf('end-of-life'));
  });

  it('distribution is always between boundary and calculate when present', () => {
    const boundaries = ['cradle-to-shelf', 'cradle-to-consumer', 'cradle-to-grave'];
    for (const boundary of boundaries) {
      for (const showGuide of [false, true]) {
        const ids = getStepIdsForBoundary(boundary, showGuide);
        const distIdx = ids.indexOf('distribution');
        expect(distIdx).toBeGreaterThan(ids.indexOf('boundary'));
        expect(distIdx).toBeLessThan(ids.indexOf('calculate'));
      }
    }
  });

  it('dynamic steps are always between boundary and calculate', () => {
    const ids = getStepIdsForBoundary('cradle-to-grave', true);
    const boundaryIdx = ids.indexOf('boundary');
    const calculateIdx = ids.indexOf('calculate');
    const distIdx = ids.indexOf('distribution');
    const usePhaseIdx = ids.indexOf('use-phase');
    const eolIdx = ids.indexOf('end-of-life');

    expect(distIdx).toBeGreaterThan(boundaryIdx);
    expect(distIdx).toBeLessThan(calculateIdx);
    expect(usePhaseIdx).toBeGreaterThan(boundaryIdx);
    expect(usePhaseIdx).toBeLessThan(calculateIdx);
    expect(eolIdx).toBeGreaterThan(boundaryIdx);
    expect(eolIdx).toBeLessThan(calculateIdx);
  });
});
