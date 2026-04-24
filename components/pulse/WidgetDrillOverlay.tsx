'use client';

/**
 * Pulse -- Full-page drill-in overlay.
 *
 * Replaces the old MetricDrillSheet side-sheet with a full-viewport modal
 * overlay (Linear / Figma style). Takes the whole screen, preserves dashboard
 * state behind it, closes on ESC or backdrop click, syncs with `?drill=<id>`
 * for deep-linking.
 *
 * Shell only. The per-widget expanded renderers register themselves as drill
 * slots (`useRegisterDrillSlot`) and this component composes them in order.
 * The always-present TrendSlot handles metric drills; widget-kind drills
 * render whatever slot(s) match them.
 */

import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ExternalLink, X } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';
import { WIDGET_REGISTRY } from '@/lib/pulse/widget-registry';
import { useMetricSnapshots } from '@/hooks/data/useMetricSnapshots';

export function WidgetDrillOverlay() {
  const { activeTarget, open, slots, closeDrill } = useWidgetDrill();

  // Close on ESC.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrill();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeDrill]);

  // Prevent background page scroll while overlay is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Matching slots for the active target.
  const matchingSlots = useMemo(() => {
    if (!activeTarget) return [];
    return slots.filter(s => s.match?.(activeTarget) ?? false);
  }, [slots, activeTarget]);

  // Portal only on the client.
  if (typeof document === 'undefined') return null;
  if (!open || !activeTarget) return null;

  // Header metadata: labels, description, full-page link.
  const { title, description, fullPageHref } = resolveHeader(activeTarget);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-stretch bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} details`}
      onClick={e => {
        // Click on backdrop (outside panel) closes.
        if (e.target === e.currentTarget) closeDrill();
      }}
    >
      <div className="flex h-full w-full flex-col bg-background">
        {/* Sticky header -- collapses to a compact layout on mobile */}
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:gap-3 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={closeDrill}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
            aria-label="Close details (Esc)"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-foreground sm:text-lg">{title}</h2>
            {description && (
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{description}</p>
            )}
          </div>
          {fullPageHref && (
            <Link
              href={fullPageHref}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1.5 text-[11px] text-muted-foreground transition hover:border-[#ccff00]/40 hover:text-foreground sm:gap-1.5 sm:px-3 sm:text-xs"
            >
              <span className="hidden sm:inline">Full page</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
          <span className="hidden text-[10px] text-muted-foreground/60 md:inline">
            Esc to close
          </span>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-8">
            {/* Metric-drill default: large trend chart */}
            {activeTarget.kind === 'metric' && (
              <TrendSlot metricKey={activeTarget.key} />
            )}

            {/* All matching registered slots */}
            {matchingSlots.map(slot => (
              <section key={slot.id} className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {slot.title}
                </h3>
                {slot.render({ target: activeTarget })}
              </section>
            ))}

            {activeTarget.kind === 'widget' && matchingSlots.length === 0 && (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                This widget&apos;s expanded view is on the way.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function resolveHeader(target: {
  kind: 'metric' | 'widget';
  key?: string;
  id?: string;
}): { title: string; description: string | null; fullPageHref: string | null } {
  if (target.kind === 'metric' && target.key) {
    const def = METRIC_DEFINITIONS[target.key as MetricKey];
    return {
      title: def?.label ?? target.key,
      description: def?.description ?? null,
      fullPageHref: def?.href ?? null,
    };
  }
  if (target.kind === 'widget' && target.id) {
    const meta = WIDGET_REGISTRY[target.id as keyof typeof WIDGET_REGISTRY];
    return {
      title: meta?.label ?? target.id,
      description: meta?.description ?? null,
      // Some widgets have a dedicated full page (e.g. financial view).
      fullPageHref: widgetFullPageHref(target.id),
    };
  }
  return { title: '', description: null, fullPageHref: null };
}

function widgetFullPageHref(widgetId: string): string | null {
  // Only a subset of widgets have a dedicated full page today.
  const map: Record<string, string> = {
    'financial-footprint': '/pulse/financial',
    'scenario-sensitivity': '/pulse/financial',
    'cost-intensity': '/pulse/financial',
    'top-cost-drivers': '/pulse/financial',
    'regulatory-exposure': '/pulse/financial',
    'macc': '/pulse/financial',
    'carbon-budgets': '/pulse/financial',
    'product-env-cost': '/pulse/financial',
    'issb-disclosure': '/pulse/financial',
    'impact-valuation': '/pulse/financial/impact-valuation',
  };
  return map[widgetId] ?? null;
}

/**
 * Always-present slot for metric drills: renders a larger trend chart of the
 * same 12-month series the MetricCard sparkline shows.
 */
function TrendSlot({ metricKey }: { metricKey: MetricKey }) {
  const def = METRIC_DEFINITIONS[metricKey];
  const { snapshots, current, deltaPct, loading } = useMetricSnapshots(metricKey, 365, 30);

  const chartData = useMemo(
    () => snapshots.map(s => ({ date: s.snapshot_date, value: Number(s.value) })),
    [snapshots],
  );

  if (loading) return <Skeleton className="h-64 w-full" />;

  if (!current) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
        No snapshots yet. Data flows in once the nightly snapshot cron runs.
      </p>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-tight tabular-nums">
          {Number(current.value).toLocaleString('en-GB', { maximumFractionDigits: 1 })}
        </span>
        <span className="text-sm text-muted-foreground">{def.unit}</span>
        {deltaPct !== null && (
          <span className="ml-2 text-xs text-muted-foreground">
            {deltaPct > 0 ? '+' : ''}
            {deltaPct.toFixed(1)}% vs 30d ago
          </span>
        )}
      </div>

      <div className="h-64 rounded-lg border border-border/60 bg-card/40 p-2">
        {chartData.length < 2 ? (
          <div className="flex h-full items-center justify-center text-xs uppercase tracking-wider text-muted-foreground/50">
            Trend builds with data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`overlay-grad-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ccff00" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#ccff00" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15,23,42,0.92)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(v: number) => [
                  `${v.toLocaleString('en-GB', { maximumFractionDigits: 1 })} ${def.unit}`,
                  def.label,
                ]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#ccff00"
                strokeWidth={2}
                fill={`url(#overlay-grad-${metricKey})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
