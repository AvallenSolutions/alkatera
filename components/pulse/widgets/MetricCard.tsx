'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useMetricSnapshots } from '@/hooks/data/useMetricSnapshots';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';
import { usePulseRealtimeContext } from '@/lib/pulse/PulseRealtimeContext';
import { useMetricDrill } from '@/lib/pulse/MetricDrillContext';
import { useShadowPrices } from '@/hooks/data/useShadowPrices';
import { monetise } from '@/lib/pulse/shadow-prices';

interface MetricCardProps {
  metricKey: MetricKey;
  /** Default 365 days for the sparkline. */
  days?: number;
  /** Default 30 days for the prior-period delta. */
  compareDays?: number;
}

/**
 * Pulse — MetricCard
 *
 * Reads metric_snapshots for the active org and renders:
 *   - the latest value with unit
 *   - a delta vs prior-period chip
 *   - a 12-month sparkline
 *   - a click-through to the metric's drill-in page
 *
 * Empty / loading / no-data states each have a tailored visual rather than
 * showing a misleading "0" value.
 */
export function MetricCard({ metricKey, days = 365, compareDays = 30 }: MetricCardProps) {
  const def = METRIC_DEFINITIONS[metricKey];
  const { snapshots, current, deltaPct, trendDirection, loading } = useMetricSnapshots(
    metricKey,
    days,
    compareDays,
  );
  const { events } = usePulseRealtimeContext();
  const { openDrill } = useMetricDrill();
  const { prices } = useShadowPrices();

  // Flash the card border briefly when a relevant realtime event arrives.
  // We track the latest event id we've seen so the flash fires once per event,
  // not on every re-render.
  const [flashing, setFlashing] = useState(false);
  const lastSeenEventIdRef = useRef<string | null>(null);
  useEffect(() => {
    const relevant = events.find(e => e.affectsMetrics.includes(metricKey));
    if (!relevant) return;
    if (relevant.id === lastSeenEventIdRef.current) return;
    lastSeenEventIdRef.current = relevant.id;
    setFlashing(true);
    const timer = setTimeout(() => setFlashing(false), 1600);
    return () => clearTimeout(timer);
  }, [events, metricKey]);

  // Animate the displayed number whenever `current.value` changes. Hook must
  // be called unconditionally so it stays above the early returns below.
  const animatedValue = useAnimatedNumber(current?.value ?? 0);

  if (loading) return <MetricCardSkeleton />;

  if (!current) {
    return <MetricCardEmpty def={def} />;
  }

  const formattedValue = formatValue(animatedValue, def.compact);
  const money = monetise(current.value, prices[metricKey]);
  const isGoodTrend = trendDirection
    ? def.higherIsBetter
      ? trendDirection === 'up'
      : trendDirection === 'down'
    : false;
  const isBadTrend = trendDirection
    ? def.higherIsBetter
      ? trendDirection === 'down'
      : trendDirection === 'up'
    : false;

  const trendColour =
    trendDirection === 'stable' || trendDirection === null
      ? 'text-slate-500'
      : isGoodTrend
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400';

  const TrendIcon =
    trendDirection === 'up'
      ? TrendingUp
      : trendDirection === 'down'
        ? TrendingDown
        : Minus;

  // Sparkline colour shifts with overall trend health.
  const sparkColour = isBadTrend
    ? '#ef4444'
    : isGoodTrend
      ? '#10b981'
      : '#ccff00';

  return (
    <button
      type="button"
      onClick={() => openDrill(metricKey)}
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ccff00]/60',
        flashing
          ? 'border-[#ccff00] shadow-[0_0_24px_rgba(204,255,0,0.35)]'
          : 'border-border/60 hover:border-[#ccff00]/40',
      )}
    >
      {/* Live event flash bar */}
      {flashing && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-0.5 animate-pulse bg-[#ccff00]"
        />
      )}

      {/* Top row: label + drill-in arrow */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {def.label}
        </p>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {formattedValue}
        </span>
        <span className="text-xs text-muted-foreground">{def.unit}</span>
      </div>

      {/* Financial overlay (shadow price) */}
      {money && (
        <p
          className="mt-0.5 text-xs text-muted-foreground"
          title={money.rate_label}
        >
          <span className="font-medium text-foreground/80 tabular-nums">
            {money.formatted}
          </span>
          <span className="ml-1 text-[10px] text-muted-foreground/70">
            at {money.rate_label}
          </span>
        </p>
      )}

      {/* Trend chip */}
      <div className="mt-2 flex items-center justify-between gap-2">
        {deltaPct !== null && trendDirection ? (
          <span className={cn('inline-flex items-center gap-1 text-xs font-medium', trendColour)}>
            <TrendIcon className="h-3 w-3" />
            {Math.abs(deltaPct).toFixed(1)}%
            <span className="text-muted-foreground/70 font-normal">
              vs {compareDays}d ago
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">No prior period</span>
        )}
      </div>

      {/* Sparkline — fixed height; cards now size to content rather than
          stretching to fill an arbitrary grid cell. */}
      <div className="mt-3 -mx-1 h-12">
        <Sparkline data={snapshots} color={sparkColour} />
      </div>

      {/* Description footer */}
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground/70">
        {def.description}
      </p>
    </button>
  );
}

function Sparkline({
  data,
  color,
}: {
  data: { snapshot_date: string; value: number }[];
  color: string;
}) {
  const chartData = useMemo(
    () =>
      data.map(d => ({
        date: d.snapshot_date,
        value: Number(d.value),
      })),
    [data],
  );

  if (chartData.length < 2) {
    return (
      <div className="flex h-full min-h-[3rem] items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground/40">
        Trend builds with data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <YAxis hide domain={['auto', 'auto']} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MetricCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border/60 bg-card p-4">
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="mt-2 h-3 w-32" />
      <Skeleton className="mt-3 h-12 w-full" />
    </div>
  );
}

function MetricCardEmpty({ def }: { def: (typeof METRIC_DEFINITIONS)[MetricKey] }) {
  return (
    <Link
      href={def.href}
      className="group flex flex-col overflow-hidden rounded-xl border border-dashed border-border/60 bg-card/40 p-4 transition-colors hover:border-[#ccff00]/40"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {def.label}
        </p>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/50" />
      </div>
      <p className="text-sm text-muted-foreground">
        Waiting for first snapshot
      </p>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground/60">
        {def.description}
      </p>
    </Link>
  );
}

/** Compact value formatter — 1,234 → "1.2k", 1,234,567 → "1.2M". */
function formatValue(value: number, compact?: boolean): string {
  if (!Number.isFinite(value)) return '—';
  if (!compact) {
    return value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
  }
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return (value / 1_000).toFixed(1) + 'k';
  return value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}
