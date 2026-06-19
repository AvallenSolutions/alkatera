'use client';

/**
 * Pulse -- Soil carbon trajectory, compact card.
 *
 * Headline: total measured annual removal (t CO2e/yr) across fields with a
 * measured stock-change. Supporting: per-field direction, change and confidence.
 */

import { useEffect, useState } from 'react';
import { Sprout, TrendingUp, TrendingDown } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { PulseCard } from '@/components/pulse/PulseCard';

interface ChangeShape {
  methodology: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  is_loss: boolean;
  annual_kg_co2e_per_ha: number;
  baseline_stock_tc_ha: number | null;
  latest_stock_tc_ha: number | null;
}

interface LandUnit {
  land_unit_type: string;
  land_unit_id: string;
  name: string;
  hectares: number | null;
  series: Array<{ date: string; stock_tc_ha: number }>;
  change: ChangeShape;
}

interface ApiPayload {
  ok: boolean;
  landUnits: LandUnit[];
  summary: {
    totalLandUnits: number;
    measuredUnits: number;
    totalAnnualRemovalKgCo2e: number;
  };
}

const CONFIDENCE_DOT: Record<string, string> = {
  HIGH: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  LOW: 'bg-red-500',
};

export function SoilCarbonTrajectoryCard() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/pulse/soil-carbon-trajectory?organization_id=${currentOrganization.id}`,
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

  const measured = data?.landUnits.filter(
    (u) => u.change.methodology === 'measured_stock_change',
  ) ?? [];
  const anyLoss = measured.some((u) => u.change.is_loss);
  const tonnesPerYear = (data?.summary.totalAnnualRemovalKgCo2e ?? 0) / 1000;

  const headline = measured.length
    ? `${tonnesPerYear.toFixed(1)} t`
    : '—';

  const status = measured.length
    ? anyLoss
      ? ({ tone: 'warn' as const, label: 'Declining' })
      : ({ tone: 'good' as const, label: 'Sequestering' })
    : null;

  return (
    <PulseCard
      icon={Sprout}
      label="Soil carbon trajectory"
      headline={headline}
      sub={measured.length ? 'CO2e removed per year (measured)' : 'No measured trajectory yet'}
      status={status}
      footprint="2x2"
      loading={loading}
      footer={
        data
          ? `${data.summary.measuredUnits} of ${data.summary.totalLandUnits} fields measured over time`
          : undefined
      }
    >
      {measured.length > 0 ? (
        <div className="flex h-full flex-col gap-2 overflow-hidden">
          {measured.slice(0, 4).map((u) => {
            const c = u.change;
            const delta =
              (c.latest_stock_tc_ha ?? 0) - (c.baseline_stock_tc_ha ?? 0);
            return (
              <div
                key={`${u.land_unit_type}:${u.land_unit_id}`}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      c.confidence ? CONFIDENCE_DOT[c.confidence] : 'bg-muted-foreground'
                    }`}
                    title={`${c.confidence ?? ''} confidence`}
                  />
                  <span className="truncate text-foreground">{u.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1 font-medium">
                  {c.is_loss ? (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  ) : (
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                  )}
                  <span className={c.is_loss ? 'text-red-500' : 'text-emerald-600'}>
                    {delta >= 0 ? '+' : ''}
                    {delta.toFixed(1)} tC/ha
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center px-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground/50">
          Add repeated soil samples to see your trajectory
        </div>
      )}
    </PulseCard>
  );
}
