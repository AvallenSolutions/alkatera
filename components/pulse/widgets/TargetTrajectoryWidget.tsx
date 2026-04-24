'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Target } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';
import { forecastTrajectory } from '@/lib/pulse/forecast';

interface SustainabilityTarget {
  id: string;
  metric_key: MetricKey;
  baseline_value: number;
  baseline_date: string;
  target_value: number;
  target_date: string;
}

/**
 * Pulse — TargetTrajectoryWidget
 *
 * For each active target on the org, plots historical snapshots vs the
 * forecast trajectory + target line, and shows an on-track/at-risk pill.
 */
export function TargetTrajectoryWidget() {
  const { currentOrganization } = useOrganization();
  const [targets, setTargets] = useState<SustainabilityTarget[]>([]);
  const [snapshotsByMetric, setSnapshotsByMetric] = useState<
    Record<string, { date: string; value: number }[]>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: targetRows } = await supabase
        .from('sustainability_targets')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'active')
        .order('target_date', { ascending: true });
      const ts = (targetRows ?? []) as SustainabilityTarget[];
      if (cancelled) return;
      setTargets(ts);

      // Pull all snapshots for all target metrics in one round trip.
      const metricKeys = Array.from(new Set(ts.map(t => t.metric_key)));
      if (metricKeys.length === 0) {
        setSnapshotsByMetric({});
        setLoading(false);
        return;
      }
      const { data: snapshotRows } = await supabase
        .from('metric_snapshots')
        .select('metric_key, snapshot_date, value')
        .eq('organization_id', currentOrganization.id)
        .in('metric_key', metricKeys)
        .order('snapshot_date', { ascending: true });
      const grouped: Record<string, { date: string; value: number }[]> = {};
      for (const row of snapshotRows ?? []) {
        const key = row.metric_key as string;
        (grouped[key] ??= []).push({
          date: row.snapshot_date as string,
          value: Number(row.value),
        });
      }
      if (cancelled) return;
      setSnapshotsByMetric(grouped);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading target trajectories…
        </CardContent>
      </Card>
    );
  }

  if (targets.length === 0) {
    return (
      <Card className="border-dashed border-border/60 bg-card/40">
        <CardContent className="space-y-2 p-6">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#ccff00]" />
            <h3 className="text-sm font-semibold text-foreground">Targets</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            No targets yet. Set one (e.g. -50% emissions by 2030) on the{' '}
            <a href="/pulse/targets" className="text-[#ccff00] underline-offset-2 hover:underline">
              targets page
            </a>{' '}
            to see your trajectory here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid auto-rows-fr gap-3 lg:grid-cols-2">
      {targets.map(t => (
        <SingleTargetChart
          key={t.id}
          target={t}
          history={snapshotsByMetric[t.metric_key] ?? []}
        />
      ))}
    </div>
  );
}

function SingleTargetChart({
  target,
  history,
}: {
  target: SustainabilityTarget;
  history: { date: string; value: number }[];
}) {
  const def = METRIC_DEFINITIONS[target.metric_key];
  const { points, targetStatus } = useMemo(
    () =>
      forecastTrajectory({
        history,
        targetDate: target.target_date,
        targetValue: target.target_value,
        higherIsBetter: def?.higherIsBetter ?? false,
      }),
    [history, target.target_date, target.target_value, def?.higherIsBetter],
  );

  const chartData = points.map(p => ({
    date: p.date,
    historical: p.forecast ? null : p.value,
    forecast: p.forecast ? p.value : null,
    band95: p.forecast && p.lower95 != null && p.upper95 != null ? [p.lower95, p.upper95] : null,
    band80: p.forecast && p.lower80 != null && p.upper80 != null ? [p.lower80, p.upper80] : null,
    band50: p.forecast && p.lower50 != null && p.upper50 != null ? [p.lower50, p.upper50] : null,
  }));

  const probabilityPct =
    targetStatus.probability !== null ? Math.round(targetStatus.probability * 100) : null;

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-5">
        <header className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {def?.label ?? target.metric_key}
            </p>
            <p className="mt-0.5 text-sm text-foreground">
              Target {target.target_value.toLocaleString('en-GB')} {def?.unit ?? ''} by{' '}
              {target.target_date}
            </p>
          </div>
          <StatusPill status={targetStatus.status} />
        </header>

        <div className="h-44 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="date"
                tickFormatter={d => d.slice(0, 7)}
                tick={{ fontSize: 10, fill: 'currentColor' }}
                stroke="currentColor"
                strokeOpacity={0.2}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'currentColor' }}
                stroke="currentColor"
                strokeOpacity={0.2}
                width={40}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 6 }}
                labelFormatter={d => d}
              />
              {/* Fan chart: nest 95% > 80% > 50% with increasing opacity. */}
              <Area
                dataKey="band95"
                stroke="none"
                fill="#ccff00"
                fillOpacity={0.07}
                connectNulls
                isAnimationActive={false}
              />
              <Area
                dataKey="band80"
                stroke="none"
                fill="#ccff00"
                fillOpacity={0.12}
                connectNulls
                isAnimationActive={false}
              />
              <Area
                dataKey="band50"
                stroke="none"
                fill="#ccff00"
                fillOpacity={0.22}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                dataKey="historical"
                stroke="#ccff00"
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                dataKey="forecast"
                stroke="#ccff00"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <ReferenceLine
                y={target.target_value}
                stroke="#94a3b8"
                strokeDasharray="2 2"
                label={{
                  value: 'Target',
                  fontSize: 10,
                  fill: 'currentColor',
                  position: 'right',
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {targetStatus.projected !== null && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Projected at target date:{' '}
              <span className="font-medium text-foreground">
                {targetStatus.projected.toLocaleString('en-GB', { maximumFractionDigits: 1 })}
              </span>{' '}
              {def?.unit}
              {targetStatus.gap !== null && (
                <>
                  {' · gap '}
                  <span className={cn(targetStatus.gap >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                    {targetStatus.gap.toLocaleString('en-GB', { maximumFractionDigits: 1 })}
                  </span>
                </>
              )}
            </p>
            {probabilityPct !== null && (
              <ProbabilityBar percent={probabilityPct} />
            )}
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/70">
              <LegendDot opacity={0.22} /> 50%
              <LegendDot opacity={0.12} /> 80%
              <LegendDot opacity={0.07} /> 95%
              <span className="ml-1">probability cone</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProbabilityBar({ percent }: { percent: number }) {
  const colour =
    percent >= 70
      ? 'bg-emerald-500'
      : percent >= 40
        ? 'bg-amber-500'
        : 'bg-red-500';
  const label =
    percent >= 70
      ? 'Likely to hit target'
      : percent >= 40
        ? 'Toss-up'
        : 'Unlikely at current pace';
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-foreground">{percent}% probability</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', colour)}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}

function LegendDot({ opacity }: { opacity: number }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-sm"
      style={{ backgroundColor: '#ccff00', opacity }}
    />
  );
}

function StatusPill({ status }: { status: 'on_track' | 'at_risk' | 'off_track' | 'unknown' }) {
  const config = {
    on_track: { label: 'On track', cls: 'bg-emerald-500/15 text-emerald-500' },
    at_risk: { label: 'At risk', cls: 'bg-amber-500/15 text-amber-500' },
    off_track: { label: 'Off track', cls: 'bg-red-500/15 text-red-500' },
    unknown: { label: 'Building data', cls: 'bg-slate-500/15 text-slate-400' },
  }[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        config.cls,
      )}
    >
      {config.label}
    </span>
  );
}
