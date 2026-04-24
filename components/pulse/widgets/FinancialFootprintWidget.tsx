'use client';

/**
 * Pulse -- Financial footprint hero widget.
 *
 * Headline £ figure for the org's annual environmental liability, with:
 *   - 12-month trend area chart (total £/month)
 *   - YoY change pill (green = improving, red = worsening)
 *   - Stacked bar showing carbon vs water vs waste contribution
 *   - Per-metric breakdown with shadow-price provenance
 *
 * Designed to be the headline widget on the executive Pulse layout -- the
 * thing a CFO sees first when they open the dashboard.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDown, ArrowUp, Loader2, PoundSterling, TrendingUp } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';
import { cn } from '@/lib/utils';

interface PriceProvenance {
  rate: number;
  source: string | null;
  unit: string;
}

interface MonthlyBucket {
  month: string;
  total_gbp: number;
  by_metric: Record<string, number>;
}

interface ApiPayload {
  ok: boolean;
  currency: string;
  trailing_12_months: { total_gbp: number; by_metric: Record<string, number> };
  prior_12_months: { total_gbp: number };
  year_on_year: {
    delta_gbp: number;
    delta_pct: number | null;
    direction: 'improving' | 'worsening' | 'flat';
  };
  monthly: MonthlyBucket[];
  price_provenance: Record<string, PriceProvenance>;
  metrics_without_price: string[];
}

const METRIC_COLOURS: Record<string, string> = {
  total_co2e: '#ccff00',
  water_consumption: '#38bdf8',
  waste_total: '#f59e0b',
};

export function FinancialFootprintWidget() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/pulse/financial-footprint?organization_id=${currentOrganization.id}`,
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json?.error ?? 'Failed to load financial footprint');
        } else {
          setData(json as ApiPayload);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  const metricRows = useMemo(() => {
    if (!data) return [];
    const total = data.trailing_12_months.total_gbp;
    return Object.entries(data.trailing_12_months.by_metric)
      .map(([metric, gbp]) => ({
        metric,
        gbp,
        pct: total > 0 ? (gbp / total) * 100 : 0,
        label: METRIC_DEFINITIONS[metric as MetricKey]?.label ?? metric,
        provenance: data.price_provenance[metric],
        colour: METRIC_COLOURS[metric] ?? '#94a3b8',
      }))
      .sort((a, b) => b.gbp - a.gbp);
  }, [data]);

  return (
    <Card className="border-border/60 bg-gradient-to-br from-card via-card to-card/60">
      <CardContent className="space-y-5 p-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <PoundSterling className="h-3 w-3 text-[#ccff00]" />
              Annual environmental liability
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/80">
              What your last 12 months would cost if carbon, water and waste were
              fully priced.
            </p>
          </div>
        </header>

        {loading && (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-500">
            {error}
          </p>
        )}

        {!loading && !error && data && (
          <>
            <Headline
              total={data.trailing_12_months.total_gbp}
              yoy={data.year_on_year}
            />

            <TrendChart monthly={data.monthly} />

            <Breakdown rows={metricRows} />

            {data.metrics_without_price.length > 0 && (
              <p className="text-[10px] text-muted-foreground/70">
                No shadow price set yet for: {data.metrics_without_price.join(', ')}.
                Set one on the{' '}
                <a
                  href="/pulse/settings/shadow-prices/"
                  className="text-[#ccff00] underline-offset-2 hover:underline"
                >
                  Prices page
                </a>
                {' '}to include them here.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Headline({
  total,
  yoy,
}: {
  total: number;
  yoy: ApiPayload['year_on_year'];
}) {
  const formatted = formatGbp(total);
  const tone =
    yoy.direction === 'improving'
      ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
      : yoy.direction === 'worsening'
        ? 'text-red-500 bg-red-500/10 border-red-500/30'
        : 'text-muted-foreground bg-muted/30 border-border/60';
  const Arrow = yoy.delta_gbp < 0 ? ArrowDown : yoy.delta_gbp > 0 ? ArrowUp : TrendingUp;

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-5xl font-semibold tabular-nums text-foreground sm:text-6xl">
          {formatted}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">trailing 12 months</p>
      </div>
      <div
        className={cn(
          'flex flex-col items-end gap-0.5 rounded-lg border px-3 py-2',
          tone,
        )}
      >
        <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
          <Arrow className="h-3.5 w-3.5" />
          {yoy.delta_gbp < 0 ? '' : yoy.delta_gbp > 0 ? '+' : ''}
          {formatGbp(yoy.delta_gbp)}
        </span>
        <span className="text-[10px] uppercase tracking-wider opacity-80">
          {yoy.delta_pct !== null
            ? `${yoy.delta_pct >= 0 ? '+' : ''}${yoy.delta_pct.toFixed(1)}% vs prior 12m`
            : 'No prior period yet'}
        </span>
      </div>
    </div>
  );
}

function TrendChart({ monthly }: { monthly: MonthlyBucket[] }) {
  if (monthly.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-center text-xs text-muted-foreground">
        Trend builds with data -- no monthly buckets yet.
      </p>
    );
  }
  return (
    <div className="h-28 -mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={monthly} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="financialFootprintFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ccff00" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#ccff00" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            tickFormatter={m => m.slice(5)}
            tick={{ fontSize: 10, fill: 'currentColor' }}
            stroke="currentColor"
            strokeOpacity={0.2}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={v => formatGbpShort(Number(v))}
            tick={{ fontSize: 10, fill: 'currentColor' }}
            stroke="currentColor"
            strokeOpacity={0.2}
            width={42}
          />
          <ChartTooltip
            contentStyle={{ fontSize: 11, borderRadius: 6 }}
            formatter={(v: any) => [formatGbp(Number(v)), 'Cost']}
            labelFormatter={(m: string) => m}
          />
          <Area
            type="monotone"
            dataKey="total_gbp"
            stroke="#ccff00"
            strokeWidth={2}
            fill="url(#financialFootprintFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Breakdown({
  rows,
}: {
  rows: Array<{
    metric: string;
    gbp: number;
    pct: number;
    label: string;
    colour: string;
    provenance: PriceProvenance | undefined;
  }>;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Cost driver mix
      </p>
      {/* Stacked horizontal bar */}
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {rows.map(r => (
          <div
            key={r.metric}
            style={{ width: `${r.pct}%`, backgroundColor: r.colour }}
            title={`${r.label}: ${r.pct.toFixed(0)}% (${formatGbp(r.gbp)})`}
          />
        ))}
      </div>
      <ul className="space-y-1.5">
        {rows.map(r => (
          <li
            key={r.metric}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2 w-2 flex-shrink-0 rounded-sm"
                style={{ backgroundColor: r.colour }}
              />
              <span className="truncate text-foreground">{r.label}</span>
              {r.provenance && (
                <span
                  className="hidden truncate text-[10px] text-muted-foreground/70 sm:inline"
                  title={r.provenance.source ?? undefined}
                >
                  · £{r.provenance.rate}/{r.provenance.unit}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-sm font-medium tabular-nums text-foreground">
                {formatGbp(r.gbp)}
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {r.pct.toFixed(0)}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Format helpers --------------------------------------------------------------

function formatGbp(v: number): string {
  const abs = Math.abs(v);
  // Compact (k/M) for big numbers; full pounds-and-pence otherwise.
  if (abs >= 100_000) {
    return v.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      notation: 'compact',
      maximumFractionDigits: 1,
    });
  }
  return v.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: abs >= 100 ? 0 : 2,
  });
}

function formatGbpShort(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `£${(v / 1_000).toFixed(0)}k`;
  return `£${v.toFixed(0)}`;
}
