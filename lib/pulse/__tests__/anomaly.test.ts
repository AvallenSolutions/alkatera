import { describe, it, expect } from 'vitest';
import { classifySeverity, detectAnomaliesForOrg } from '../anomaly';

const NOW = new Date('2026-06-12T09:00:00.000Z');

/** Build a Supabase stub whose metric_snapshots query resolves to `rows`. */
function supabaseReturning(rows: Array<{ metric_key: string; snapshot_date: string; value: number }>) {
  const result = { data: rows, error: null };
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => Promise.resolve(result),
  };
  return { from: () => chain } as any;
}

/** A run of daily snapshots ending the day before NOW. */
function daily(values: number[]): Array<{ metric_key: string; snapshot_date: string; value: number }> {
  return values.map((value, i) => {
    const d = new Date('2026-05-13T00:00:00.000Z');
    d.setDate(d.getDate() + i);
    return { metric_key: 'total_co2e', snapshot_date: d.toISOString().slice(0, 10), value };
  });
}

describe('classifySeverity', () => {
  it('returns null below threshold and grades above it', () => {
    expect(classifySeverity(2.4)).toBeNull();
    expect(classifySeverity(2.5)).toBe('low');
    expect(classifySeverity(3.5)).toBe('medium');
    expect(classifySeverity(4.1)).toBe('high');
  });
});

describe('detectAnomaliesForOrg', () => {
  it('does NOT flag a near-flat series with tiny float noise (the daily false positive)', async () => {
    // 20 days hovering around 100 with sub-1% wobble, latest 0.4% above mean.
    const vals = Array.from({ length: 20 }, (_, i) => 100 + (i % 2 === 0 ? 0.05 : -0.05));
    vals.push(100.4);
    const supabase = supabaseReturning(daily(vals));
    const found = await detectAnomaliesForOrg(supabase, 'org-1', NOW);
    expect(found).toHaveLength(0);
  });

  it('flags a genuine flat-then-jump with a bounded z-score (not a quadrillion)', async () => {
    // 20 flat days at 100, then a real 30% jump.
    const vals = Array.from({ length: 20 }, () => 100);
    vals.push(130);
    const supabase = supabaseReturning(daily(vals));
    const found = await detectAnomaliesForOrg(supabase, 'org-1', NOW);
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('high');
    expect(Math.abs(found[0].z_score)).toBeLessThanOrEqual(99);
    expect(found[0].observed).toBe(130);
  });

  it('ignores a sub-5% move even when the raw z would be high', async () => {
    // Very tight series; a 2% move is statistically "unusual" but not material.
    const vals = Array.from({ length: 20 }, (_, i) => 100 + (i % 2 === 0 ? 0.1 : -0.1));
    vals.push(102);
    const supabase = supabaseReturning(daily(vals));
    const found = await detectAnomaliesForOrg(supabase, 'org-1', NOW);
    expect(found).toHaveLength(0);
  });

  it('still flags a real spike on a normally-varying series', async () => {
    const base = [98, 102, 99, 101, 100, 103, 97, 100, 102, 98, 101, 99, 100, 102, 98, 101, 99, 100, 103];
    base.push(140); // clear spike
    const supabase = supabaseReturning(daily(base));
    const found = await detectAnomaliesForOrg(supabase, 'org-1', NOW);
    expect(found).toHaveLength(1);
    expect(found[0].metric_key).toBe('total_co2e');
  });

  it('pins detected_at to the first of the current month (one alert per month)', async () => {
    const vals = Array.from({ length: 20 }, () => 100);
    vals.push(130);
    const supabase = supabaseReturning(daily(vals));
    const found = await detectAnomaliesForOrg(supabase, 'org-1', NOW);
    expect(found[0].detected_at).toBe('2026-06-01T00:00:00.000Z');
  });

  it('skips metrics with too little history', async () => {
    const supabase = supabaseReturning(daily([100, 100, 100, 130]));
    const found = await detectAnomaliesForOrg(supabase, 'org-1', NOW);
    expect(found).toHaveLength(0);
  });

  it('skips a zero-mean series rather than dividing by zero', async () => {
    const vals = Array.from({ length: 20 }, () => 0);
    vals.push(5);
    const supabase = supabaseReturning(daily(vals));
    const found = await detectAnomaliesForOrg(supabase, 'org-1', NOW);
    expect(found).toHaveLength(0);
  });
});
