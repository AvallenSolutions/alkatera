'use client';

/**
 * Pulse -- verdict hero.
 *
 * THE five-second answer: are we on track against our targets? Aggregates
 * every active target's trajectory (lib/pulse/forecast.ts) into a worst-of
 * verdict (lib/pulse/verdict.ts), says it plainly, and DRAWS it: the driving
 * target's history (solid), forecast (dashed) and target line render beside
 * the words, with the hero's ambient tint following the verdict state.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, XCircle, Hourglass, Target as TargetIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { cn } from '@/lib/utils';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';
import { forecastTrajectory, type TrajectoryPoint } from '@/lib/pulse/forecast';
import {
  aggregateVerdict,
  buildVerdictCopy,
  type TargetVerdictInput,
  type Verdict,
  type VerdictState,
} from '@/lib/pulse/verdict';

interface TargetRow {
  id: string;
  metric_key: string;
  target_value: number;
  target_date: string;
}

const STATE_STYLE: Record<
  VerdictState,
  { icon: typeof CheckCircle2; text: string; ring: string; edge: string; glow: string; chart: string }
> = {
  on_track: {
    icon: CheckCircle2,
    text: 'text-emerald-500',
    ring: 'border-emerald-500/40',
    edge: 'border-l-emerald-500',
    glow: 'bg-emerald-500/15 dark:bg-emerald-500/10',
    chart: '#10b981',
  },
  at_risk: {
    icon: AlertTriangle,
    text: 'text-amber-500',
    ring: 'border-amber-500/40',
    edge: 'border-l-amber-500',
    glow: 'bg-amber-500/15 dark:bg-amber-500/10',
    chart: '#f59e0b',
  },
  off_track: {
    icon: XCircle,
    text: 'text-red-500',
    ring: 'border-red-500/40',
    edge: 'border-l-red-500',
    glow: 'bg-red-500/15 dark:bg-red-500/10',
    chart: '#ef4444',
  },
  insufficient_data: {
    icon: Hourglass,
    text: 'text-muted-foreground',
    ring: 'border-border/60',
    edge: 'border-l-border',
    glow: 'bg-[#ccff00]/10 dark:bg-[#ccff00]/5',
    chart: '#ccff00',
  },
  no_targets: {
    icon: TargetIcon,
    text: 'text-muted-foreground',
    ring: 'border-border/60',
    edge: 'border-l-[#ccff00]/60',
    glow: 'bg-[#ccff00]/10 dark:bg-[#ccff00]/5',
    chart: '#ccff00',
  },
};

export function PulseVerdictHero() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [loading, setLoading] = useState(true);
  const [verdictInputs, setVerdictInputs] = useState<TargetVerdictInput[]>([]);
  const [pointsByTarget, setPointsByTarget] = useState<Record<string, TrajectoryPoint[]>>({});
  const [co2History, setCo2History] = useState<{ date: string; value: number }[]>([]);
  const [emissionsNow, setEmissionsNow] = useState<{ value: number; deltaPct: number | null } | null>(null);
  // Which metric the hero leads with. Emissions over time is the default focus;
  // the founder can switch to any other target via the chips.
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
  // The hero reflects the FOCUSED metric (emissions by default), not the
  // worst-of aggregate — the founder asked for emissions front and centre.
  const verdict: Verdict = useMemo(() => {
    if (verdictInputs.length === 0) return { state: 'no_targets', driving: null };
    if (focusedInput) {
      const known = (['off_track', 'at_risk', 'on_track'] as string[]).includes(focusedInput.status);
      return { state: known ? (focusedInput.status as VerdictState) : 'insufficient_data', driving: focusedInput };
    }
    return aggregate; // focused metric has no target — fall back to a useful verdict
  }, [verdictInputs, focusedInput, aggregate]);
  const copy = useMemo(() => buildVerdictCopy(verdict), [verdict]);
  const style = STATE_STYLE[verdict.state];
  const Icon = style.icon;

  // Chart follows the focused metric: its target trajectory if it has one,
  // otherwise the emissions history so the hero is never a wall of text.
  const chartPoints = focusedInput ? (pointsByTarget[focusedInput.targetId] ?? []) : [];
  const showChart = !loading && focusedInput && chartPoints.length >= 2;
  const showHistoryOnly = !loading && !focusedInput && co2History.length >= 2;

  return (
    <Card
      className={cn(
        'overflow-hidden border-border/60 border-l-4 bg-gradient-to-br from-slate-50 via-white to-slate-50 transition-colors dark:from-slate-900/80 dark:via-slate-900 dark:to-slate-800/80',
        style.edge,
      )}
    >
      <CardContent className="relative p-6 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-end">
          <div className={cn('h-56 w-56 -translate-y-12 translate-x-24 rounded-full blur-3xl transition-colors', style.glow)} />
        </div>

        <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_minmax(220px,300px)]">
          <div className="flex items-start gap-4">
            <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 bg-background/40', style.ring)}>
              {loading ? (
                <div className="h-6 w-6 animate-pulse rounded-full bg-muted/60" />
              ) : (
                <Icon className={cn('h-7 w-7', style.text)} aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              {loading ? (
                <>
                  <div className="h-7 w-40 animate-pulse rounded bg-muted/60" />
                  <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-muted/60" />
                </>
              ) : (
                <>
                  {availableMetrics.length > 1 && (
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-[11px] uppercase tracking-wider text-muted-foreground">Tracking</span>
                      {availableMetrics.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setFocusMetric(m)}
                          className={cn(
                            'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                            m === focusMetric
                              ? 'border-[#ccff00]/60 bg-[#ccff00]/15 text-foreground'
                              : 'border-border/60 text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {METRIC_DEFINITIONS[m as MetricKey]?.label ?? m}
                        </button>
                      ))}
                    </div>
                  )}
                  <h2 className={cn('text-2xl font-semibold sm:text-3xl', style.text)}>{copy.headline}</h2>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground sm:text-base">{copy.sub}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {verdict.state === 'no_targets' ? (
                      <Button asChild size="sm">
                        <Link href="/pulse/targets">Set a target</Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link href="/pulse/targets">Targets &amp; actions</Link>
                      </Button>
                    )}
                    {verdict.state === 'no_targets' && emissionsNow && (
                      <p className="text-xs text-muted-foreground">
                        Emissions now:{' '}
                        <span className="font-semibold tabular-nums text-foreground">
                          {Math.round(emissionsNow.value).toLocaleString('en-GB')} kg CO2e
                        </span>
                        {emissionsNow.deltaPct !== null && (
                          <span className={cn('ml-1.5', emissionsNow.deltaPct <= 0 ? 'text-emerald-500' : 'text-red-500')}>
                            {emissionsNow.deltaPct <= 0 ? '' : '+'}
                            {emissionsNow.deltaPct.toFixed(0)}% vs a year ago
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {showChart && verdict.driving && (
            <TrajectoryMiniChart
              points={chartPoints}
              targetValue={verdict.driving.targetValue}
              colour={style.chart}
              metricKey={verdict.driving.metricKey}
            />
          )}
          {showHistoryOnly && (
            <TrajectoryMiniChart
              points={co2History.map(p => ({ ...p, forecast: false }))}
              targetValue={null}
              colour={style.chart}
              metricKey="total_co2e"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact hand-rolled SVG trajectory: solid history, dashed forecast, a
 * "today" divider and the target as a dashed horizontal line. Deliberately
 * lighter than the full fan chart in the Performance tab.
 */
function TrajectoryMiniChart({
  points,
  targetValue,
  colour,
  metricKey,
}: {
  points: Array<{ date: string; value: number; forecast: boolean }>;
  targetValue: number | null;
  colour: string;
  metricKey: string;
}) {
  const W = 300;
  const H = 110;
  const PAD = 6;

  const values = points.map(p => p.value);
  const allValues = targetValue !== null ? [...values, targetValue] : values;
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / Math.max(points.length - 1, 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2 - 14);

  const firstForecastIdx = points.findIndex(p => p.forecast);
  const historyPts = firstForecastIdx === -1 ? points : points.slice(0, firstForecastIdx + 1);
  const forecastPts = firstForecastIdx === -1 ? [] : points.slice(Math.max(firstForecastIdx - 1, 0));

  const toPolyline = (pts: typeof points, offset: number) =>
    pts.map((p, i) => `${x(offset + i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  const historyLine = toPolyline(historyPts, 0);
  const forecastLine = toPolyline(forecastPts, Math.max(firstForecastIdx - 1, 0));
  const todayX = firstForecastIdx > 0 ? x(firstForecastIdx - 1) : null;
  const targetY = targetValue !== null ? y(targetValue) : null;
  const unit = METRIC_DEFINITIONS[metricKey as MetricKey]?.unit ?? '';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[110px] w-full"
      role="img"
      aria-label={`History and forecast for ${METRIC_DEFINITIONS[metricKey as MetricKey]?.label ?? metricKey}`}
    >
      {targetY !== null && (
        <>
          <line x1={PAD} y1={targetY} x2={W - PAD} y2={targetY} stroke={colour} strokeWidth={1} strokeDasharray="2 5" opacity={0.5} />
          <text x={W - PAD} y={targetY - 4} textAnchor="end" fontSize={9} fill={colour} opacity={0.9}>
            target{targetValue !== null ? ` ${Math.round(targetValue).toLocaleString('en-GB')} ${unit}` : ''}
          </text>
        </>
      )}
      {todayX !== null && (
        <>
          <line x1={todayX} y1={PAD} x2={todayX} y2={H - PAD} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" opacity={0.2} />
          <text x={todayX + 4} y={H - PAD - 2} fontSize={9} fill="currentColor" opacity={0.45}>
            today
          </text>
        </>
      )}
      <polyline points={historyLine} fill="none" stroke={colour} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {forecastPts.length >= 2 && (
        <polyline points={forecastLine} fill="none" stroke={colour} strokeWidth={2} strokeDasharray="4 4" opacity={0.65} strokeLinecap="round" />
      )}
    </svg>
  );
}
