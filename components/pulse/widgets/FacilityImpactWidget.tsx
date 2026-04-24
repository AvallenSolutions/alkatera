'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Building2,
  Droplets,
  Flame,
  Leaf,
  Recycle,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrganization } from '@/lib/organizationContext';
import { cn } from '@/lib/utils';

interface MonthBucket {
  month: string;
  month_label: string;
  electricity_kwh: number;
  gas_kwh: number;
  fuel_litres: number;
  water_m3: number;
  waste_kg: number;
  waste_general_kg: number;
  waste_hazardous_kg: number;
  waste_recycling_kg: number;
  electricity_tco2e_tariff: number;
  electricity_tco2e_live: number;
  gas_tco2e: number;
  other_scope12_tco2e: number;
  total_tco2e: number;
  grid_intensity_avg_g_per_kwh: number;
  grid_confidence: 'live' | 'country_average' | 'global_average';
}

interface FacilityImpactResponse {
  months: MonthBucket[];
  facilities: { id: string; name: string; country_code: string | null; has_live_grid: boolean }[];
  summary: {
    facilities_count: number;
    annual_kwh: number;
    annual_tco2e_tariff: number;
    annual_tco2e_live: number;
    annual_grid_avg_g_per_kwh: number;
    seasonality_delta_pct: number;
    cleanest_month: string | null;
    dirtiest_month: string | null;
    confidence: 'live' | 'mixed' | 'fallback';
  };
}

/**
 * Pulse — FacilityImpactWidget
 *
 * Tracks Scope 1 & 2 utilities + water + waste over a rolling 12-month
 * window for the org's facilities. The headline insight is the dual-bar
 * comparison on the Electricity tab: "bill estimate" (kWh × static
 * country average) vs "actual grid impact" (kWh × monthly mean live
 * intensity). For UK facilities the delta exposes the 2-3× swing between
 * summer and winter grid carbon — the same kWh emits dramatically more
 * CO₂ in January than in July.
 *
 * Each metric (Electricity, Gas/Heat, Water, Waste) gets its own tab
 * filled with KPIs, a primary chart, and where it adds value, a
 * secondary chart or callout (e.g. grid-intensity line on Electricity,
 * recovery-rate trend on Waste).
 */
export function FacilityImpactWidget() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<FacilityImpactResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/pulse/facility-impact?organization_id=${currentOrganization.id}&months=12`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as FacilityImpactResponse;
        if (cancelled) return;
        setData(body);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load');
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
      <Card className="border-border/60">
        <CardContent className="p-5 text-sm text-muted-foreground">
          Loading facility impact…
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-5 text-sm text-amber-700 dark:text-amber-300">
          {error ?? 'Could not load facility impact.'}
        </CardContent>
      </Card>
    );
  }

  if (data.facilities.length === 0) {
    return <EmptyState reason="no_facilities" />;
  }

  const totalKwh = data.months.reduce((s, m) => s + m.electricity_kwh, 0);
  const totalGas = data.months.reduce((s, m) => s + m.gas_kwh, 0);
  const totalWater = data.months.reduce((s, m) => s + m.water_m3, 0);
  const totalWaste = data.months.reduce((s, m) => s + m.waste_kg, 0);
  if (totalKwh === 0 && totalGas === 0 && totalWater === 0 && totalWaste === 0) {
    return <EmptyState reason="no_data" facilityCount={data.facilities.length} />;
  }

  return <FacilityImpactView data={data} />;
}

function FacilityImpactView({ data }: { data: FacilityImpactResponse }) {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-4 p-5">
        {/* Header */}
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#ccff00]" />
              <h3 className="text-sm font-semibold text-foreground">Facility impact</h3>
              <ConfidenceBadge confidence={data.summary.confidence} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Rolling 12 months · {data.summary.facilities_count} facilit
              {data.summary.facilities_count === 1 ? 'y' : 'ies'} · grid avg{' '}
              <span className="font-medium tabular-nums text-foreground">
                {Math.round(data.summary.annual_grid_avg_g_per_kwh)}
              </span>{' '}
              g CO₂/kWh
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {data.summary.annual_tco2e_live.toFixed(1)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">tCO₂e</span>
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              live grid total
            </p>
          </div>
        </header>

        {/* Tabs */}
        <Tabs defaultValue="electricity" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="electricity" className="gap-1.5 text-xs">
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Electricity</span>
            </TabsTrigger>
            <TabsTrigger value="gas" className="gap-1.5 text-xs">
              <Flame className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Gas / heat</span>
            </TabsTrigger>
            <TabsTrigger value="water" className="gap-1.5 text-xs">
              <Droplets className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Water</span>
            </TabsTrigger>
            <TabsTrigger value="waste" className="gap-1.5 text-xs">
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Waste</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="electricity" className="m-0">
            <ElectricityTab data={data} />
          </TabsContent>
          <TabsContent value="gas" className="m-0">
            <GasTab months={data.months} />
          </TabsContent>
          <TabsContent value="water" className="m-0">
            <WaterTab months={data.months} />
          </TabsContent>
          <TabsContent value="waste" className="m-0">
            <WasteTab months={data.months} />
          </TabsContent>
        </Tabs>

        {/* Methodology footer */}
        <p className="text-[10px] leading-relaxed text-muted-foreground/70">
          Bill estimate uses IEA 2024 country averages. Live grid uses the consumption-weighted
          monthly mean of <code className="font-data">grid_carbon_readings</code> (UK:{' '}
          <a
            href="https://carbonintensity.org.uk"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline"
          >
            carbonintensity.org.uk
          </a>
          ). Combustion emissions use DEFRA 2024 conversion factors. Waste figures classified per
          CSRD ESRS E5 streams.
        </p>
      </CardContent>
    </Card>
  );
}

/* ============================================================
   Electricity tab — the hero with the seasonality story.
   ============================================================ */
function ElectricityTab({ data }: { data: FacilityImpactResponse }) {
  const totalKwh = data.summary.annual_kwh;
  const seasonalityVisible =
    data.summary.confidence !== 'fallback' &&
    data.summary.seasonality_delta_pct > 5 &&
    data.summary.cleanest_month != null;

  const chartData = data.months.map(m => ({
    month: m.month_label,
    raw: m,
    tariff: Number(m.electricity_tco2e_tariff.toFixed(3)),
    live: Number(m.electricity_tco2e_live.toFixed(3)),
    intensity: Number(m.grid_intensity_avg_g_per_kwh.toFixed(0)),
  }));

  const peakMonth = data.months.reduce<MonthBucket | null>(
    (a, b) => (b.electricity_kwh > (a?.electricity_kwh ?? 0) ? b : a),
    null,
  );

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { label: 'Total', value: formatNumber(totalKwh), unit: 'kWh' },
          {
            label: 'Live grid impact',
            value: data.summary.annual_tco2e_live.toFixed(1),
            unit: 'tCO₂e',
            accent: '#ccff00',
          },
          {
            label: 'Bill estimate',
            value: data.summary.annual_tco2e_tariff.toFixed(1),
            unit: 'tCO₂e',
            accent: '#94a3b8',
          },
          {
            label: 'Annual grid avg',
            value: Math.round(data.summary.annual_grid_avg_g_per_kwh).toString(),
            unit: 'g/kWh',
          },
        ]}
      />

      {/* Hero dual-bar chart */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Monthly emissions · bill estimate vs live grid
          </p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <LegendDot color="#94a3b8" label="Bill estimate" />
            <LegendDot color="#ccff00" label="Live grid" />
          </div>
        </div>
        <div className="h-56 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: 'currentColor' }}
                stroke="currentColor"
                strokeOpacity={0.2}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'currentColor' }}
                stroke="currentColor"
                strokeOpacity={0.2}
                width={36}
              />
              <Tooltip
                content={<ElectricityTooltip />}
                cursor={{ fill: 'rgba(204,255,0,0.06)' }}
              />
              <Bar
                dataKey="tariff"
                name="Bill estimate"
                fill="#94a3b8"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="live"
                name="Live grid"
                fill="#ccff00"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid intensity over time — vivid seasonality visualisation */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Grid carbon intensity over time
          </p>
          {peakMonth && (
            <p className="text-[10px] tabular-nums text-muted-foreground">
              Peak month: <span className="font-medium text-foreground">{peakMonth.month_label}</span>{' '}
              ({formatNumber(peakMonth.electricity_kwh)} kWh)
            </p>
          )}
        </div>
        <div className="h-32 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: 'currentColor' }}
                stroke="currentColor"
                strokeOpacity={0.2}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'currentColor' }}
                stroke="currentColor"
                strokeOpacity={0.2}
                width={36}
                domain={['auto', 'auto']}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(204,255,0,0.3)' }}
                contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid rgba(120,120,120,0.3)' }}
                formatter={(value: number) => [`${Math.round(value)} g/kWh`, 'Grid avg']}
              />
              <Line
                type="monotone"
                dataKey="intensity"
                stroke="#ccff00"
                strokeWidth={2}
                dot={{ r: 3, fill: '#ccff00', strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Seasonality callout */}
      {seasonalityVisible && (
        <SeasonalityCallout
          data={data}
          cleanest={data.months.find(m => m.month === data.summary.cleanest_month)!}
          dirtiest={data.months.find(m => m.month === data.summary.dirtiest_month)!}
        />
      )}

      {/* Fallback nudge */}
      {data.summary.confidence === 'fallback' && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <Sparkles className="mr-1 inline h-3 w-3" />
          No live grid feed for your facilities yet. The line is flat because we&apos;re using a
          static IEA country average. Connect ElectricityMaps to expose summer/winter swings for
          non-UK facilities.
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Gas / heat tab.
   ============================================================ */
function GasTab({ months }: { months: MonthBucket[] }) {
  const total = months.reduce((s, m) => s + m.gas_kwh, 0);
  const totalTco2e = months.reduce((s, m) => s + m.gas_tco2e, 0);
  const monthsWithData = months.filter(m => m.gas_kwh > 0).length;
  const avgMonth = monthsWithData > 0 ? total / monthsWithData : 0;
  const peakMonth = months.reduce<MonthBucket | null>(
    (a, b) => (b.gas_kwh > (a?.gas_kwh ?? 0) ? b : a),
    null,
  );

  if (total === 0) {
    return <TabEmpty icon={Flame} label="No gas or purchased heat entries in the last 12 months." />;
  }

  const chartData = months.map(m => ({
    month: m.month_label,
    kwh: Number(m.gas_kwh.toFixed(1)),
    tco2e: Number(m.gas_tco2e.toFixed(3)),
  }));

  // Detect heating-driven seasonality: northern hemisphere months
  // Nov-Feb typically peak for heating gas use.
  const winterAvg = avgOf(months, ['Nov', 'Dec', 'Jan', 'Feb'], m => m.gas_kwh);
  const summerAvg = avgOf(months, ['Jun', 'Jul', 'Aug'], m => m.gas_kwh);
  const heatingDelta = summerAvg > 0 ? ((winterAvg - summerAvg) / summerAvg) * 100 : 0;

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { label: 'Total', value: formatNumber(total), unit: 'kWh' },
          { label: 'Emissions', value: totalTco2e.toFixed(1), unit: 'tCO₂e', accent: '#a78bfa' },
          { label: 'Avg / month', value: formatNumber(avgMonth), unit: 'kWh' },
          {
            label: 'Peak month',
            value: peakMonth?.month_label ?? '—',
            unit: peakMonth ? `${formatNumber(peakMonth.gas_kwh)} kWh` : '',
          },
        ]}
      />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Monthly consumption · kWh
          </p>
          <p className="text-[10px] text-muted-foreground">DEFRA 2024 · 0.18 kg CO₂e/kWh</p>
        </div>
        <div className="h-64 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: 'currentColor' }}
                stroke="currentColor"
                strokeOpacity={0.2}
              />
              <YAxis
                yAxisId="kwh"
                tick={{ fontSize: 10, fill: 'currentColor' }}
                stroke="currentColor"
                strokeOpacity={0.2}
                width={42}
              />
              <YAxis
                yAxisId="co2"
                orientation="right"
                tick={{ fontSize: 10, fill: '#a78bfa' }}
                stroke="#a78bfa"
                strokeOpacity={0.4}
                width={36}
              />
              <Tooltip
                cursor={{ fill: 'rgba(249,115,22,0.06)' }}
                contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid rgba(120,120,120,0.3)' }}
                formatter={(value: number, name: string) =>
                  name === 'kwh'
                    ? [`${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })} kWh`, 'Consumption']
                    : [`${value.toFixed(2)} tCO₂e`, 'Emissions']
                }
              />
              <Bar
                yAxisId="kwh"
                dataKey="kwh"
                fill="#f97316"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
              <Line
                yAxisId="co2"
                type="monotone"
                dataKey="tco2e"
                stroke="#a78bfa"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {Math.abs(heatingDelta) > 20 && winterAvg > 0 && summerAvg > 0 && (
        <div className="rounded-md border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
          <Flame className="mr-1 inline h-3 w-3" />
          Winter gas use averaged{' '}
          <span className="font-medium tabular-nums">{Math.round(heatingDelta)}%</span> higher than
          summer — typical of heating-driven facilities. Heat-recovery, building insulation, or a
          heat pump retrofit are the highest-leverage interventions.
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Water tab.
   ============================================================ */
function WaterTab({ months }: { months: MonthBucket[] }) {
  const total = months.reduce((s, m) => s + m.water_m3, 0);
  const monthsWithData = months.filter(m => m.water_m3 > 0).length;
  const avgMonth = monthsWithData > 0 ? total / monthsWithData : 0;
  const dailyAvg = total / 365; // approximate
  const peakMonth = months.reduce<MonthBucket | null>(
    (a, b) => (b.water_m3 > (a?.water_m3 ?? 0) ? b : a),
    null,
  );

  if (total === 0) {
    return <TabEmpty icon={Droplets} label="No water intake entries in the last 12 months." />;
  }

  const chartData = months.map(m => ({
    month: m.month_label,
    m3: Number(m.water_m3.toFixed(2)),
  }));

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { label: 'Total intake', value: formatNumber(total), unit: 'm³', accent: '#3b82f6' },
          { label: 'Avg / month', value: formatNumber(avgMonth), unit: 'm³' },
          { label: 'Avg / day', value: formatNumber(dailyAvg), unit: 'm³' },
          {
            label: 'Peak month',
            value: peakMonth?.month_label ?? '—',
            unit: peakMonth ? `${formatNumber(peakMonth.water_m3)} m³` : '',
          },
        ]}
      />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Monthly intake · m³
          </p>
          <p className="text-[10px] text-muted-foreground">CSRD ESRS E3 — water consumption</p>
        </div>
        <div className="h-64 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: 'currentColor' }}
                stroke="currentColor"
                strokeOpacity={0.2}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'currentColor' }}
                stroke="currentColor"
                strokeOpacity={0.2}
                width={42}
              />
              <Tooltip
                cursor={{ fill: 'rgba(59,130,246,0.06)' }}
                contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid rgba(120,120,120,0.3)' }}
                formatter={(value: number) => [
                  `${value.toLocaleString('en-GB', { maximumFractionDigits: 1 })} m³`,
                  'Intake',
                ]}
              />
              <Bar dataKey="m3" fill="#3b82f6" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
        <Droplets className="mr-1 inline h-3 w-3" />
        Water intake shown in native units. AWARE-weighted scarcity impact is calculated per
        facility location and surfaces in your product LCAs and sustainability reports.
      </div>
    </div>
  );
}

/* ============================================================
   Waste tab.
   ============================================================ */
function WasteTab({ months }: { months: MonthBucket[] }) {
  const total = months.reduce((s, m) => s + m.waste_kg, 0);
  const totalRecycling = months.reduce((s, m) => s + m.waste_recycling_kg, 0);
  const totalGeneral = months.reduce((s, m) => s + m.waste_general_kg, 0);
  const totalHazardous = months.reduce((s, m) => s + m.waste_hazardous_kg, 0);
  const recoveryRate = total > 0 ? (totalRecycling / total) * 100 : 0;
  const hazardousPct = total > 0 ? (totalHazardous / total) * 100 : 0;

  if (total === 0) {
    return <TabEmpty icon={Trash2} label="No waste entries in the last 12 months." />;
  }

  const chartData = months.map(m => {
    const monthTotal = m.waste_kg;
    const monthRecovery = monthTotal > 0 ? (m.waste_recycling_kg / monthTotal) * 100 : 0;
    return {
      month: m.month_label,
      recycling: Number(m.waste_recycling_kg.toFixed(1)),
      general: Number(m.waste_general_kg.toFixed(1)),
      hazardous: Number(m.waste_hazardous_kg.toFixed(1)),
      recovery: Number(monthRecovery.toFixed(1)),
    };
  });

  // Recovery-rate trend: compare first quarter avg to last quarter avg.
  const firstQuarter = chartData.slice(0, 3).filter(d => d.recovery > 0);
  const lastQuarter = chartData.slice(-3).filter(d => d.recovery > 0);
  const firstAvg = firstQuarter.length
    ? firstQuarter.reduce((s, d) => s + d.recovery, 0) / firstQuarter.length
    : 0;
  const lastAvg = lastQuarter.length
    ? lastQuarter.reduce((s, d) => s + d.recovery, 0) / lastQuarter.length
    : 0;
  const recoveryTrendPp = lastAvg - firstAvg; // percentage points

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { label: 'Total', value: formatNumber(total), unit: 'kg' },
          {
            label: 'Recycled',
            value: `${recoveryRate.toFixed(0)}%`,
            unit: `${formatNumber(totalRecycling)} kg`,
            accent: '#10b981',
          },
          {
            label: 'General',
            value: formatNumber(totalGeneral),
            unit: 'kg',
            accent: '#94a3b8',
          },
          {
            label: 'Hazardous',
            value: `${hazardousPct.toFixed(1)}%`,
            unit: `${formatNumber(totalHazardous)} kg`,
            accent: '#ef4444',
          },
        ]}
      />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Monthly waste · stream breakdown
          </p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <LegendDot color="#10b981" label="Recycled" />
            <LegendDot color="#94a3b8" label="General" />
            <LegendDot color="#ef4444" label="Hazardous" />
          </div>
        </div>
        <div className="h-64 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: 'currentColor' }}
                stroke="currentColor"
                strokeOpacity={0.2}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'currentColor' }}
                stroke="currentColor"
                strokeOpacity={0.2}
                width={42}
              />
              <Tooltip
                cursor={{ fill: 'rgba(239,68,68,0.06)' }}
                contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid rgba(120,120,120,0.3)' }}
                formatter={(value: number, name: string) => [
                  `${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })} kg`,
                  name === 'recycling' ? 'Recycled' : name === 'general' ? 'General' : 'Hazardous',
                ]}
              />
              <Bar dataKey="recycling" stackId="waste" fill="#10b981" isAnimationActive={false} />
              <Bar dataKey="general" stackId="waste" fill="#94a3b8" isAnimationActive={false} />
              <Bar dataKey="hazardous" stackId="waste" fill="#ef4444" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recovery rate trend · % recycled
          </p>
          {recoveryTrendPp !== 0 && (
            <p className="text-[10px] tabular-nums text-muted-foreground">
              {recoveryTrendPp > 0 ? '+' : ''}
              {recoveryTrendPp.toFixed(1)} pp · last 3 mo vs first 3 mo
            </p>
          )}
        </div>
        <div className="h-32 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: 'currentColor' }}
                stroke="currentColor"
                strokeOpacity={0.2}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'currentColor' }}
                stroke="currentColor"
                strokeOpacity={0.2}
                width={36}
                domain={[0, 100]}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(16,185,129,0.3)' }}
                contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid rgba(120,120,120,0.3)' }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Recovery']}
              />
              <Line
                type="monotone"
                dataKey="recovery"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {recoveryTrendPp >= 5 && (
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          <Recycle className="mr-1 inline h-3 w-3" />
          Recovery rate has improved by{' '}
          <span className="font-medium tabular-nums">{recoveryTrendPp.toFixed(1)} pp</span> over
          the period — keep going. CSRD ESRS E5 reporters should document the operational changes
          driving the improvement.
        </div>
      )}
      {recoveryTrendPp <= -5 && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <Recycle className="mr-1 inline h-3 w-3" />
          Recovery rate has dropped by{' '}
          <span className="font-medium tabular-nums">
            {Math.abs(recoveryTrendPp).toFixed(1)} pp
          </span>{' '}
          over the period. Worth investigating contamination, contract changes, or stream
          mis-classification.
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Shared building blocks.
   ============================================================ */

interface KpiItem {
  label: string;
  value: string;
  unit: string;
  accent?: string;
}

function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(item => (
        <div
          key={item.label}
          className="rounded-lg border border-border/60 bg-card/40 p-3"
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {item.label}
          </p>
          <p
            className="mt-1 text-lg font-semibold tabular-nums"
            style={item.accent ? { color: item.accent } : undefined}
          >
            {item.value}
            {item.unit && (
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                {item.unit}
              </span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

function TabEmpty({ icon: Icon, label }: { icon: typeof Zap; label: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/30 text-center">
      <Icon className="h-6 w-6 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function SeasonalityCallout({
  data,
  cleanest,
  dirtiest,
}: {
  data: FacilityImpactResponse;
  cleanest: MonthBucket;
  dirtiest: MonthBucket;
}) {
  const fmt = (key: string) =>
    new Date(`${key}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'long' });
  return (
    <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-3 text-xs text-emerald-700 dark:text-emerald-300">
      <div className="flex items-start gap-2">
        <Leaf className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">
            Your {fmt(dirtiest.month)} electricity emitted{' '}
            <span className="tabular-nums">
              {data.summary.seasonality_delta_pct.toFixed(0)}%
            </span>{' '}
            more CO₂ than the same kWh would have in {fmt(cleanest.month)}.
          </p>
          <p className="mt-1 leading-relaxed text-emerald-600/90 dark:text-emerald-400/80">
            Grid carbon was{' '}
            <span className="font-medium tabular-nums">
              {Math.round(dirtiest.grid_intensity_avg_g_per_kwh)} g/kWh
            </span>{' '}
            in {fmt(dirtiest.month)} vs{' '}
            <span className="font-medium tabular-nums">
              {Math.round(cleanest.grid_intensity_avg_g_per_kwh)} g/kWh
            </span>{' '}
            in {fmt(cleanest.month)} — solar generation drops sharply in winter while gas peakers
            cover heating demand. Time-shifting energy-intensive operations into the summer
            months reduces real impact even at flat consumption.
          </p>
        </div>
      </div>
    </div>
  );
}

function ElectricityTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const raw = payload[0]?.payload?.raw as MonthBucket | undefined;
  if (!raw) return null;
  return (
    <div className="rounded-md border border-border/60 bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-foreground">
        {label} · {raw.electricity_kwh.toLocaleString('en-GB', { maximumFractionDigits: 0 })} kWh
      </p>
      <p className="text-muted-foreground">
        Bill estimate:{' '}
        <span className="tabular-nums text-foreground">
          {raw.electricity_tco2e_tariff.toFixed(2)} tCO₂e
        </span>
      </p>
      <p className="text-muted-foreground">
        Live grid:{' '}
        <span className="tabular-nums text-foreground">
          {raw.electricity_tco2e_live.toFixed(2)} tCO₂e
        </span>
      </p>
      <p className="mt-1 border-t border-border/40 pt-1 text-[10px] text-muted-foreground">
        Grid avg this month:{' '}
        <span className="tabular-nums text-foreground">
          {Math.round(raw.grid_intensity_avg_g_per_kwh)} g/kWh
        </span>{' '}
        · {labelForConfidence(raw.grid_confidence)}
      </p>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: 'live' | 'mixed' | 'fallback' }) {
  const styles =
    confidence === 'live'
      ? 'border-[#ccff00]/40 bg-[#ccff00]/10 text-[#ccff00]'
      : confidence === 'mixed'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
        : 'border-slate-500/40 bg-slate-500/10 text-slate-400';
  const label =
    confidence === 'live'
      ? 'Live grid'
      : confidence === 'mixed'
        ? 'Mixed sources'
        : 'Country avg';
  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] font-semibold uppercase tracking-wider', styles)}
    >
      {label}
    </Badge>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function EmptyState({
  reason,
  facilityCount,
}: {
  reason: 'no_facilities' | 'no_data';
  facilityCount?: number;
}) {
  return (
    <Card className="border-dashed border-border/60 bg-card/40">
      <CardContent className="space-y-2 p-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[#ccff00]" />
          <h3 className="text-sm font-semibold text-foreground">Facility impact</h3>
        </div>
        {reason === 'no_facilities' ? (
          <p className="text-sm text-muted-foreground">
            Add a facility under{' '}
            <a href="/facilities/" className="text-[#ccff00] underline-offset-2 hover:underline">
              Facilities
            </a>{' '}
            and upload a utility bill to see your monthly Scope 1 &amp; 2 impact, with live UK grid
            carbon applied.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {facilityCount ?? 0} facility found, but no utility / water / waste entries in the
            last 12 months. Capture data from your bills to populate this widget.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function labelForConfidence(c: 'live' | 'country_average' | 'global_average'): string {
  if (c === 'live') return 'live data';
  if (c === 'country_average') return 'country avg';
  return 'global avg';
}

function avgOf(
  months: MonthBucket[],
  labels: string[],
  pick: (m: MonthBucket) => number,
): number {
  const matching = months.filter(m => labels.includes(m.month_label));
  if (matching.length === 0) return 0;
  return matching.reduce((s, m) => s + pick(m), 0) / matching.length;
}

function formatNumber(n: number): string {
  if (n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}
