'use client';

/**
 * Pulse -- Facility impact, compact card.
 *
 * Headline: total trailing-12m Scope 1+2 emissions across all facilities.
 * Supporting: monthly stacked area of org-aggregate tCO₂e, broken into
 * electricity / gas / other Scope 1+2.
 * Click opens the drill overlay with the full per-facility / per-utility
 * breakdown.
 */

import { useEffect, useState } from 'react';
import { Factory } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';

interface MonthBucket {
  month: string;
  total_tco2e: number;
  electricity_tco2e_tariff: number;
  gas_tco2e: number;
  other_scope12_tco2e: number;
}

interface FacilitySummary {
  id: string;
  name: string;
}

interface ApiPayload {
  months: MonthBucket[];
  facilities: FacilitySummary[];
  summary?: {
    facilities_count?: number;
    annual_tco2e_tariff?: number;
    annual_tco2e_live?: number;
  };
}

export function FacilityImpactCard() {
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
          `/api/pulse/facility-impact?organization_id=${currentOrganization.id}`,
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

  // Prefer the pre-computed annual figure; fall back to summing the months.
  const annualTonnes =
    data?.summary?.annual_tco2e_tariff ??
    (data?.months ?? []).reduce((s, m) => s + Number(m.total_tco2e ?? 0), 0);
  const facilityCount = data?.summary?.facilities_count ?? data?.facilities.length ?? 0;

  return (
    <PulseCard
      icon={Factory}
      label="Facility impact"
      headline={
        annualTonnes > 0
          ? `${annualTonnes.toLocaleString('en-GB', { maximumFractionDigits: 0 })} t`
          : '—'
      }
      sub="Scope 1+2 across facilities, trailing 12m"
      footprint="2x2"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'facility-impact' })}
      footer={
        facilityCount > 0
          ? `${facilityCount} facilit${facilityCount === 1 ? 'y' : 'ies'} tracked`
          : undefined
      }
    >
      {data && data.months.length > 1 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.months} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="fic-elec" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ccff00" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#ccff00" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fic-gas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fic-other" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="electricity_tco2e_tariff"
              stackId="1"
              stroke="#ccff00"
              fill="url(#fic-elec)"
              strokeWidth={1.5}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="gas_tco2e"
              stackId="1"
              stroke="#38bdf8"
              fill="url(#fic-gas)"
              strokeWidth={1.5}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="other_scope12_tco2e"
              stackId="1"
              stroke="#f59e0b"
              fill="url(#fic-other)"
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground/50">
          Trend builds with data
        </div>
      )}
    </PulseCard>
  );
}
