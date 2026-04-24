'use client';

/**
 * Pulse -- Financial footprint, expanded view.
 *
 * Registered as a drill slot keyed to the `financial-footprint` widget id.
 * Renders inside the full-page WidgetDrillOverlay. Pulls richer data from
 * /api/pulse/expanded/financial-footprint on demand.
 *
 * Four sections:
 *   1. Hero headline + YoY delta (re-renders the compact number on a big canvas)
 *   2. Month-by-month table (12 rows, £ total, shadow-price used, tCO2e)
 *   3. Previous-year vs current waterfall by metric
 *   4. Per-facility £ attribution
 *   5. Shadow-price change history
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDown, ArrowUp, History, Loader2, Table2, TrendingUp } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import {
  useRegisterDrillSlot,
  type DrillSlotRenderer,
} from '@/lib/pulse/MetricDrillContext';
import { cn } from '@/lib/utils';

interface Monthly {
  month: string;
  total_gbp: number;
  by_metric_gbp: Record<string, number>;
  tonnes_co2e: number;
  m3_water: number;
  shadow_price_gbp_per_t: number | null;
}

interface WaterfallStep {
  metric_key: string;
  metric_label: string;
  prior_gbp: number;
  current_gbp: number;
  delta_gbp: number;
}

interface FacilityRow {
  facility_id: string;
  facility_name: string;
  total_gbp: number;
  carbon_gbp: number;
  water_gbp: number;
  pct_of_total: number;
}

interface PriceChange {
  metric_key: string;
  metric_label: string;
  price_per_unit: number;
  unit: string;
  source: string | null;
  effective_from: string;
  is_org_override: boolean;
}

interface ApiPayload {
  totals: {
    trailing_gbp: number;
    prior_gbp: number;
    delta_gbp: number;
    delta_pct: number | null;
  };
  monthly: Monthly[];
  waterfall: WaterfallStep[];
  by_facility: FacilityRow[];
  price_history: PriceChange[];
}

/** Mount point for PulseShell. Registers the slot; renders nothing. */
export function FinancialFootprintExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(
    () => <FinancialFootprintExpanded />,
    [],
  );
  useRegisterDrillSlot({
    id: 'financial-footprint-expanded',
    title: 'Deep view',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'financial-footprint',
    render: renderer,
  });
  return null;
}

function FinancialFootprintExpanded() {
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
          `/api/pulse/expanded/financial-footprint?organization_id=${currentOrganization.id}`,
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json?.ok) {
          setError(json?.error ?? 'Failed to load expanded data');
        } else {
          setData(json.data as ApiPayload);
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

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-500">
        {error ?? 'No data'}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <Headline totals={data.totals} />
      <Waterfall steps={data.waterfall} />
      <MonthlyTable monthly={data.monthly} />
      <FacilityAttribution rows={data.by_facility} total={data.totals.trailing_gbp} />
      <PriceHistory rows={data.price_history} />
    </div>
  );
}

// Sub-sections --------------------------------------------------------------

function Headline({ totals }: { totals: ApiPayload['totals'] }) {
  const tone =
    totals.delta_gbp < 0
      ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
      : totals.delta_gbp > 0
        ? 'text-red-500 bg-red-500/10 border-red-500/30'
        : 'text-muted-foreground bg-muted/30 border-border/60';
  const Arrow = totals.delta_gbp < 0 ? ArrowDown : totals.delta_gbp > 0 ? ArrowUp : TrendingUp;
  return (
    <section className="grid gap-4 rounded-xl border border-border/60 bg-gradient-to-br from-card via-card to-card/60 p-6 sm:grid-cols-3">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Trailing 12m liability
        </p>
        <p className="mt-1 text-4xl font-semibold tabular-nums text-foreground">
          {formatGbp(totals.trailing_gbp)}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Prior 12m liability
        </p>
        <p className="mt-1 text-4xl font-semibold tabular-nums text-foreground">
          {formatGbp(totals.prior_gbp)}
        </p>
      </div>
      <div className={cn('flex flex-col justify-center rounded-lg border px-4 py-3', tone)}>
        <span className="flex items-center gap-1 text-2xl font-semibold tabular-nums">
          <Arrow className="h-4 w-4" />
          {totals.delta_gbp < 0 ? '' : totals.delta_gbp > 0 ? '+' : ''}
          {formatGbp(totals.delta_gbp)}
        </span>
        <span className="text-[11px] uppercase tracking-wider opacity-80">
          {totals.delta_pct !== null
            ? `${totals.delta_pct >= 0 ? '+' : ''}${totals.delta_pct.toFixed(1)}% YoY`
            : 'No prior period yet'}
        </span>
      </div>
    </section>
  );
}

function Waterfall({ steps }: { steps: WaterfallStep[] }) {
  if (steps.length === 0) return null;
  // Convert into a prior -> deltas -> current bridge chart.
  const prior = steps.reduce((s, st) => s + st.prior_gbp, 0);
  const current = steps.reduce((s, st) => s + st.current_gbp, 0);
  const data = [
    { name: 'Prior 12m', value: prior, fill: '#64748b' },
    ...steps.map(s => ({
      name: s.metric_label,
      value: Math.abs(s.delta_gbp),
      signed: s.delta_gbp,
      fill: s.delta_gbp >= 0 ? '#ef4444' : '#10b981',
    })),
    { name: 'Current 12m', value: current, fill: '#ccff00' },
  ];
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <TrendingUp className="h-4 w-4 text-[#ccff00]" />
        Prior-year to current-year bridge
      </h3>
      <div className="h-60 rounded-xl border border-border/60 bg-card/40 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 16, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: 'currentColor' }}
              interval={0}
              stroke="currentColor"
              strokeOpacity={0.2}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'currentColor' }}
              stroke="currentColor"
              strokeOpacity={0.2}
              tickFormatter={v => formatGbpShort(Number(v))}
              width={60}
            />
            <ChartTooltip
              formatter={(v: any, _n: any, p: any) => {
                const signed = (p?.payload?.signed ?? v) as number;
                return [formatGbp(signed), p?.payload?.name];
              }}
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function MonthlyTable({ monthly }: { monthly: Monthly[] }) {
  if (monthly.length === 0) return null;
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Table2 className="h-4 w-4 text-[#ccff00]" />
        Month-by-month
      </h3>

      {/* Chart on top */}
      <div className="h-44 rounded-xl border border-border/60 bg-card/40 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="ff-monthly-grad" x1="0" y1="0" x2="0" y2="1">
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
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'currentColor' }}
              stroke="currentColor"
              strokeOpacity={0.2}
              tickFormatter={v => formatGbpShort(Number(v))}
              width={60}
            />
            <ChartTooltip
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
              formatter={(v: any) => [formatGbp(Number(v)), 'Cost']}
            />
            <Area
              type="monotone"
              dataKey="total_gbp"
              stroke="#ccff00"
              strokeWidth={2}
              fill="url(#ff-monthly-grad)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Table below */}
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">Month</th>
              <th className="px-3 py-2 text-right">£ total</th>
              <th className="px-3 py-2 text-right">Carbon £</th>
              <th className="px-3 py-2 text-right">Water £</th>
              <th className="px-3 py-2 text-right">tCO₂e</th>
              <th className="px-3 py-2 text-right">m³ water</th>
              <th className="px-3 py-2 text-right">Price £/tCO₂e</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map(m => (
              <tr key={m.month} className="border-t border-border/40 tabular-nums">
                <td className="px-3 py-1.5 text-muted-foreground">{m.month}</td>
                <td className="px-3 py-1.5 text-right font-medium">{formatGbp(m.total_gbp)}</td>
                <td className="px-3 py-1.5 text-right">
                  {formatGbp(m.by_metric_gbp.total_co2e ?? 0)}
                </td>
                <td className="px-3 py-1.5 text-right">
                  {formatGbp(m.by_metric_gbp.water_consumption ?? 0)}
                </td>
                <td className="px-3 py-1.5 text-right">
                  {m.tonnes_co2e.toLocaleString('en-GB', { maximumFractionDigits: 1 })}
                </td>
                <td className="px-3 py-1.5 text-right">
                  {m.m3_water.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">
                  {m.shadow_price_gbp_per_t !== null
                    ? `£${m.shadow_price_gbp_per_t}`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FacilityAttribution({
  rows,
  total,
}: {
  rows: FacilityRow[];
  total: number;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Per-facility attribution</h3>
      <ul className="space-y-2">
        {rows.map(r => (
          <li
            key={r.facility_id}
            className="flex items-center gap-3 rounded-md border border-border/60 bg-card/40 p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {r.facility_name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Carbon {formatGbp(r.carbon_gbp)} · Water {formatGbp(r.water_gbp)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {formatGbp(r.total_gbp)}
              </p>
              <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-[#ccff00]"
                  style={{
                    width: `${total > 0 ? Math.min(100, (r.total_gbp / total) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                {r.pct_of_total.toFixed(0)}%
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PriceHistory({ rows }: { rows: PriceChange[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <History className="h-4 w-4 text-[#ccff00]" />
        Shadow-price history
      </h3>
      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <li
            key={`${r.metric_key}-${r.effective_from}-${i}`}
            className="flex items-baseline justify-between gap-3 rounded-md border border-border/40 bg-card/30 p-2.5 text-sm"
          >
            <div className="min-w-0">
              <p className="text-foreground">
                {r.metric_label} · £{r.price_per_unit}/{r.unit}
                {r.is_org_override && (
                  <span className="ml-2 rounded-full bg-[#ccff00]/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#ccff00]">
                    Your override
                  </span>
                )}
              </p>
              {r.source && (
                <p className="text-[11px] text-muted-foreground">{r.source}</p>
              )}
            </div>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              from {r.effective_from}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatGbp(v: number): string {
  const abs = Math.abs(v);
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
