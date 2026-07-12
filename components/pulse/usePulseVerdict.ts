'use client';

/**
 * Pulse -- verdict data hook.
 *
 * THE five-second answer: are we on track against our targets? Aggregates
 * every active target's trajectory (lib/pulse/forecast.ts) into a worst-of
 * verdict (lib/pulse/verdict.ts). Extracted from the old PulseVerdictHero
 * card so the page statement can speak the verdict; every fetch and
 * derivation is preserved.
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import type { WorkingTone } from '@/components/studio/theme';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';
import { forecastTrajectory, type TrajectoryPoint } from '@/lib/pulse/forecast';
import {
  aggregateVerdict,
  buildVerdictCopy,
  type TargetVerdictInput,
  type Verdict,
  type VerdictCopy,
  type VerdictState,
} from '@/lib/pulse/verdict';

interface TargetRow {
  id: string;
  metric_key: string;
  target_value: number;
  target_date: string;
}

/** Verdict states map to the working tones: typographic, never decorative. */
export const VERDICT_TONE: Record<VerdictState, WorkingTone> = {
  on_track: 'good',
  at_risk: 'attention',
  off_track: 'stale',
  insufficient_data: 'quiet',
  no_targets: 'quiet',
};

export interface PulseVerdictData {
  loading: boolean;
  verdict: Verdict;
  copy: VerdictCopy;
  /** Working tone for the verdict state (for the one accent word if needed). */
  tone: WorkingTone;
  /** Metrics offered in the tracking switcher (targets + emissions). */
  availableMetrics: string[];
  focusMetric: string;
  setFocusMetric: (metric: string) => void;
  verdictInputs: TargetVerdictInput[];
  pointsByTarget: Record<string, TrajectoryPoint[]>;
  co2History: { date: string; value: number }[];
  emissionsNow: { value: number; deltaPct: number | null } | null;
}

export function usePulseVerdict(): PulseVerdictData {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [loading, setLoading] = useState(true);
  const [verdictInputs, setVerdictInputs] = useState<TargetVerdictInput[]>([]);
  const [pointsByTarget, setPointsByTarget] = useState<Record<string, TrajectoryPoint[]>>({});
  const [co2History, setCo2History] = useState<{ date: string; value: number }[]>([]);
  const [emissionsNow, setEmissionsNow] = useState<{ value: number; deltaPct: number | null } | null>(null);
  // Which metric the verdict leads with. Emissions over time is the default
  // focus; the founder can switch to any other target via the tracking row.
  const [focusMetric, setFocusMetric] = useState<string>('total_co2e');

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: targetRows } = await supabase
        .from('sustainability_targets')
        .select('id, metric_key, target_value, target_date')
        .eq('organization_id', orgId)
        .eq('status', 'active');
      const targets = (targetRows ?? []) as TargetRow[];

      const metricKeys = Array.from(new Set([...targets.map(t => t.metric_key), 'total_co2e']));
      const { data: snapshotRows } = await supabase
        .from('metric_snapshots')
        .select('metric_key, snapshot_date, value')
        .eq('organization_id', orgId)
        .in('metric_key', metricKeys)
        .order('snapshot_date', { ascending: true });
      if (cancelled) return;

      const byMetric: Record<string, { date: string; value: number }[]> = {};
      for (const row of snapshotRows ?? []) {
        const key = row.metric_key as string;
        (byMetric[key] ??= []).push({ date: row.snapshot_date as string, value: Number(row.value) });
      }

      const inputs: TargetVerdictInput[] = [];
      const points: Record<string, TrajectoryPoint[]> = {};
      for (const t of targets) {
        const def = METRIC_DEFINITIONS[t.metric_key as MetricKey];
        const result = forecastTrajectory({
          history: byMetric[t.metric_key] ?? [],
          targetDate: t.target_date,
          targetValue: Number(t.target_value),
          higherIsBetter: def?.higherIsBetter ?? false,
        });
        points[t.id] = result.points;
        inputs.push({
          targetId: t.id,
          metricKey: t.metric_key,
          targetValue: Number(t.target_value),
          targetDate: t.target_date,
          status: result.targetStatus.status,
          probability: result.targetStatus.probability,
          gap: result.targetStatus.gap,
        });
      }
      setVerdictInputs(inputs);
      setPointsByTarget(points);

      const co2 = byMetric['total_co2e'] ?? [];
      setCo2History(co2);
      if (co2.length > 0) {
        const latest = co2[co2.length - 1].value;
        const yearAgoDate = new Date(co2[co2.length - 1].date);
        yearAgoDate.setFullYear(yearAgoDate.getFullYear() - 1);
        const prior = co2.filter(p => new Date(p.date) <= yearAgoDate).pop();
        setEmissionsNow({
          value: latest,
          deltaPct: prior && prior.value > 0 ? ((latest - prior.value) / prior.value) * 100 : null,
        });
      } else {
        setEmissionsNow(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  // Metrics offered in the selector: every metric with an active target, plus
  // emissions (always available so it can lead even before a target is set).
  const availableMetrics = useMemo(() => {
    const keys = verdictInputs.map((i) => i.metricKey);
    if (!keys.includes('total_co2e')) keys.unshift('total_co2e');
    return Array.from(new Set(keys));
  }, [verdictInputs]);

  // Keep the focused metric valid once data loads (default back to emissions).
  useEffect(() => {
    if (availableMetrics.length && !availableMetrics.includes(focusMetric)) {
      setFocusMetric(availableMetrics.includes('total_co2e') ? 'total_co2e' : availableMetrics[0]);
    }
  }, [availableMetrics, focusMetric]);

  const focusedInput = useMemo(
    () => verdictInputs.find((i) => i.metricKey === focusMetric) ?? null,
    [verdictInputs, focusMetric],
  );
  const aggregate = useMemo(() => aggregateVerdict(verdictInputs), [verdictInputs]);
  // The statement reflects the FOCUSED metric (emissions by default), not the
  // worst-of aggregate: the founder asked for emissions front and centre.
  const verdict: Verdict = useMemo(() => {
    if (verdictInputs.length === 0) return { state: 'no_targets', driving: null };
    if (focusedInput) {
      const known = (['off_track', 'at_risk', 'on_track'] as string[]).includes(focusedInput.status);
      return { state: known ? (focusedInput.status as VerdictState) : 'insufficient_data', driving: focusedInput };
    }
    return aggregate; // focused metric has no target: fall back to a useful verdict
  }, [verdictInputs, focusedInput, aggregate]);
  const copy = useMemo(() => buildVerdictCopy(verdict), [verdict]);

  return {
    loading,
    verdict,
    copy,
    tone: VERDICT_TONE[verdict.state],
    availableMetrics,
    focusMetric,
    setFocusMetric,
    verdictInputs,
    pointsByTarget,
    co2History,
    emissionsNow,
  };
}
