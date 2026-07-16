import { describe, expect, it } from 'vitest';
import {
  materialImpactShare,
  activityImpactShare,
  priorityScore,
  sortByPriority,
  FALLBACK_IMPACT_TIER,
  type MaterialImpactContext,
} from '../impact';

describe('materialImpactShare (pure)', () => {
  const ctx: MaterialImpactContext = {
    byMaterial: [
      { name: 'Barley', climate: 0.6 },
      { name: 'Glass bottle', climate: 0.3 },
      { name: 'barley', climate: 0.1 }, // case-variant duplicate, should still sum
    ],
    totalClimateKg: 1.0,
  };

  it('sums matching materials (case-insensitive) over the total', () => {
    expect(materialImpactShare('Barley', ctx)).toBeCloseTo(0.7, 5);
  });

  it('matches a single material exactly', () => {
    expect(materialImpactShare('Glass Bottle', ctx)).toBeCloseTo(0.3, 5);
  });

  it('returns null when nothing matches', () => {
    expect(materialImpactShare('Aluminium can', ctx)).toBeNull();
  });

  it('returns null with no context', () => {
    expect(materialImpactShare('Barley', null)).toBeNull();
  });

  it('returns null when the total is zero or negative', () => {
    expect(materialImpactShare('Barley', { byMaterial: ctx.byMaterial, totalClimateKg: 0 })).toBeNull();
  });

  it('clamps to 1 when a match somehow exceeds the total', () => {
    const skewed: MaterialImpactContext = { byMaterial: [{ name: 'X', climate: 5 }], totalClimateKg: 1 };
    expect(materialImpactShare('X', skewed)).toBe(1);
  });
});

describe('activityImpactShare (pure)', () => {
  it('divides entry emissions by org total', () => {
    expect(activityImpactShare(250, 1000)).toBeCloseTo(0.25, 5);
  });

  it('returns null when either figure is missing', () => {
    expect(activityImpactShare(null, 1000)).toBeNull();
    expect(activityImpactShare(250, null)).toBeNull();
  });

  it('returns null when either figure is non-positive', () => {
    expect(activityImpactShare(0, 1000)).toBeNull();
    expect(activityImpactShare(250, 0)).toBeNull();
    expect(activityImpactShare(-5, 1000)).toBeNull();
  });

  it('clamps to 1 when the entry exceeds the org total (a stale snapshot)', () => {
    expect(activityImpactShare(1500, 1000)).toBe(1);
  });
});

describe('priorityScore (pure)', () => {
  it('uses the real share when computable', () => {
    expect(priorityScore('draft_gap_material', 0.42)).toBe(0.42);
  });

  it('falls back to a small negative tier-derived score when not computable', () => {
    const score = priorityScore('plausibility_production_run', null);
    expect(score).toBeLessThan(0);
    expect(score).toBeGreaterThan(-1);
  });

  it('every real share always outranks every fallback score', () => {
    const worstReal = priorityScore('growth_signal', 0.0001);
    for (const askType of Object.keys(FALLBACK_IMPACT_TIER) as Array<keyof typeof FALLBACK_IMPACT_TIER>) {
      const fallback = priorityScore(askType, null);
      expect(worstReal).toBeGreaterThan(fallback);
    }
  });

  it('a more urgent fallback tier scores higher than a less urgent one', () => {
    const plausibility = priorityScore('plausibility_production_run', null); // tier 1
    const growth = priorityScore('growth_signal', null); // tier 5
    expect(plausibility).toBeGreaterThan(growth);
  });
});

describe('sortByPriority (pure)', () => {
  it('orders highest priority_score first', () => {
    const items = [
      { id: 'a', payload: { priority_score: 0.1 } },
      { id: 'b', payload: { priority_score: 0.9 } },
      { id: 'c', payload: { priority_score: 0.5 } },
    ];
    expect(sortByPriority(items).map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the input array', () => {
    const items = [
      { id: 'a', payload: { priority_score: 0.1 } },
      { id: 'b', payload: { priority_score: 0.9 } },
    ];
    const copy = [...items];
    sortByPriority(items);
    expect(items).toEqual(copy);
  });
});
