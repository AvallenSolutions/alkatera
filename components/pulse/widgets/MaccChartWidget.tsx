'use client';

/**
 * Pulse -- Marginal Abatement Cost Curve (MACC).
 *
 * The classic sustainability-strategy chart, finally done well. Each lever is
 * a block:
 *   - Width = annual tonnes CO2e abated at 100% adoption
 *   - Height = levelised £/tCO2e cost (negative = saves money)
 *
 * Blocks are sorted left-to-right cheapest-first. The area under the x-axis
 * (below zero) is money-making abatement; the area above is net-cost.
 *
 * Click a block to see capex, annual saving, NPV and simple payback.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Lever {
  id: string;
  label: string;
  description: string;
  annual_tonnes_abated: number;
  capex_gbp: number;
  annual_utility_saving_gbp: number;
  lifetime_years: number;
  levelised_cost_gbp_per_tonne: number;
  npv_gbp: number;
  simple_payback_years: number | null;
}

interface ApiPayload {
  ok: boolean;
  total_tonnes_abatable: number;
  discount_rate: number;
  levers: Lever[];
  skipped_levers: Array<{ id: string; label: string }>;
}

export function MaccChartWidget() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/pulse/macc?organization_id=${currentOrganization.id}`,
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
  }, [currentOrganization?.id]);

  const selected = useMemo(
    () => data?.levers.find(l => l.id === selectedId) ?? null,
    [data, selectedId],
  );

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-4 p-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-[#ccff00]" />
              Marginal abatement cost curve
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-foreground">
              Where to spend £1 for the biggest tCO₂e bang
            </h3>
          </div>
        </header>

        {loading && (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && data && data.levers.length === 0 && (
          <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            MACC populates once you have activity in electricity, gas, fuel or
            waste. Log your facility activity and come back.
          </p>
        )}

        {!loading && data && data.levers.length > 0 && (
          <>
            <MaccChart
              levers={data.levers}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />

            {selected ? (
              <SelectedLeverDetail lever={selected} />
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Click any bar to see capex, annual saving, NPV and payback.
                Interventions below £0/tCO₂e pay back on their own.
              </p>
            )}

            <p className="text-[10px] text-muted-foreground/70">
              Total abatement opportunity:{' '}
              <span className="font-medium text-foreground">
                {data.total_tonnes_abatable.toLocaleString('en-GB', {
                  maximumFractionDigits: 0,
                })}{' '}
                tCO₂e / yr
              </span>
              . Discount rate {Math.round(data.discount_rate * 100)}%. Costs are
              reference figures; use What-if and your own quotes before capex
              decisions.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MaccChart({
  levers,
  selectedId,
  onSelect,
}: {
  levers: Lever[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Compute the X-scale (cumulative tonnes) and Y-scale (symmetric around 0).
  const totalTonnes = levers.reduce((s, l) => s + l.annual_tonnes_abated, 0);
  const maxCost = Math.max(
    ...levers.map(l => Math.abs(l.levelised_cost_gbp_per_tonne)),
    50,
  );

  // SVG canvas.
  const width = 640;
  const height = 260;
  const padL = 48;
  const padR = 8;
  const padT = 16;
  const padB = 32;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const yZero = padT + plotH / 2; // zero line in the middle

  let cumX = 0;
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        style={{ minWidth: '420px' }}
        role="img"
        aria-label="Marginal abatement cost curve"
      >
        {/* Zero line */}
        <line
          x1={padL}
          x2={width - padR}
          y1={yZero}
          y2={yZero}
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeDasharray="2 2"
        />
        {/* Y-axis ticks */}
        {[-maxCost, -maxCost / 2, 0, maxCost / 2, maxCost].map(v => {
          const y = yZero - (v / maxCost) * (plotH / 2);
          return (
            <g key={v}>
              <line
                x1={padL - 4}
                x2={padL}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.3}
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.7}
              >
                {v === 0 ? '£0' : v > 0 ? `+£${Math.round(v)}` : `-£${Math.round(Math.abs(v))}`}
              </text>
            </g>
          );
        })}
        {/* X-axis */}
        <line
          x1={padL}
          x2={width - padR}
          y1={height - padB}
          y2={height - padB}
          stroke="currentColor"
          strokeOpacity={0.3}
        />
        <text
          x={padL}
          y={height - padB + 18}
          fontSize={9}
          fill="currentColor"
          fillOpacity={0.7}
        >
          0 tCO₂e/yr
        </text>
        <text
          x={width - padR}
          y={height - padB + 18}
          textAnchor="end"
          fontSize={9}
          fill="currentColor"
          fillOpacity={0.7}
        >
          {Math.round(totalTonnes).toLocaleString('en-GB')} tCO₂e/yr
        </text>
        <text
          x={width / 2}
          y={height - 4}
          textAnchor="middle"
          fontSize={10}
          fill="currentColor"
          fillOpacity={0.8}
        >
          Cumulative abatement potential
        </text>

        {/* Bars */}
        {levers.map(l => {
          const w = (l.annual_tonnes_abated / totalTonnes) * plotW;
          const x = padL + (cumX / totalTonnes) * plotW;
          cumX += l.annual_tonnes_abated;
          const cost = l.levelised_cost_gbp_per_tonne;
          const barHeight = (Math.abs(cost) / maxCost) * (plotH / 2);
          const y = cost >= 0 ? yZero - barHeight : yZero;
          const isSelected = selectedId === l.id;
          const fill =
            cost < 0
              ? isSelected
                ? '#10b981'
                : '#10b98188'
              : isSelected
                ? '#ccff00'
                : '#ccff0088';
          return (
            <g
              key={l.id}
              className="cursor-pointer"
              onClick={() => onSelect(l.id)}
            >
              <rect
                x={x + 1}
                y={y}
                width={Math.max(1, w - 2)}
                height={barHeight}
                fill={fill}
                stroke={isSelected ? '#fff' : 'transparent'}
                strokeWidth={isSelected ? 1 : 0}
              >
                <title>
                  {l.label}: {Math.round(l.annual_tonnes_abated)} tCO₂e at £
                  {Math.round(cost)}/t
                </title>
              </rect>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SelectedLeverDetail({ lever }: { lever: Lever }) {
  const cost = lever.levelised_cost_gbp_per_tonne;
  const tone = cost < 0 ? 'text-emerald-500' : 'text-foreground';
  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-3">
      <p className="text-sm font-semibold text-foreground">{lever.label}</p>
      <p className="text-[11px] text-muted-foreground">{lever.description}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Metric label="Abates" value={`${Math.round(lever.annual_tonnes_abated)} tCO₂e/yr`} />
        <Metric
          label="Levelised cost"
          value={cost < 0 ? `-£${Math.abs(Math.round(cost))}/t` : `£${Math.round(cost)}/t`}
          tone={tone}
        />
        <Metric
          label="Capex"
          value={lever.capex_gbp > 0 ? formatGbp(lever.capex_gbp) : '—'}
        />
        <Metric
          label="Simple payback"
          value={
            lever.simple_payback_years === null
              ? 'N/A'
              : lever.simple_payback_years === 0
                ? 'Instant'
                : `${lever.simple_payback_years.toFixed(1)} yrs`
          }
        />
      </dl>
      <p className="mt-2 text-[11px] text-muted-foreground">
        NPV over {lever.lifetime_years} yrs:{' '}
        <span className={cn('font-medium', lever.npv_gbp >= 0 ? 'text-emerald-500' : 'text-red-500')}>
          {formatGbp(lever.npv_gbp)}
        </span>
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={cn('text-sm font-semibold tabular-nums', tone ?? 'text-foreground')}>
        {value}
      </dd>
    </div>
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
    maximumFractionDigits: 0,
  });
}
