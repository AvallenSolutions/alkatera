import { describe, it, expect } from 'vitest';
import {
  summariseSupplierEsg,
  summariseSupplierClimate,
  SUPPLIER_ESG_COVERAGE_TARGET,
  DUE_DILIGENCE_QUESTION_IDS,
  type SupplierEsgRow,
} from '../supplier-esg-evidence';
import { getBcorpQuestionIds } from '@/lib/supplier-esg/questions';

function row(partial: Partial<SupplierEsgRow>): SupplierEsgRow {
  return {
    supplierId: partial.supplierId ?? Math.random().toString(36).slice(2),
    name: partial.name ?? 'Supplier',
    tier: partial.tier ?? null,
    annualSpend: partial.annualSpend ?? null,
    assessmentId: partial.assessmentId ?? null,
    submitted: partial.submitted ?? false,
    isVerified: partial.isVerified ?? false,
    scoreTotal: partial.scoreTotal ?? null,
    scoreLabour: partial.scoreLabour ?? null,
    scoreEthics: partial.scoreEthics ?? null,
    scoreEnvironment: partial.scoreEnvironment ?? null,
    scoreRating: partial.scoreRating ?? null,
    answers: partial.answers ?? null,
  };
}

function assessed(tier: string | null, extra: Partial<SupplierEsgRow> = {}): SupplierEsgRow {
  return row({
    tier,
    assessmentId: 'a-' + Math.random().toString(36).slice(2),
    submitted: true,
    scoreLabour: 70,
    scoreEthics: 80,
    scoreRating: 'progressing',
    ...extra,
  });
}

describe('summariseSupplierEsg (IT4 coverage)', () => {
  it('reports missing with no suppliers', () => {
    const c = summariseSupplierEsg([]);
    expect(c.denominator).toBe(0);
    expect(c.assessed).toBe(0);
    expect(c.completeness).toBe('missing');
    expect(c.note).toMatch(/No suppliers/i);
  });

  it('uses Tier 1 as the denominator when tiers are present', () => {
    const rows = [
      assessed('tier_1'),
      assessed('tier_1'),
      row({ tier: 'tier_2', submitted: true, assessmentId: 'x' }), // ignored: not tier 1
      row({ tier: 'tier_3' }),
    ];
    const c = summariseSupplierEsg(rows);
    expect(c.tierBasis).toBe('tier_1');
    expect(c.denominator).toBe(2);
    expect(c.assessed).toBe(2);
    expect(c.completeness).toBe('complete');
  });

  it('falls back to all suppliers when none are tiered, and says so', () => {
    const rows = [assessed(null), assessed(null), assessed(null), assessed(null)];
    const c = summariseSupplierEsg(rows);
    expect(c.tierBasis).toBe('all');
    expect(c.denominator).toBe(4);
    expect(c.completeness).toBe('complete');
    expect(c.note).toMatch(/classify/i);
  });

  it('is partial below the 80% threshold', () => {
    const rows = [
      assessed('tier_1'),
      assessed('tier_1'),
      ...Array.from({ length: 8 }, () => row({ tier: 'tier_1' })), // not submitted
    ];
    const c = summariseSupplierEsg(rows); // 2/10 = 20%
    expect(c.denominator).toBe(10);
    expect(c.assessed).toBe(2);
    expect(c.completeness).toBe('partial');
  });

  it('treats exactly 80% as complete (>= threshold)', () => {
    const rows = [
      ...Array.from({ length: 8 }, () => assessed('tier_1')),
      ...Array.from({ length: 2 }, () => row({ tier: 'tier_1' })),
    ];
    const c = summariseSupplierEsg(rows);
    expect(c.coveragePct).toBeCloseTo(0.8, 5);
    expect(c.coveragePct).toBeGreaterThanOrEqual(SUPPLIER_ESG_COVERAGE_TARGET);
    expect(c.completeness).toBe('complete');
  });

  it('counts submitted-but-unverified as assessed; verified is tracked separately', () => {
    const rows = [
      assessed('tier_1', { isVerified: true }),
      assessed('tier_1', { isVerified: false }),
    ];
    const c = summariseSupplierEsg(rows);
    expect(c.assessed).toBe(2);
    expect(c.verified).toBe(1);
    expect(c.completeness).toBe('complete');
  });

  it('averages scores and tallies the rating distribution over assessed suppliers', () => {
    const rows = [
      assessed('tier_1', { scoreLabour: 90, scoreEthics: 60, scoreRating: 'leader' }),
      assessed('tier_1', { scoreLabour: 70, scoreEthics: 80, scoreRating: 'progressing' }),
      assessed('tier_1', { scoreLabour: 40, scoreEthics: 40, scoreRating: 'needs_improvement' }),
    ];
    const c = summariseSupplierEsg(rows);
    expect(c.avgLabour).toBe(67); // (90+70+40)/3 = 66.67 -> 67
    expect(c.distribution).toEqual({ leader: 1, progressing: 1, needs_improvement: 1 });
    expect(c.assessedSuppliers).toHaveLength(3);
  });
});

describe('summariseSupplierClimate (IT5 Scope 3)', () => {
  it('counts suppliers engaged via Scope 3 (env_11) or science-based target (env_12)', () => {
    const rows = [
      assessed('tier_1', { answers: { env_11: 'yes', env_12: 'no' } }), // scope 3 only
      assessed('tier_1', { answers: { env_11: 'no', env_12: 'partial' } }), // sbt only
      assessed('tier_1', { answers: { env_11: 'no', env_12: 'no' } }), // neither
      assessed('tier_1', { answers: { env_11: 'yes', env_12: 'yes' } }), // both
    ];
    const c = summariseSupplierClimate(rows);
    expect(c.denominator).toBe(4);
    expect(c.measuresScope3).toBe(2);
    expect(c.hasScienceTarget).toBe(2);
    expect(c.engaged).toBe(3);
    expect(c.completeness).toBe('partial'); // 3/4 = 75% < 80%
  });

  it('ignores climate answers from suppliers who have not submitted', () => {
    const rows = [
      row({ tier: 'tier_1', submitted: false, answers: { env_11: 'yes' } }),
    ];
    const c = summariseSupplierClimate(rows);
    expect(c.engaged).toBe(0);
    expect(c.completeness).toBe('missing');
  });
});

describe('summariseSupplierEsg with requireAnyAffirmed (IT4 Year-3 due diligence)', () => {
  it('counts only suppliers who affirm at least one due-diligence question', () => {
    const rows = [
      assessed('tier_1', { answers: { lhr_11: 'yes' } }), // counts (living income)
      assessed('tier_1', { answers: { lhr_12: 'partial' } }), // counts (country risk)
      assessed('tier_1', { answers: { lhr_11: 'no', lhr_12: 'no' } }), // excluded
      assessed('tier_1', { answers: {} }), // excluded (submitted but no due diligence)
    ];
    const c = summariseSupplierEsg(rows, { requireAnyAffirmed: ['lhr_11', 'lhr_12'] });
    expect(c.denominator).toBe(4);
    expect(c.assessed).toBe(2);
    expect(c.completeness).toBe('partial'); // 2/4 = 50%
  });

  it('uses the coverageLabel in the note', () => {
    const rows = [assessed('tier_1', { answers: { lhr_11: 'yes' } })];
    const c = summariseSupplierEsg(rows, {
      requireAnyAffirmed: ['lhr_11'],
      coverageLabel: 'report due-diligence practices',
    });
    expect(c.note).toMatch(/report due-diligence practices/);
  });
});

describe('B Corp question tagging', () => {
  it('tags lhr_11/lhr_12 -> IT4-Y3-001 and env_11/env_12 -> IT5-Y3-001', () => {
    expect(getBcorpQuestionIds('IT4-Y3-001').sort()).toEqual(['lhr_11', 'lhr_12']);
    expect(getBcorpQuestionIds('IT5-Y3-001').sort()).toEqual(['env_11', 'env_12']);
  });

  it('DUE_DILIGENCE_QUESTION_IDS resolves from the tags', () => {
    expect([...DUE_DILIGENCE_QUESTION_IDS].sort()).toEqual(['lhr_11', 'lhr_12']);
  });
});
