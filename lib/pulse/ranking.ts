/**
 * Pulse -- Adaptive widget ranking.
 *
 * Pure helpers that convert stored engagement rows into a per-widget score,
 * and reorder a layout array so pinned items stay put while unpinned items
 * sort by score descending.
 *
 * Scoring: time-decayed sum of drill-opens with a 30-day half-life.
 *
 *   score = Σ exp(-ln(2) * days_since_open / 30)
 *
 * A single open today contributes 1.0. An open from 30 days ago contributes
 * 0.5. An open from 60 days ago contributes 0.25. Ties break by last_opened_at.
 */

import type { LayoutItem } from './layout';
import type { WidgetId } from './widget-registry';

const HALF_LIFE_DAYS = 30;

export interface EngagementRow {
  widget_id: WidgetId;
  open_count: number;
  last_opened_at: string;
  open_timestamps: string[];
}

/**
 * Compute the adaptive score for a single engagement row. Operates on the
 * raw `open_timestamps` array; falls back to `open_count * 0.5` when the
 * array is empty (shouldn't happen for fresh rows but keeps old rows usable).
 */
export function computeScore(row: Pick<EngagementRow, 'open_timestamps' | 'open_count' | 'last_opened_at'>): number {
  const now = Date.now();
  if (Array.isArray(row.open_timestamps) && row.open_timestamps.length > 0) {
    let score = 0;
    for (const ts of row.open_timestamps) {
      const t = new Date(ts).getTime();
      if (!Number.isFinite(t)) continue;
      const days = (now - t) / 86_400_000;
      if (days < 0) continue;
      score += Math.exp((-Math.LN2 * days) / HALF_LIFE_DAYS);
    }
    return score;
  }
  // Degrade gracefully when timestamps aren't on file.
  if (row.open_count > 0 && row.last_opened_at) {
    const t = new Date(row.last_opened_at).getTime();
    const days = (now - t) / 86_400_000;
    return row.open_count * Math.exp((-Math.LN2 * days) / HALF_LIFE_DAYS);
  }
  return 0;
}

/** Build a { widget_id -> score } map from a list of engagement rows. */
export function scoresByWidget(rows: EngagementRow[]): Map<WidgetId, number> {
  const out = new Map<WidgetId, number>();
  for (const r of rows) {
    out.set(r.widget_id, computeScore(r));
  }
  return out;
}

/**
 * Reorder a layout so pinned items keep their positions and unpinned items
 * are sorted by score descending. Unpinned items without a score keep the
 * original order they arrived in (i.e. fall back to role default).
 *
 * Sorts are stable: within equal-score buckets, relative order is preserved.
 * Does not mutate the input.
 */
export function applyAdaptiveOrder(
  items: LayoutItem[],
  scores: Map<WidgetId, number>,
): LayoutItem[] {
  const pinned = items.filter(i => i.pinned);
  const unpinned = items.filter(i => !i.pinned);

  // Stable sort via decorate-sort-undecorate.
  const decorated = unpinned.map((item, idx) => ({
    item,
    idx,
    score: scores.get(item.i) ?? 0,
  }));
  decorated.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.idx - b.idx;
  });

  // Reassign y positions based on the new order (column-packed).
  const sorted = decorated.map(d => d.item);
  const all = [...pinned, ...sorted];
  return repackRows(all);
}

/**
 * Recompute y positions so items flow top-to-bottom without overlap, in the
 * order they appear in the input. Column count is assumed to be 12 (matches
 * PulseGrid's lg breakpoint).
 */
function repackRows(items: LayoutItem[]): LayoutItem[] {
  const columnY: number[] = new Array(12).fill(0);
  return items.map(item => {
    // Preserve pinned items' x if valid; unpinned items keep their x too,
    // since the caller already decided where each one should live.
    const x = clamp(item.x, 0, 12 - item.w);
    let y = 0;
    for (let c = x; c < x + item.w && c < 12; c += 1) {
      if (columnY[c] > y) y = columnY[c];
    }
    for (let c = x; c < x + item.w && c < 12; c += 1) {
      columnY[c] = y + item.h;
    }
    return { ...item, x, y };
  });
}

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}
