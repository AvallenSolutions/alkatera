import { describe, it, expect } from 'vitest';
import { suggestTiers, tier1Summary, TIER1_SPEND_SHARE } from '../tiering';

describe('suggestTiers', () => {
  it('marks the cumulative top 80% of spend as tier_1', () => {
    // Spends: 50, 30, 15, 5 (total 100). Cumulative: 50%, 80%, 95%, 100%.
    // The 30 reaches 80% exactly and is included; everything after is null.
    const out = suggestTiers([
      { id: 'a', spend: 50 },
      { id: 'b', spend: 30 },
      { id: 'c', spend: 15 },
      { id: 'd', spend: 5 },
    ]);
    const byId = Object.fromEntries(out.map((s) => [s.id, s.suggestedTier]));
    expect(byId.a).toBe('tier_1');
    expect(byId.b).toBe('tier_1');
    expect(byId.c).toBeNull();
    expect(byId.d).toBeNull();
  });

  it('includes the supplier that tips cumulative over the threshold', () => {
    // 70, 20, 10. Cumulative: 70%, 90%, 100%. The 20 crosses 80% and is in.
    const out = suggestTiers([
      { id: 'a', spend: 70 },
      { id: 'b', spend: 20 },
      { id: 'c', spend: 10 },
    ]);
    const byId = Object.fromEntries(out.map((s) => [s.id, s.suggestedTier]));
    expect(byId.a).toBe('tier_1');
    expect(byId.b).toBe('tier_1');
    expect(byId.c).toBeNull();
  });

  it('ranks by spend regardless of input order', () => {
    const out = suggestTiers([
      { id: 'small', spend: 5 },
      { id: 'big', spend: 95 },
    ]);
    expect(out[0].id).toBe('big');
    expect(out[0].suggestedTier).toBe('tier_1');
  });

  it('never marks a zero- or missing-spend supplier as tier_1', () => {
    const out = suggestTiers([
      { id: 'paid', spend: 100 },
      { id: 'zero', spend: 0 },
      { id: 'nullspend', spend: null },
    ]);
    const byId = Object.fromEntries(out.map((s) => [s.id, s.suggestedTier]));
    expect(byId.paid).toBe('tier_1');
    expect(byId.zero).toBeNull();
    expect(byId.nullspend).toBeNull();
  });

  it('handles a single supplier and an empty list', () => {
    expect(suggestTiers([{ id: 'only', spend: 10 }])[0].suggestedTier).toBe('tier_1');
    expect(suggestTiers([])).toEqual([]);
  });

  it('preserves the current tier on each row', () => {
    const out = suggestTiers([{ id: 'a', spend: 10, currentTier: 'tier_2' }]);
    expect(out[0].currentTier).toBe('tier_2');
  });

  it('breaks ties deterministically by id', () => {
    const out1 = suggestTiers([{ id: 'b', spend: 50 }, { id: 'a', spend: 50 }]);
    const out2 = suggestTiers([{ id: 'a', spend: 50 }, { id: 'b', spend: 50 }]);
    expect(out1.map((s) => s.id)).toEqual(out2.map((s) => s.id));
    expect(out1[0].id).toBe('a');
  });
});

describe('tier1Summary', () => {
  it('reports the count and spend share of the Tier 1 set', () => {
    const suggestions = suggestTiers([
      { id: 'a', spend: 60 },
      { id: 'b', spend: 25 },
      { id: 'c', spend: 15 },
    ]);
    const summary = tier1Summary(suggestions);
    // a(60)+b(25)=85% reaches threshold at b; tier1 = {a,b}
    expect(summary.count).toBe(2);
    expect(summary.spendSharePct).toBeCloseTo(85);
  });

  it('is zero for an empty portfolio', () => {
    expect(tier1Summary([])).toEqual({ count: 0, spendSharePct: 0 });
  });
});

describe('TIER1_SPEND_SHARE', () => {
  it('is the documented 80% materiality cut', () => {
    expect(TIER1_SPEND_SHARE).toBe(0.8);
  });
});
