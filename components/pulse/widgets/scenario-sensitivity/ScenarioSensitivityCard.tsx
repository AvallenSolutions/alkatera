'use client';

/**
 * Pulse -- Scenario sensitivity, compact card.
 *
 * Headline: £ per £10 change in carbon price (the universal treasurer soundbite).
 * Supporting: four reference-scenario pips on a horizontal scale.
 * Click opens the drill overlay for the full scenario analysis.
 */

import { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';
import { cn } from '@/lib/utils';

interface Scenario {
  id: string;
  label: string;
  price_per_tonne_gbp: number;
  annual_cost_gbp: number;
  is_current: boolean;
}

interface ApiPayload {
  annual_tonnes_co2e: number;
  current_price_gbp_per_tonne: number;
  sensitivity_gbp_per_10_per_tonne: number;
  scenarios: Scenario[];
}

export function ScenarioSensitivityCard() {
  const { currentOrganization } = useOrganization();
  const { openDrill } = useWidgetDrill();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/pulse/scenario-sensitivity?organization_id=${currentOrganization.id}`,
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

  return (
    <PulseCard
      icon={Gauge}
      label="Carbon price sensitivity"
      headline={
        data
          ? `±${formatGbp(data.sensitivity_gbp_per_10_per_tonne)}`
          : '—'
      }
      sub="annual bill change per £10/tCO₂e move"
      footprint="2x1"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'scenario-sensitivity' })}
      footer={
        data
          ? `${data.annual_tonnes_co2e.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO₂e at £${data.current_price_gbp_per_tonne}/t today`
          : undefined
      }
    >
      {data && data.scenarios.length > 0 ? (
        <ScenarioPips scenarios={data.scenarios} />
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground/50">
          No data yet
        </div>
      )}
    </PulseCard>
  );
}

function ScenarioPips({ scenarios }: { scenarios: Scenario[] }) {
  // Map price to 0-100% along a £0-£300 axis.
  const max = 300;
  return (
    <div className="relative flex h-full w-full items-center">
      {/* Axis line */}
      <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border/50" />
      {/* Ticks */}
      {[0, 100, 200, 300].map(v => (
        <div
          key={v}
          className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-border/60"
          style={{ left: `${(v / max) * 100}%` }}
        />
      ))}
      {/* Scenario pips */}
      {scenarios.map(s => {
        const leftPct = Math.min(100, (s.price_per_tonne_gbp / max) * 100);
        return (
          <div
            key={s.id}
            className={cn(
              'absolute flex -translate-x-1/2 flex-col items-center',
              s.is_current ? 'top-2' : 'top-1/2 -translate-y-1/2',
            )}
            style={{ left: `${leftPct}%` }}
            title={`${s.label}: £${s.price_per_tonne_gbp}/t = ${formatGbp(s.annual_cost_gbp)}/yr`}
          >
            <div
              className={cn(
                'h-3 w-3 rounded-full border-2 border-background',
                s.is_current
                  ? 'bg-[#ccff00]'
                  : s.id === 'stress'
                    ? 'bg-red-500'
                    : 'bg-slate-400',
              )}
            />
            <span
              className={cn(
                'mt-0.5 text-[9px] font-medium tabular-nums',
                s.is_current ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              £{s.price_per_tonne_gbp}
            </span>
          </div>
        );
      })}
      {/* Axis labels */}
      <div className="absolute inset-x-0 -bottom-1 flex justify-between text-[9px] text-muted-foreground/60">
        <span>£0/t</span>
        <span>£300/t</span>
      </div>
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
