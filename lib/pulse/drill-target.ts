/**
 * Pulse -- Drill target type + helpers.
 *
 * A drill target represents what the user clicked to open the drill overlay.
 * Two kinds supported today:
 *   - 'metric': a headline KPI from MetricCard (e.g. total_co2e).
 *   - 'widget': any other widget on the Pulse grid (financial-footprint etc).
 *
 * The drill context holds the active target; each registered slot decides via
 * `match()` whether it renders for that target. The overlay composes matching
 * slots in order.
 */

import type { MetricKey } from './metric-keys';
import type { WidgetId } from './widget-registry';

export type DrillTarget =
  | { kind: 'metric'; key: MetricKey }
  | { kind: 'widget'; id: WidgetId };

export function isMetricTarget(t: DrillTarget | null): t is { kind: 'metric'; key: MetricKey } {
  return t?.kind === 'metric';
}

export function isWidgetTarget(t: DrillTarget | null): t is { kind: 'widget'; id: WidgetId } {
  return t?.kind === 'widget';
}

/**
 * Convert a DrillTarget to a URL-safe string for the `?drill=` query param.
 * Metric targets encode as `m:<metric_key>`, widget targets as `w:<widget_id>`.
 * Anything else yields null.
 */
export function encodeDrillTarget(target: DrillTarget | null): string | null {
  if (!target) return null;
  if (target.kind === 'metric') return `m:${target.key}`;
  if (target.kind === 'widget') return `w:${target.id}`;
  return null;
}

/**
 * Parse the `?drill=` query-param value back into a DrillTarget. Returns null
 * for anything unparseable so the overlay can silently stay closed on bad URLs.
 */
export function decodeDrillTarget(raw: string | null | undefined): DrillTarget | null {
  if (!raw) return null;
  if (raw.startsWith('m:')) {
    const key = raw.slice(2);
    if (!key) return null;
    return { kind: 'metric', key: key as MetricKey };
  }
  if (raw.startsWith('w:')) {
    const id = raw.slice(2);
    if (!id) return null;
    return { kind: 'widget', id: id as WidgetId };
  }
  return null;
}

/** Source of the drill-open call. Distinguishes user discovery vs deep links. */
export type DrillOpenSource = 'click' | 'url' | 'programmatic';
