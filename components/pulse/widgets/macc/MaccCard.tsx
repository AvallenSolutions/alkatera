'use client';

/**
 * Pulse -- MACC, compact card.
 *
 * Headline: total tCO₂e abatable at ≤£0/t (i.e. interventions that pay back).
 * Supporting: top-6 levers as tiny horizontal bars coloured by sign.
 */

import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';
import { cn } from '@/lib/utils';

interface Lever {
  id: string;
  label: string;
  annual_tonnes_abated: number;
  levelised_cost_gbp_per_tonne: number;
}

interface ApiPayload {
  total_tonnes_abatable: number;
  levers: Lever[];
}

export function MaccCard() {
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
        const res = await fetch(`/api/pulse/macc?organization_id=${currentOrganization.id}`);
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

  const payingBack = data?.levers.filter(l => l.levelised_cost_gbp_per_tonne < 0) ?? [];
  const tonnesPayingBack = payingBack.reduce((s, l) => s + l.annual_tonnes_abated, 0);
  const topLevers = data?.levers.slice(0, 6) ?? [];
  const maxAbs = topLevers.length
    ? Math.max(...topLevers.map(l => Math.abs(l.levelised_cost_gbp_per_tonne)), 50)
    : 50;

  return (
    <PulseCard
      icon={TrendingUp}
      label="Abatement potential"
      headline={
        data
          ? `${Math.round(tonnesPayingBack).toLocaleString('en-GB')} tCO₂e`
          : '—'
      }
      sub="paying back at ≤£0/t"
      footprint="2x2"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'macc' })}
      footer={
        data
          ? `${Math.round(data.total_tonnes_abatable).toLocaleString('en-GB')} tCO₂e total addressable`
          : undefined
      }
    >
      {topLevers.length > 0 ? (
        <ul className="flex h-full flex-col justify-center space-y-1.5">
          {topLevers.map(l => {
            const pct = (Math.abs(l.levelised_cost_gbp_per_tonne) / maxAbs) * 100;
            const neg = l.levelised_cost_gbp_per_tonne < 0;
            return (
              <li key={l.id} className="flex items-center gap-2 text-[10px]">
                <span className="w-28 truncate text-muted-foreground">{l.label}</span>
                <div className="relative flex h-2 flex-1 items-center">
                  <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                  <div
                    className={cn('absolute h-full rounded-sm', neg ? 'bg-emerald-500' : 'bg-red-500')}
                    style={{
                      left: neg ? `${50 - pct / 2}%` : '50%',
                      width: `${pct / 2}%`,
                    }}
                  />
                </div>
                <span
                  className={cn(
                    'w-12 text-right tabular-nums',
                    neg ? 'text-emerald-500' : 'text-foreground',
                  )}
                >
                  {neg ? '-' : ''}£{Math.round(Math.abs(l.levelised_cost_gbp_per_tonne))}/t
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground/50">
          Populates with activity data
        </div>
      )}
    </PulseCard>
  );
}
