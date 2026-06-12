/**
 * Pulse — anomaly detection.
 *
 * Strategy: per (org, metric_key), compare the latest metric_snapshot value
 * against the rolling 30-day mean. Flag it only when the move is BOTH:
 *   - material:   at least MIN_RELATIVE_DEVIATION (5%) away from the mean, and
 *   - unusual:    at least Z_THRESHOLD (2.5) standard deviations out.
 *
 * Why both gates: a pure z-score is unreliable on a near-flat series. When a
 * metric barely moves day to day, the standard deviation collapses to
 * floating-point noise, so a trivial 0.4% wobble scores z = 5 (or, when the
 * variance is essentially zero, astronomical values like 6e12). The relative
 * gate kills those false positives. To keep z meaningful we also floor the
 * standard deviation at MIN_STD_FRACTION of the mean, so a genuine flat-then-
 * jump (where the historical variance is near zero) still produces a bounded,
 * sensible z rather than being missed or producing a quadrillion.
 *
 * Cadence: one alert per (org, metric_key) per CALENDAR MONTH. `detected_at`
 * is pinned to the first of the month and the unique key dedupes on it, so the
 * hourly detector cannot flood the inbox with a fresh row every run.
 *
 * Cold-start guard: skip detection if fewer than 14 historical points exist.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MetricKey } from './metric-keys';

export interface AnomalyDetection {
  organization_id: string;
  metric_key: MetricKey;
  detected_at: string;
  severity: 'low' | 'medium' | 'high';
  observed: number;
  expected: number;
  z_score: number;
}

const Z_THRESHOLD = 2.5;
const MIN_HISTORY = 14;
const BASELINE_WINDOW_DAYS = 30;
/** A move must be at least this far from the mean (as a fraction) to count. */
const MIN_RELATIVE_DEVIATION = 0.05;
/** Floor the standard deviation at this fraction of |mean| so a near-flat
 *  baseline cannot produce an astronomical z-score. */
const MIN_STD_FRACTION = 0.02;
/** Clamp the stored z so the UI never shows a meaningless huge number. */
const Z_DISPLAY_CAP = 99;
/** Treat a mean smaller than this as zero (can't take a relative deviation). */
const NEAR_ZERO = 1e-9;

export function classifySeverity(absZ: number): 'low' | 'medium' | 'high' | null {
  if (absZ < Z_THRESHOLD) return null;
  if (absZ < 3) return 'low';
  if (absZ < 4) return 'medium';
  return 'high';
}

/** First instant of the calendar month containing `now`, in ISO form. */
function monthBucket(now: Date): string {
  return `${now.toISOString().slice(0, 7)}-01T00:00:00.000Z`;
}

export async function detectAnomaliesForOrg(
  supabase: SupabaseClient,
  orgId: string,
  now: Date = new Date(),
): Promise<AnomalyDetection[]> {
  // Pull the trailing baseline window for every metric in one query.
  const sinceStr = new Date(now.getTime() - (BASELINE_WINDOW_DAYS + 1) * 86400_000)
    .toISOString()
    .slice(0, 10);

  const { data: rows, error } = await supabase
    .from('metric_snapshots')
    .select('metric_key, snapshot_date, value')
    .eq('organization_id', orgId)
    .gte('snapshot_date', sinceStr)
    .order('snapshot_date', { ascending: true });

  if (error || !rows) return [];

  const grouped = new Map<string, { date: string; value: number }[]>();
  for (const r of rows) {
    const arr = grouped.get(r.metric_key as string) ?? [];
    arr.push({ date: r.snapshot_date as string, value: Number(r.value) });
    grouped.set(r.metric_key as string, arr);
  }

  const detectedAt = monthBucket(now);
  const anomalies: AnomalyDetection[] = [];
  // Array.from required: tsconfig target doesn't allow direct Map iteration.
  for (const [metricKey, history] of Array.from(grouped.entries())) {
    if (history.length < MIN_HISTORY) continue;

    const latest = history[history.length - 1];
    const baseline = history.slice(0, -1); // exclude current point from baseline
    const mean =
      baseline.reduce((sum: number, p: { value: number }) => sum + p.value, 0) /
      baseline.length;

    // Can't take a relative deviation around a zero mean.
    if (Math.abs(mean) < NEAR_ZERO) continue;

    // Gate 1: the move must be materially large, not floating-point noise.
    const relDev = Math.abs(latest.value - mean) / Math.abs(mean);
    if (relDev < MIN_RELATIVE_DEVIATION) continue;

    const variance =
      baseline.reduce(
        (sum: number, p: { value: number }) => sum + (p.value - mean) ** 2,
        0,
      ) / baseline.length;
    const std = Math.sqrt(variance);

    // Floor std at a fraction of the mean so a flat baseline can't blow z up.
    const effectiveStd = Math.max(std, MIN_STD_FRACTION * Math.abs(mean));
    const z = (latest.value - mean) / effectiveStd;

    // Gate 2: still has to be statistically unusual.
    const severity = classifySeverity(Math.abs(z));
    if (!severity) continue;

    anomalies.push({
      organization_id: orgId,
      metric_key: metricKey as MetricKey,
      // Month-granular: the unique (org, metric_key, detected_at) key keeps
      // this to a single alert per metric per calendar month, however often
      // the detector runs.
      detected_at: detectedAt,
      severity,
      observed: latest.value,
      expected: mean,
      z_score: Math.sign(z) * Math.min(Math.abs(z), Z_DISPLAY_CAP),
    });
  }

  return anomalies;
}

/** Insert anomalies, ignoring conflicts on the unique monthly key. */
export async function persistAnomalies(
  supabase: SupabaseClient,
  anomalies: AnomalyDetection[],
): Promise<{ written: number; error: string | null }> {
  if (anomalies.length === 0) return { written: 0, error: null };

  const { error } = await supabase
    .from('dashboard_anomalies')
    .upsert(anomalies, {
      onConflict: 'organization_id,metric_key,detected_at',
      ignoreDuplicates: true,
    });

  if (error) return { written: 0, error: error.message };
  return { written: anomalies.length, error: null };
}
