'use client';

/**
 * Pulse -- Carbon budgets, compact card.
 *
 * Headline: % variance against the worst budget this period.
 * Supporting: traffic-light ring + on/over counts.
 */

import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';
import { cn } from '@/lib/utils';

interface BudgetRow {
  id: string;
  scope: string;
  period: string;
  budget_tco2e: number;
  actual_tco2e: number;
  variance_pct: number;
  status: 'on_track' | 'at_risk' | 'over';
}

interface ApiPayload {
  budgets: BudgetRow[];
}

export function CarbonBudgetsCard() {
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
          `/api/pulse/carbon-budgets?organization_id=${currentOrganization.id}`,
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

  const worst =
    data?.budgets.length
      ? [...data.budgets].sort((a, b) => b.variance_pct - a.variance_pct)[0]
      : null;
  const over = data?.budgets.filter(b => b.status === 'over').length ?? 0;
  const atRisk = data?.budgets.filter(b => b.status === 'at_risk').length ?? 0;
  const onTrack = data?.budgets.filter(b => b.status === 'on_track').length ?? 0;

  const status = worst
    ? worst.status === 'over'
      ? ({ tone: 'bad' as const, label: 'Over' })
      : worst.status === 'at_risk'
        ? ({ tone: 'warn' as const, label: 'At risk' })
        : ({ tone: 'good' as const, label: 'On track' })
    : null;

  const headline = worst
    ? `${worst.variance_pct >= 0 ? '+' : ''}${worst.variance_pct.toFixed(0)}%`
    : '—';

  return (
    <PulseCard
      icon={Target}
      label="Carbon budgets"
      headline={headline}
      sub={worst ? `${worst.scope.replace('_', ' ')} · ${worst.period}` : 'No budgets set'}
      status={status}
      footprint="2x1"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'carbon-budgets' })}
      footer={
        data && data.budgets.length > 0
          ? `${onTrack} on track · ${atRisk} at risk · ${over} over`
          : 'Click to set a budget'
      }
    >
      {data && data.budgets.length > 0 ? (
        <div className="flex h-full flex-col justify-center gap-2">
          <TrafficLightRow onTrack={onTrack} atRisk={atRisk} over={over} />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground/50">
          No budgets yet
        </div>
      )}
    </PulseCard>
  );
}

function TrafficLightRow({
  onTrack,
  atRisk,
  over,
}: {
  onTrack: number;
  atRisk: number;
  over: number;
}) {
  const total = onTrack + atRisk + over;
  if (total === 0) return null;
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-muted">
      {onTrack > 0 && (
        <div
          className="bg-emerald-500"
          style={{ width: `${(onTrack / total) * 100}%` }}
          title={`${onTrack} on track`}
        />
      )}
      {atRisk > 0 && (
        <div
          className="bg-amber-500"
          style={{ width: `${(atRisk / total) * 100}%` }}
          title={`${atRisk} at risk`}
        />
      )}
      {over > 0 && (
        <div
          className="bg-red-500"
          style={{ width: `${(over / total) * 100}%` }}
          title={`${over} over`}
        />
      )}
    </div>
  );
}
