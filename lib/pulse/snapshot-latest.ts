/**
 * Pulse -- latest-snapshot helpers.
 *
 * metric_snapshots rows are *levels*, not daily flows: total_co2e is the
 * calendar-year corporate emissions as of that day, water_consumption is the
 * trailing-12-month intake. The current figure for a window is therefore the
 * MOST RECENT snapshot in it, never a sum of daily rows (summing 365 daily
 * snapshots would multiply the real annual figure by ~365).
 *
 * Use these helpers anywhere a £/tonnes figure is derived from snapshots.
 */

export interface DatedSnapshot {
  metric_key?: string;
  snapshot_date: string; // YYYY-MM-DD (lexicographically sortable)
  value: number | string | null;
}

/** Latest value per metric_key (by snapshot_date) across the given rows. */
export function latestValuePerMetric(rows: DatedSnapshot[]): Map<string, number> {
  const latestDate = new Map<string, string>();
  const latestValue = new Map<string, number>();
  for (const r of rows) {
    const key = r.metric_key ?? '';
    const v = Number(r.value ?? 0);
    if (!Number.isFinite(v)) continue;
    const prev = latestDate.get(key);
    if (prev === undefined || r.snapshot_date > prev) {
      latestDate.set(key, r.snapshot_date);
      latestValue.set(key, v);
    }
  }
  return latestValue;
}

/**
 * Year-on-year % that is only returned when it can be trusted.
 *
 * Returns null when the prior figure is non-positive or the swing is
 * implausibly large (>300%). A near-zero prior is the tell-tale of sparse or
 * synthetically-backfilled history, which otherwise yields absurd percentages
 * (e.g. 14502%). A real YoY becomes available once a full year of genuine
 * daily snapshots has accumulated.
 */
export function reliableYoyPct(trailing: number, prior: number): number | null {
  if (!(prior > 0)) return null;
  const pct = ((trailing - prior) / prior) * 100;
  if (!Number.isFinite(pct)) return null;
  if (Math.abs(pct) > 300) return null;
  return pct;
}

/** Latest single value across rows (ignoring metric_key), or 0 if none. */
export function latestValue(rows: DatedSnapshot[]): number {
  let bestDate = '';
  let best = 0;
  for (const r of rows) {
    const v = Number(r.value ?? 0);
    if (!Number.isFinite(v)) continue;
    if (r.snapshot_date > bestDate) {
      bestDate = r.snapshot_date;
      best = v;
    }
  }
  return best;
}
