'use client';

/**
 * Pulse -- Target trajectory, compact card.
 *
 * Headline: gap to target at the target date (projected vs target value).
 * Supporting: mini forecast line with target crosshair.
 * Falls back gracefully when no target is set yet.
 */

import { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer } from 'recharts';
import { Target } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';
import { forecastTrajectory } from '@/lib/pulse/forecast';

interface TargetRow {
  id: string;
  metric_key: MetricKey;
  baseline_value: number;
  baseline_date: string;
  target_value: number;
  target_date: string;
}

interface Snapshot {
  snapshot_date: string;
  value: number;
}

export function TargetTrajectoryCard() {
  const { currentOrganization } = useOrganization();
  const { openDrill } = useWidgetDrill();
  const [target, setTarget] = useState<TargetRow | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: targets } = await supabase
        .from('sustainability_targets')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'active')
        .order('target_date', { ascending: true });
      const t = ((targets ?? []) as TargetRow[])[0] ?? null;
      if (cancelled) return;
      setTarget(t);
      if (t) {
        const { data: snaps } = await supabase
          .from('metric_snapshots')
          .select('snapshot_date, value')
          .eq('organization_id', currentOrganization.id)
          .eq('metric_key', t.metric_key)
          .order('snapshot_date', { ascending: true });
        if (!cancelled) setHistory((snaps ?? []) as Snapshot[]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  const forecast = useMemo(() => {
    if (!target || history.length < 2) return null;
    const def = METRIC_DEFINITIONS[target.metric_key];
    return forecastTrajectory({
      history: history.map(h => ({ date: h.snapshot_date, value: Number(h.value) })),
      targetDate: target.target_date,
      targetValue: target.target_value,
      higherIsBetter: def?.higherIsBetter ?? false,
    });
  }, [target, history]);

  const { headline, sub, status } = useMemo(() => {
    if (!target) {
      return {
        headline: '—',
        sub: 'No active target set',
        status: null,
      };
    }
    const def = METRIC_DEFINITIONS[target.metric_key];
    if (!forecast || forecast.targetStatus.projected === null) {
      return {
        headline: `${target.target_value.toLocaleString('en-GB')}`,
        sub: `${def?.label ?? target.metric_key} by ${target.target_date}`,
        status: null,
      };
    }
    const gap = forecast.targetStatus.gap ?? 0;
    return {
      headline: `${gap >= 0 ? '' : '+'}${Math.abs(gap).toLocaleString('en-GB', { maximumFractionDigits: 0 })} ${def?.unit ?? ''}`,
      sub: `${gap >= 0 ? 'under' : 'over'} target by ${target.target_date}`,
      status:
        forecast.targetStatus.status === 'on_track'
          ? ({ tone: 'good' as const, label: 'On track' })
          : forecast.targetStatus.status === 'at_risk'
            ? ({ tone: 'warn' as const, label: 'At risk' })
            : forecast.targetStatus.status === 'off_track'
              ? ({ tone: 'bad' as const, label: 'Off track' })
              : null,
    };
  }, [target, forecast]);

  const chartData = useMemo(() => {
    if (!forecast) return [];
    return forecast.points.map(p => ({
      date: p.date,
      historical: p.forecast ? null : p.value,
      forecast: p.forecast ? p.value : null,
    }));
  }, [forecast]);

  return (
    <PulseCard
      icon={Target}
      label="Target trajectory"
      headline={headline}
      sub={sub}
      status={status}
      footprint="2x1"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'target-trajectory' })}
      footer={target ? undefined : 'Set one in /pulse/targets'}
    >
      {target && chartData.length > 1 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <Line
              type="monotone"
              dataKey="historical"
              stroke="#ccff00"
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#ccff00"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <ReferenceLine
              y={target.target_value}
              stroke="#94a3b8"
              strokeDasharray="2 2"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground/50">
          {target ? 'Building forecast' : 'No target set'}
        </div>
      )}
    </PulseCard>
  );
}
