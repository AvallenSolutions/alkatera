/**
 * Pulse — anomaly detection.
 *
 * Strategy: per (org, metric_key), compute the rolling 30-day mean and
 * standard deviation of metric_snapshots values. Flag anything where the
 * latest value is more than ±2.5σ from the mean.
 *
 * Severity:
 *   - low:    2.5 ≤ |z| < 3
 *   - medium: 3   ≤ |z| < 4
 *   - high:   |z| ≥ 4
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

export function classifySeverity(absZ: number): 'low' | 'medium' | 'high' | null {
  if (absZ < Z_THRESHOLD) return null;
  if (absZ < 3) return 'low';
  if (absZ < 4) return 'medium';
  return 'high';
}

export async function detectAnomaliesForOrg(
  supabase: SupabaseClient,
  orgId: string,
): Promise<AnomalyDetection[]> {
  // Pull the trailing baseline window for every metric in one query.
  const sinceStr = new Date(Date.now() - (BASELINE_WINDOW_DAYS + 1) * 86400_000)
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

  const anomalies: AnomalyDetection[] = [];
  // Array.from required: tsconfig target doesn't allow direct Map iteration.
  for (const [metricKey, history] of Array.from(grouped.entries())) {
    if (history.length < MIN_HISTORY) continue;

    const latest = history[history.length - 1];
    const baseline = history.slice(0, -1); // exclude current point from baseline
    const mean =
      baseline.reduce((sum: number, p: { value: number }) => sum + p.value, 0) /
      baseline.length;
    const variance =
      baseline.reduce(
        (sum: number, p: { value: number }) => sum + (p.value - mean) ** 2,
        0,
      ) / baseline.length;
    const std = Math.sqrt(variance);
    if (std === 0) continue; // can't z-score a flat series

    const z = (latest.value - mean) / std;
    const severity = classifySeverity(Math.abs(z));
    if (!severity) continue;

    anomalies.push({
      organization_id: orgId,
      metric_key: metricKey as MetricKey,
      detected_at: new Date().toISOString(),
      severity,
      observed: latest.value,
      expected: mean,
      z_score: z,
    });
  }

  return anomalies;
}

/** Insert anomalies, ignoring conflicts on the unique daily key. */
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
