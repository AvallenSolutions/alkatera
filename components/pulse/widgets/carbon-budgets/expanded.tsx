'use client';

/**
 * Pulse U5 -- Carbon budgets, expanded view.
 *
 * Three sections:
 *   1. Existing rich CarbonBudgetWidget (CRUD + per-budget variance)
 *   2. Forecast-to-year-end: running cumulative emissions vs the annual
 *      budget ceiling, with linear-regression projection + confidence band
 *   3. Recent variance history at a glance (last 6 months actual vs budget)
 *
 * The forecast reuses `linearRegression` from lib/pulse/forecast.ts -- the
 * same engine Target Trajectory uses -- so the two surfaces share a model.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Loader2, Target, TrendingUp } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import {
  useRegisterDrillSlot,
  type DrillSlotRenderer,
} from '@/lib/pulse/MetricDrillContext';
import { linearRegression } from '@/lib/pulse/forecast';
import { CarbonBudgetWidget } from '@/components/pulse/widgets/CarbonBudgetWidget';

interface BudgetRow {
  id: string;
  scope: string;
  period: 'monthly' | 'quarterly' | 'annual';
  budget_tco2e: number;
  actual_tco2e: number;
  variance_pct: number;
  status: 'on_track' | 'at_risk' | 'over';
}

interface Snapshot {
  snapshot_date: string;
  value: number;
}

export function CarbonBudgetsExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(
    () => <CarbonBudgetsExpanded />,
    [],
  );
  useRegisterDrillSlot({
    id: 'carbon-budgets-expanded',
    title: 'Budgets, forecast + history',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'carbon-budgets',
    render: renderer,
  });
  return null;
}

function CarbonBudgetsExpanded() {
  return (
    <div className="space-y-8">
      <BudgetCrud />
      <YearEndForecast />
      <MonthlyHistory />
    </div>
  );
}

/** Reuse the existing CRUD widget -- no duplication. */
function BudgetCrud() {
  return <CarbonBudgetWidget />;
}

/**
 * Forecast-to-year-end: walks forward from today, projects the annual
 * cumulative-emissions line, and checks it against the annual budget.
 * Confidence band ±1σ from linear-regression residual.
 */
function YearEndForecast() {
  const { currentOrganization } = useOrganization();
  const [annualBudget, setAnnualBudget] = useState<BudgetRow | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [budgetRes, snapRes] = await Promise.all([
          fetch(`/api/pulse/carbon-budgets?organization_id=${currentOrganization.id}`),
          fetchYearToDateSnapshots(currentOrganization.id),
        ]);
        const budgetJson = await budgetRes.json();
        if (cancelled) return;
        const annual = ((budgetJson?.budgets ?? []) as BudgetRow[]).find(
          b => b.period === 'annual' && b.scope === 'all',
        );
        setAnnualBudget(annual ?? null);
        setSnapshots(snapRes);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  const chart = useMemo(
    () => buildForecastChart(snapshots, annualBudget?.budget_tco2e ?? null),
    [snapshots, annualBudget],
  );

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <TrendingUp className="h-4 w-4 text-[#ccff00]" />
        Year-end forecast
      </h3>

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && !annualBudget && (
        <p className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
          Set an annual budget (all scopes) above and the year-end forecast
          will draw here.
        </p>
      )}

      {!loading && annualBudget && chart.points.length < 2 && (
        <p className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
          Not enough snapshots yet to project year-end. Come back in a few weeks.
        </p>
      )}

      {!loading && annualBudget && chart.points.length >= 2 && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Actual YTD"
              value={`${chart.actualYtdT.toLocaleString('en-GB', { maximumFractionDigits: 0 })} t`}
              tone="neutral"
            />
            <Stat
              label="Projected year-end"
              value={`${chart.projectedT.toLocaleString('en-GB', { maximumFractionDigits: 0 })} t`}
              tone={chart.projectedT > annualBudget.budget_tco2e ? 'bad' : 'good'}
            />
            <Stat
              label="Budget"
              value={`${annualBudget.budget_tco2e.toLocaleString('en-GB', { maximumFractionDigits: 0 })} t`}
              tone="neutral"
            />
          </div>

          <div className="h-64 rounded-xl border border-border/60 bg-card/40 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart.points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="cb-forecast-band" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ccff00" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#ccff00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={d => d.slice(5)}
                  tick={{ fontSize: 10, fill: 'currentColor' }}
                  stroke="currentColor"
                  strokeOpacity={0.2}
                  minTickGap={30}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'currentColor' }}
                  stroke="currentColor"
                  strokeOpacity={0.2}
                  tickFormatter={v => `${Math.round(Number(v))}t`}
                  width={56}
                />
                <ChartTooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6 }}
                  formatter={(v: any, k: any) => [
                    `${Number(v).toLocaleString('en-GB', { maximumFractionDigits: 1 })} t`,
                    k === 'actual' ? 'Actual' : k === 'forecast' ? 'Projection' : 'Band',
                  ]}
                  labelFormatter={(d: string) => d}
                />
                {/* Confidence band */}
                <Area
                  dataKey="band"
                  stroke="none"
                  fill="url(#cb-forecast-band)"
                  isAnimationActive={false}
                  connectNulls
                />
                {/* Actual cumulative */}
                <Line
                  dataKey="actual"
                  stroke="#ccff00"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                {/* Projected cumulative (dashed) */}
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
                  y={annualBudget.budget_tco2e}
                  stroke="#94a3b8"
                  strokeDasharray="2 2"
                  label={{
                    value: 'Budget',
                    fontSize: 10,
                    fill: 'currentColor',
                    position: 'right',
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Projection uses a least-squares fit of your year-to-date snapshots,
            extended to 31 Dec. Shaded band is ±1σ residual variance. The
            forecast is a pace estimate, not a seasonality-corrected model.
          </p>
        </>
      )}
    </section>
  );
}

function MonthlyHistory() {
  const { currentOrganization } = useOrganization();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const rows = await fetchLastNMonthsSnapshots(currentOrganization.id, 24);
      if (!cancelled) {
        setSnapshots(rows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  const monthly = useMemo(() => monthlyTotals(snapshots), [snapshots]);

  if (loading) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (monthly.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Activity className="h-4 w-4 text-[#ccff00]" />
        Last 24 months of emissions
      </h3>
      <div className="h-48 rounded-xl border border-border/60 bg-card/40 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={monthly} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="month"
              tickFormatter={m => m.slice(2)}
              tick={{ fontSize: 10, fill: 'currentColor' }}
              stroke="currentColor"
              strokeOpacity={0.2}
              minTickGap={30}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'currentColor' }}
              stroke="currentColor"
              strokeOpacity={0.2}
              tickFormatter={v => `${Math.round(Number(v))}t`}
              width={56}
            />
            <ChartTooltip
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
              formatter={(v: any) => [
                `${Number(v).toLocaleString('en-GB', { maximumFractionDigits: 1 })} t`,
                'Emissions',
              ]}
            />
            <Line
              dataKey="t_co2e"
              stroke="#ccff00"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// Helpers --------------------------------------------------------------------

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'good' | 'bad' | 'neutral';
}) {
  const toneClass =
    tone === 'good'
      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500'
      : tone === 'bad'
        ? 'border-red-500/30 bg-red-500/5 text-red-500'
        : 'border-border/60 bg-card/40 text-foreground';
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

async function fetchYearToDateSnapshots(orgId: string): Promise<Snapshot[]> {
  const startOfYear = new Date(new Date().getFullYear(), 0, 1)
    .toISOString()
    .slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const { supabase } = await import('@/lib/supabaseClient');
  const { data } = await supabase
    .from('metric_snapshots')
    .select('snapshot_date, value')
    .eq('organization_id', orgId)
    .eq('metric_key', 'total_co2e')
    .gte('snapshot_date', startOfYear)
    .lte('snapshot_date', today)
    .order('snapshot_date', { ascending: true });
  return (data ?? []) as Snapshot[];
}

async function fetchLastNMonthsSnapshots(orgId: string, months: number): Promise<Snapshot[]> {
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  const { supabase } = await import('@/lib/supabaseClient');
  const { data } = await supabase
    .from('metric_snapshots')
    .select('snapshot_date, value')
    .eq('organization_id', orgId)
    .eq('metric_key', 'total_co2e')
    .gte('snapshot_date', start.toISOString().slice(0, 10))
    .order('snapshot_date', { ascending: true });
  return (data ?? []) as Snapshot[];
}

/** Group snapshots (daily kg) into monthly tonne buckets. */
function monthlyTotals(snapshots: Snapshot[]): Array<{ month: string; t_co2e: number }> {
  const bucket = new Map<string, number>();
  for (const s of snapshots) {
    const month = String(s.snapshot_date).slice(0, 7);
    const v = Number(s.value ?? 0);
    if (!Number.isFinite(v)) continue;
    bucket.set(month, (bucket.get(month) ?? 0) + v / 1000);
  }
  return Array.from(bucket.entries())
    .map(([month, t_co2e]) => ({ month, t_co2e }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Build the forecast chart data from year-to-date snapshots.
 *
 * Each chart row has four potential series:
 *   actual    -- cumulative tonnes YTD (historical)
 *   forecast  -- linear extrapolation from today to 31 Dec (projection)
 *   band      -- ±1σ residual confidence band (projection only)
 *
 * Returns the chart points + the actual YTD total + the projected year-end.
 */
function buildForecastChart(
  snapshots: Snapshot[],
  _annualBudget: number | null,
): {
  points: Array<{ date: string; actual: number | null; forecast: number | null; band: number[] | null }>;
  actualYtdT: number;
  projectedT: number;
} {
  const yearStartMs = new Date(new Date().getFullYear(), 0, 1).getTime();
  const yearEndMs = new Date(new Date().getFullYear(), 11, 31).getTime();

  // Daily snapshots -> cumulative tonnes.
  const points: Array<{
    date: string;
    actual: number | null;
    forecast: number | null;
    band: number[] | null;
  }> = [];
  let cumulative = 0;
  const regressionPoints: Array<{ x: number; y: number }> = [];

  for (const s of snapshots) {
    const v = Number(s.value ?? 0);
    if (!Number.isFinite(v)) continue;
    cumulative += v / 1000;
    const date = String(s.snapshot_date);
    const x = (new Date(date).getTime() - yearStartMs) / 86_400_000;
    regressionPoints.push({ x, y: cumulative });
    points.push({ date, actual: cumulative, forecast: null, band: null });
  }

  if (points.length < 2) {
    return { points, actualYtdT: cumulative, projectedT: cumulative };
  }

  const reg = linearRegression(regressionPoints);
  if (!reg) {
    return { points, actualYtdT: cumulative, projectedT: cumulative };
  }

  // Project forward in 7-day steps to 31 Dec.
  const lastXDays = regressionPoints[regressionPoints.length - 1].x;
  const totalYearDays = (yearEndMs - yearStartMs) / 86_400_000;

  // Anchor the forecast at the last actual point so the curves connect.
  points[points.length - 1].forecast = cumulative;

  for (let day = Math.ceil(lastXDays) + 7; day <= totalYearDays; day += 7) {
    const predicted = reg.slope * day + reg.intercept;
    // Don't project below the current cumulative total (carbon emissions are
    // monotonically non-decreasing within a single year).
    const floored = Math.max(cumulative, predicted);
    const horizon = day - lastXDays;
    const sigma = reg.residualStdDev * Math.sqrt(1 + horizon / Math.max(1, lastXDays));
    const dateStr = new Date(yearStartMs + day * 86_400_000).toISOString().slice(0, 10);
    points.push({
      date: dateStr,
      actual: null,
      forecast: floored,
      band: [Math.max(cumulative, floored - sigma), floored + sigma],
    });
  }

  const projectedT = Math.max(cumulative, reg.slope * totalYearDays + reg.intercept);
  return { points, actualYtdT: cumulative, projectedT };
}
