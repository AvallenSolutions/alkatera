'use client';

/**
 * Pulse -- Financial footprint, compact card.
 *
 * Headline-only version of the financial footprint widget. Renders inside
 * PulseCard with a single £ figure, YoY chip, and a 12-month sparkline.
 * Clicking opens the full-page drill overlay, where the richer view lives.
 *
 * The existing (tall, detailed) `FinancialFootprintWidget` is still used
 * directly on `/pulse/financial` as a hero block. This card is what appears
 * on the Pulse grid itself.
 */

import { useEffect, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { PoundSterling } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';

interface ApiPayload {
  ok: boolean;
  currency: string;
  trailing_12_months: { total_gbp: number; by_metric: Record<string, number> };
  prior_12_months: { total_gbp: number };
  year_on_year: {
    delta_gbp: number;
    delta_pct: number | null;
    direction: 'improving' | 'worsening' | 'flat';
  };
  monthly: Array<{ month: string; total_gbp: number }>;
}

export function FinancialFootprintCard() {
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
          `/api/pulse/financial-footprint?organization_id=${currentOrganization.id}`,
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

  const headline = data ? formatGbp(data.trailing_12_months.total_gbp) : '—';
  const yoy = data?.year_on_year;
  const status =
    yoy && yoy.delta_pct !== null
      ? {
          tone:
            yoy.direction === 'improving'
              ? ('good' as const)
              : yoy.direction === 'worsening'
                ? ('bad' as const)
                : ('neutral' as const),
          label: `${yoy.delta_pct >= 0 ? '+' : ''}${yoy.delta_pct.toFixed(0)}% YoY`,
        }
      : null;

  return (
    <PulseCard
      icon={PoundSterling}
      label="Annual liability"
      headline={headline}
      sub="Environmental cost, last 12 months"
      status={status}
      footprint="2x2"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'financial-footprint' })}
      footer={
        data
          ? `vs ${formatGbp(data.prior_12_months.total_gbp)} prior 12m`
          : undefined
      }
    >
      {data && data.monthly.length > 1 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data.monthly}
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="ffcard-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ccff00" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#ccff00" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="total_gbp"
              stroke="#ccff00"
              strokeWidth={2}
              fill="url(#ffcard-grad)"
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
