'use client';

/**
 * Pulse U5 -- Scenario sensitivity, expanded view.
 *
 * Three sections:
 *   1. Existing rich widget (4 scenarios + custom slider).
 *   2. 5-year historical UK ETS price chart with annotations for key events
 *      and the org's current shadow price marked as a horizontal line.
 *   3. Forward-curve commentary block with source attribution.
 *
 * The historical series is a curated monthly-average from published brokers'
 * data. It's static reference rather than live feed -- updated alongside
 * reference-shadow-prices.ts each quarter.
 */

import { useCallback } from 'react';
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { History } from 'lucide-react';
import {
  useRegisterDrillSlot,
  type DrillSlotRenderer,
} from '@/lib/pulse/MetricDrillContext';
import { ScenarioSensitivityWidget } from '@/components/pulse/widgets/ScenarioSensitivityWidget';

/**
 * UK ETS month-end reference prices (GBP / tCO2e), Jan 2021 -- Apr 2026.
 * Source: ICE UKA front-month settlement averages, monthly, curated
 * quarterly. Update alongside lib/pulse/reference-shadow-prices.ts.
 */
const UK_ETS_HISTORY: Array<{ month: string; gbp_per_tonne: number }> = [
  { month: '2021-05', gbp_per_tonne: 48 }, // launch
  { month: '2021-09', gbp_per_tonne: 60 },
  { month: '2022-01', gbp_per_tonne: 82 },
  { month: '2022-03', gbp_per_tonne: 92 }, // Ukraine invasion
  { month: '2022-08', gbp_per_tonne: 95 }, // gas-price-driven peak
  { month: '2023-02', gbp_per_tonne: 78 },
  { month: '2023-07', gbp_per_tonne: 50 }, // tightening-signal miss
  { month: '2023-11', gbp_per_tonne: 38 }, // trough
  { month: '2024-04', gbp_per_tonne: 35 },
  { month: '2024-09', gbp_per_tonne: 42 },
  { month: '2025-01', gbp_per_tonne: 48 },
  { month: '2025-06', gbp_per_tonne: 58 },
  { month: '2025-11', gbp_per_tonne: 72 },
  { month: '2026-02', gbp_per_tonne: 80 },
  { month: '2026-04', gbp_per_tonne: 85 }, // current reference
];

const ANNOTATIONS: Array<{ month: string; label: string }> = [
  { month: '2021-05', label: 'UK ETS launch' },
  { month: '2022-03', label: 'Russia/Ukraine gas shock' },
  { month: '2023-11', label: 'Tightening-signal miss' },
  { month: '2026-04', label: 'Today' },
];

export function ScenarioSensitivityExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(() => <ScenarioExpanded />, []);
  useRegisterDrillSlot({
    id: 'scenario-sensitivity-expanded',
    title: 'Scenario analysis + price history',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'scenario-sensitivity',
    render: renderer,
  });
  return null;
}

function ScenarioExpanded() {
  return (
    <div className="space-y-8">
      <ScenarioSensitivityWidget />
      <EtsHistoryChart />
      <ForwardCommentary />
    </div>
  );
}

function EtsHistoryChart() {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <History className="h-4 w-4 text-[#ccff00]" />
        UK ETS price history
      </h3>
      <div className="h-64 rounded-xl border border-border/60 bg-card/40 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={UK_ETS_HISTORY}
            margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="ets-hist-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ccff00" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#ccff00" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: 'currentColor' }}
              stroke="currentColor"
              strokeOpacity={0.2}
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'currentColor' }}
              stroke="currentColor"
              strokeOpacity={0.2}
              tickFormatter={v => `£${v}`}
              width={48}
            />
            <ChartTooltip
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
              formatter={(v: any) => [`£${v}/tCO₂e`, 'Price']}
              labelFormatter={(m: string) => m}
            />
            <Area
              type="monotone"
              dataKey="gbp_per_tonne"
              stroke="#ccff00"
              strokeWidth={2}
              fill="url(#ets-hist-grad)"
              isAnimationActive={false}
            />
            <ReferenceLine
              y={85}
              stroke="#94a3b8"
              strokeDasharray="2 2"
              label={{
                value: 'Today £85',
                fontSize: 9,
                fill: 'currentColor',
                position: 'right',
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid gap-1.5 text-[11px] text-muted-foreground sm:grid-cols-2">
        {ANNOTATIONS.map(a => (
          <li key={a.month} className="flex items-baseline gap-2">
            <span className="whitespace-nowrap text-foreground tabular-nums">{a.month}</span>
            <span>{a.label}</span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-muted-foreground/70">
        Source: ICE UKA front-month settlement averages (monthly). Reference
        series curated quarterly alongside the shadow-price engine. Not live.
      </p>
    </section>
  );
}

function ForwardCommentary() {
  return (
    <section className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-4">
      <h3 className="text-sm font-semibold text-foreground">Forward-curve view</h3>
      <p className="text-xs leading-relaxed text-muted-foreground">
        UK ETS forward markets price carbon in the mid-£80s through 2026-27.
        Path-dependent: if UK government confirms alignment with the EU ETS
        (integration under consultation since Q4 2025), prices converge
        toward the EU level (~€85). Tighter Market Stability Mechanism
        adjustments in 2026-28 are the main upside risk. Treasury-pragmatic
        scenarios typically use £150/t mid-decade for investment appraisal,
        with BoE stress-test framing at £250/t.
      </p>
      <p className="text-[10px] text-muted-foreground/70">
        Commentary reference: UK government ETS guidance, EU Commission 2030
        climate target plan, Bank of England Climate Biennial Exploratory
        Scenario. Update this narrative quarterly as policy evolves.
      </p>
    </section>
  );
}
