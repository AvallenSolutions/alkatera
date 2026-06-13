import { describe, it, expect } from 'vitest';
import {
  scoreIngredientMatch,
  rankIngredientMatches,
  DEFAULT_MIN_CONFIDENCE,
  type CandidateProduct,
} from '../ingredient-matcher';

function candidate(over: Partial<CandidateProduct> & { id: string; name: string }): CandidateProduct {
  return { ...over };
}

describe('scoreIngredientMatch', () => {
  it('scores an exact name match near the top', () => {
    const s = scoreIngredientMatch({ name: 'Cane Sugar' }, candidate({ id: '1', name: 'Cane Sugar' }));
    expect(s.confidence).toBeGreaterThanOrEqual(1);
    expect(s.matchedBy).toContain('name');
  });

  it('matches reordered/punctuated names ("organic milk" vs "milk, organic")', () => {
    const s = scoreIngredientMatch({ name: 'organic milk' }, candidate({ id: '1', name: 'Milk, Organic' }));
    expect(s.confidence).toBeGreaterThan(0.5);
  });

  it('returns zero when there is no name overlap', () => {
    const s = scoreIngredientMatch({ name: 'Glass bottle' }, candidate({ id: '1', name: 'Cane sugar' }));
    expect(s.confidence).toBe(0);
    expect(s.matchedBy).toBe('none');
  });

  it('lifts confidence when category and unit agree', () => {
    const base = scoreIngredientMatch({ name: 'apple juice' }, candidate({ id: '1', name: 'apple juice concentrate' }));
    const boosted = scoreIngredientMatch(
      { name: 'apple juice', category: 'ingredient', unit: 'kg' },
      candidate({ id: '1', name: 'apple juice concentrate', category: 'ingredient', unit: 'kg' }),
    );
    expect(boosted.confidence).toBeGreaterThan(base.confidence);
    expect(boosted.reason).toContain('same category');
    expect(boosted.reason).toContain('matching unit');
  });

  it('does not promote an unrelated product on category alone', () => {
    const s = scoreIngredientMatch(
      { name: 'water', category: 'ingredient' },
      candidate({ id: '1', name: 'aluminium can', category: 'ingredient' }),
    );
    expect(s.confidence).toBe(0);
  });

  it('reason strings are plain language without jargon', () => {
    const s = scoreIngredientMatch({ name: 'malt', category: 'ingredient', unit: 'kg' }, candidate({ id: '1', name: 'pale malt', category: 'ingredient', unit: 'kg' }));
    expect(s.reason).not.toMatch(/jaccard|token|—|_/i);
    expect(s.reason).toMatch(/Name \d+% similar/);
  });
});

describe('rankIngredientMatches', () => {
  const candidates: CandidateProduct[] = [
    candidate({ id: 'exact', name: 'Cascade Hops' }),
    candidate({ id: 'partial', name: 'Cascade Hops Pellets T90' }),
    candidate({ id: 'unrelated', name: 'Glass Bottle 750ml' }),
  ];

  it('returns the best match first and drops below-threshold candidates', () => {
    const out = rankIngredientMatches({ name: 'Cascade Hops' }, candidates, { limit: 3 });
    expect(out[0].candidate.id).toBe('exact');
    expect(out.some((m) => m.candidate.id === 'unrelated')).toBe(false);
  });

  it('defaults to the single best candidate', () => {
    const out = rankIngredientMatches({ name: 'Cascade Hops' }, candidates);
    expect(out).toHaveLength(1);
    expect(out[0].candidate.id).toBe('exact');
  });

  it('returns nothing when no candidate clears the floor', () => {
    const out = rankIngredientMatches({ name: 'Yuzu extract' }, candidates);
    expect(out).toHaveLength(0);
  });

  it('respects a custom minimum', () => {
    const loose = rankIngredientMatches({ name: 'Cascade' }, candidates, { min: 0.1, limit: 5 });
    const strict = rankIngredientMatches({ name: 'Cascade' }, candidates, { min: 0.95, limit: 5 });
    expect(loose.length).toBeGreaterThanOrEqual(strict.length);
  });

  it('DEFAULT_MIN_CONFIDENCE is a sensible floor', () => {
    expect(DEFAULT_MIN_CONFIDENCE).toBeGreaterThan(0);
    expect(DEFAULT_MIN_CONFIDENCE).toBeLessThan(1);
  });
});
