// The Pulse verdict: one plain-language answer to "are we on track?".
//
// Aggregates per-target trajectory statuses (from lib/pulse/forecast.ts)
// into a single worst-of verdict. Worst-of, not weighted: a founder needs to
// know about the one commitment they will miss, and averaging hides it. The
// driving target (the one in the worst shape) is named in the copy, so the
// verdict works for any metric, not just emissions.

import { METRIC_DEFINITIONS, type MetricKey } from './metric-keys';
import type { TargetStatus } from './forecast';

export type VerdictState =
  | 'on_track'
  | 'at_risk'
  | 'off_track'
  | 'insufficient_data'
  | 'no_targets';

export interface TargetVerdictInput {
  targetId: string;
  metricKey: MetricKey | string;
  targetValue: number;
  targetDate: string;
  status: TargetStatus['status'];
  probability: number | null;
  /** target_value minus projected, in the metric's unit. Negative = beating target. */
  gap: number | null;
}

export interface Verdict {
  state: VerdictState;
  /** The target driving the verdict (worst shape), when one exists. */
  driving: TargetVerdictInput | null;
}

const SEVERITY: Record<string, number> = {
  off_track: 2,
  at_risk: 1,
  on_track: 0,
};

/**
 * Worst-of aggregation. Targets with status 'unknown' (fewer than two data
 * points) are excluded from ranking; if ALL are unknown the verdict is
 * insufficient_data. Within the worst tier, the lowest probability wins
 * (null probabilities sort last within the tier).
 */
export function aggregateVerdict(targets: TargetVerdictInput[]): Verdict {
  if (targets.length === 0) {
    return { state: 'no_targets', driving: null };
  }

  const ranked = targets.filter((t) => t.status in SEVERITY);
  if (ranked.length === 0) {
    return { state: 'insufficient_data', driving: null };
  }

  const worstSeverity = Math.max(...ranked.map((t) => SEVERITY[t.status]));
  const worstTier = ranked.filter((t) => SEVERITY[t.status] === worstSeverity);
  worstTier.sort((a, b) => {
    if (a.probability === null && b.probability === null) return 0;
    if (a.probability === null) return 1;
    if (b.probability === null) return -1;
    return a.probability - b.probability;
  });

  const driving = worstTier[0];
  return { state: driving.status as VerdictState, driving };
}

function metricLabel(metricKey: string): string {
  return METRIC_DEFINITIONS[metricKey as MetricKey]?.label?.toLowerCase() ?? metricKey;
}

function metricUnit(metricKey: string): string {
  return METRIC_DEFINITIONS[metricKey as MetricKey]?.unit ?? '';
}

function targetYear(targetDate: string): string {
  const y = new Date(targetDate).getFullYear();
  return Number.isFinite(y) ? String(y) : targetDate;
}

function formatGap(gap: number, unit: string): string {
  const abs = Math.abs(gap);
  const rounded = abs >= 100 ? Math.round(abs) : Math.round(abs * 10) / 10;
  return `${rounded.toLocaleString('en-GB')} ${unit}`.trim();
}

export interface VerdictCopy {
  headline: string;
  sub: string;
}

/** Plain-language copy for each verdict state. */
export function buildVerdictCopy(verdict: Verdict): VerdictCopy {
  const d = verdict.driving;
  const year = d ? targetYear(d.targetDate) : '';
  const label = d ? metricLabel(d.metricKey) : '';

  switch (verdict.state) {
    case 'on_track':
      return {
        headline: 'On track',
        sub: `At today's pace you will hit your ${year} ${label} target. Keep going.`,
      };
    case 'at_risk':
      return {
        headline: 'At risk',
        sub: `Things are moving in the right direction, but not fast enough to hit your ${year} ${label} target.`,
      };
    case 'off_track': {
      const gapText =
        d && d.gap !== null && d.gap !== 0
          ? ` by around ${formatGap(d.gap, metricUnit(d.metricKey))}`
          : '';
      return {
        headline: 'Off track',
        sub: `At today's pace you will miss your ${year} ${label} target${gapText}.`,
      };
    }
    case 'insufficient_data':
      return {
        headline: 'Building your forecast',
        sub: 'Your targets are set. We need a few more weeks of data before we can tell whether you are on track.',
      };
    case 'no_targets':
    default:
      return {
        headline: 'No targets yet',
        sub: 'Set a target so Pulse can tell you whether you are on track to hit it.',
      };
  }
}
