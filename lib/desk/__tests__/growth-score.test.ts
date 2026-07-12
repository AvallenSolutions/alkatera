import { describe, expect, it } from 'vitest';
import {
  GROWTH_WEIGHTS,
  scoreFromIngredients,
  type GrowthIngredients,
} from '../growth-score';

const EMPTY: GrowthIngredients = {
  facilities: 0,
  members: 0,
  integrations: 0,
  products: 0,
  lcaCompletenessPct: null,
  lcasCompleted: 0,
  activityEntries12m: 0,
  suppliers: 0,
  esgSubmitted: 0,
  responsibilityAttested: 0,
  certificationsActive: 0,
  targetsActive: 0,
  reportsGenerated: 0,
  peopleScore: null,
  governanceScore: null,
  communityScore: null,
};

const FULL: GrowthIngredients = {
  facilities: 3,
  members: 5,
  integrations: 2,
  products: 12,
  lcaCompletenessPct: 100,
  lcasCompleted: 12,
  activityEntries12m: 60,
  suppliers: 20,
  esgSubmitted: 20,
  responsibilityAttested: 6,
  certificationsActive: 4,
  targetsActive: 3,
  reportsGenerated: 8,
  peopleScore: 72,
  governanceScore: 65,
  communityScore: 80,
};

describe('scoreFromIngredients', () => {
  it('scores an empty org at 0', () => {
    const { score, bands } = scoreFromIngredients(EMPTY);
    expect(score).toBe(0);
    for (const points of Object.values(bands)) expect(points).toBe(0);
  });

  it('scores a fully populated org at 100', () => {
    const { score, bands } = scoreFromIngredients(FULL);
    expect(score).toBe(100);
    for (const [band, points] of Object.entries(bands)) {
      expect(points).toBeCloseTo(GROWTH_WEIGHTS[band as keyof typeof GROWTH_WEIGHTS]);
    }
  });

  it('band weights sum to 100', () => {
    expect(Object.values(GROWTH_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('is monotonic in every count ingredient', () => {
    const countKeys: Array<keyof GrowthIngredients> = [
      'facilities',
      'members',
      'integrations',
      'products',
      'lcasCompleted',
      'activityEntries12m',
      'suppliers',
      'esgSubmitted',
      'responsibilityAttested',
      'certificationsActive',
      'targetsActive',
      'reportsGenerated',
    ];
    // A mid-journey org, so no band is already saturated.
    const mid: GrowthIngredients = {
      ...EMPTY,
      facilities: 1,
      members: 1,
      products: 2,
      lcasCompleted: 1,
      activityEntries12m: 6,
      suppliers: 2,
      esgSubmitted: 1,
      responsibilityAttested: 2,
      certificationsActive: 1,
      targetsActive: 1,
      reportsGenerated: 1,
    };
    const base = scoreFromIngredients(mid).score;
    for (const key of countKeys) {
      const bumped = scoreFromIngredients({ ...mid, [key]: (mid[key] as number) + 1 });
      expect(bumped.score, `bumping ${key} must never lower the score`).toBeGreaterThanOrEqual(
        base,
      );
    }
  });

  it('falls back to the live LCA ratio when no snapshot exists', () => {
    const withSnapshot = scoreFromIngredients({
      ...EMPTY,
      products: 4,
      lcaCompletenessPct: 50,
    });
    const withFallback = scoreFromIngredients({
      ...EMPTY,
      products: 4,
      lcaCompletenessPct: null,
      lcasCompleted: 2,
    });
    expect(withFallback.bands.production).toBeCloseTo(withSnapshot.bands.production);
  });

  it('esg credit needs suppliers (no divide-by-zero credit)', () => {
    const { bands } = scoreFromIngredients({ ...EMPTY, esgSubmitted: 5 });
    expect(bands.network).toBe(0);
  });

  it('clamps a stale snapshot above 100', () => {
    const { bands } = scoreFromIngredients({ ...EMPTY, products: 6, lcaCompletenessPct: 140 });
    expect(bands.production).toBeCloseTo(25);
  });

  it('stewardship counts present scores, including zero scores', () => {
    const { bands } = scoreFromIngredients({ ...EMPTY, peopleScore: 0, governanceScore: 50 });
    expect(bands.stewardship).toBeCloseTo((2 / 3) * 10);
  });
});
