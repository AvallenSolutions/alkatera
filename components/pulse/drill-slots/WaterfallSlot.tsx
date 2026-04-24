'use client';

/**
 * Pulse -- root-cause waterfall slot.
 *
 * Mounts via useRegisterDrillSlot when the drill-down sheet opens for a
 * supported metric (currently total_co2e and water_consumption). Loads the
 * previous-vs-current breakdown from /api/pulse/waterfall and renders a
 * waterfall: each category contributes a step coloured by direction.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Minus } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import {
  useRegisterDrillSlot,
  type DrillSlotRenderer,
} from '@/lib/pulse/MetricDrillContext';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';
import { cn } from '@/lib/utils';

interface Step {
  category: string;
  label: string;
  previous: number;
  current: number;
  delta: number;
}

interface ApiPayload {
  ok: boolean;
  metric_key: MetricKey;
  unit: string;
  previous: { total: number; label: string };
  current: { total: number; label: string };
  steps: Step[];
  window_days?: number;
  empty_reason?: string;
}

const SUPPORTED_METRICS: MetricKey[] = ['total_co2e', 'water_consumption'];

export function WaterfallSlotMount() {
  const renderer: DrillSlotRenderer = useCallback(
    ({ target }) => {
      if (target.kind !== 'metric') return null;
      return <WaterfallBody metricKey={target.key} />;
    },
    [],
  );
  useRegisterDrillSlot({
    id: 'waterfall',
    title: 'Root-cause waterfall',
    order: 30,
    // Only render for metric targets whose metric is supported.
    match: t => t.kind === 'metric' && SUPPORTED_METRICS.includes(t.key),
    render: renderer,
  });
  return null;
}

function WaterfallBody({ metricKey }: { metricKey: MetricKey }) {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }
    if (!SUPPORTED_METRICS.includes(metricKey)) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/pulse/waterfall?organization_id=${currentOrganization.id}&metric=${metricKey}`,
        );
        const json = await res.json();
        if (!cancelled && res.ok) setData(json as ApiPayload);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id, metricKey]);

  if (!SUPPORTED_METRICS.includes(metricKey)) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        Waterfall breakdown is available for emissions and water today. More
        metrics arrive as their category models land.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-border/60 bg-card/40">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.steps.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        {data?.empty_reason ?? 'No category data in the comparison window yet.'}
      </p>
    );
  }

  return <WaterfallChart data={data} />;
}

function WaterfallChart({ data }: { data: ApiPayload }) {
  const { previous, current, steps, unit } = data;
  const totalDelta = current.total - previous.total;
  const def = METRIC_DEFINITIONS[data.metric_key];

  // Calculate the chart's value range so all bars share a scale.
  const maxAbs = useMemo(() => {
    return Math.max(
      Math.abs(previous.total),
      Math.abs(current.total),
      ...steps.map(s => Math.abs(s.delta)),
      1,
    );
  }, [previous.total, current.total, steps]);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>
          {previous.label}
          <br />
          <span className="text-sm font-medium text-foreground tabular-nums">
            {fmt(previous.total)}
          </span>{' '}
          {unit}
        </span>
        <ArrowRightArrow delta={totalDelta} />
        <span className="text-right">
          {current.label}
          <br />
          <span className="text-sm font-medium text-foreground tabular-nums">
            {fmt(current.total)}
          </span>{' '}
          {unit}
        </span>
      </div>

      <ul className="space-y-2">
        {steps.map(step => {
          const direction = step.delta > 0 ? 'up' : step.delta < 0 ? 'down' : 'flat';
          const colour =
            direction === 'up'
              ? 'bg-red-500/70'
              : direction === 'down'
                ? 'bg-emerald-500/70'
                : 'bg-slate-400/70';
          // Bar width: |delta| / maxAbs scaled to half the row width
          const widthPct = Math.min(100, (Math.abs(step.delta) / maxAbs) * 100);
          const Icon = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus;
          return (
            <li key={step.category} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-foreground">{step.label}</span>
                <span
                  className={cn(
                    'tabular-nums',
                    direction === 'up' && 'text-red-500',
                    direction === 'down' && 'text-emerald-500',
                    direction === 'flat' && 'text-muted-foreground',
                  )}
                >
                  <Icon className="mr-0.5 inline h-3 w-3" />
                  {step.delta > 0 ? '+' : ''}{fmt(step.delta)} {unit}
                </span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('absolute top-0 h-full', colour)}
                  style={{
                    left: direction === 'up' ? '50%' : `calc(50% - ${widthPct / 2}%)`,
                    width: `${widthPct / 2}%`,
                  }}
                />
                {/* Neutral midline */}
                <div className="absolute top-0 h-full w-px bg-border" style={{ left: '50%' }} />
              </div>
              <p className="text-[10px] text-muted-foreground/70">
                {fmt(step.previous)} → {fmt(step.current)} {unit}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="text-[11px] text-muted-foreground">
        Showing the last {data.window_days ?? 90} days versus the previous {data.window_days ?? 90}.
        {def && ` Lower is better for ${def.label.toLowerCase()}.`}
      </p>
    </div>
  );
}

function ArrowRightArrow({ delta }: { delta: number }) {
  const colour =
    Math.abs(delta) < 1e-6
      ? 'text-muted-foreground'
      : delta > 0
        ? 'text-red-500'
        : 'text-emerald-500';
  return (
    <span className={cn('flex flex-col items-center text-[11px]', colour)}>
      <span>{delta > 0 ? '↑' : delta < 0 ? '↓' : '→'}</span>
      <span className="tabular-nums">{delta > 0 ? '+' : ''}{fmt(delta)}</span>
    </span>
  );
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}
