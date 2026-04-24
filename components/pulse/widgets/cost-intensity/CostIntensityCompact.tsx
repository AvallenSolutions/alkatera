'use client';

/**
 * Pulse -- Cost intensity, compact card.
 *
 * Headline: £ per unit produced (the most directly relatable intensity for
 * operators). Falls back to £/FTE or £/£m revenue if production volume isn't
 * on file. Supporting: three small stats inline.
 *
 * Click opens the full-width expanded card with all three ratios.
 */

import { useEffect, useState } from 'react';
import { Ruler } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';

interface Ratio {
  value: number | null;
  denominator: number;
}

interface ApiPayload {
  trailing_12_months_gbp: number;
  ratios: {
    per_m_revenue: Ratio;
    per_fte: Ratio;
    per_unit: Ratio;
  };
}

export function CostIntensityCompact() {
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
          `/api/pulse/cost-intensity?organization_id=${currentOrganization.id}`,
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

  // Pick the most specific ratio available: unit > FTE > revenue.
  const primary = data
    ? data.ratios.per_unit.value !== null
      ? { label: 'per unit produced', value: data.ratios.per_unit.value, precision: 3 }
      : data.ratios.per_fte.value !== null
        ? { label: 'per employee', value: data.ratios.per_fte.value, precision: 0 }
        : data.ratios.per_m_revenue.value !== null
          ? { label: 'per £m revenue', value: data.ratios.per_m_revenue.value, precision: 0 }
          : null
    : null;

  const headline = primary ? formatGbp(primary.value, primary.precision) : '—';
  const sub = primary ? primary.label : 'Add production or FTE data';

  return (
    <PulseCard
      icon={Ruler}
      label="Cost intensity"
      headline={headline}
      sub={sub}
      footprint="2x1"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'cost-intensity' })}
      footer={
        data
          ? `Total liability: ${formatGbp(data.trailing_12_months_gbp, 0)} trailing 12m`
          : undefined
      }
    >
      {data ? (
        <div className="flex h-full items-center justify-around gap-2 text-center text-[10px]">
          <IntensityPip
            label="/ £m rev"
            value={data.ratios.per_m_revenue.value}
            precision={0}
          />
          <div className="h-6 w-px bg-border/60" />
          <IntensityPip
            label="/ FTE"
            value={data.ratios.per_fte.value}
            precision={0}
          />
          <div className="h-6 w-px bg-border/60" />
          <IntensityPip
            label="/ unit"
            value={data.ratios.per_unit.value}
            precision={3}
          />
        </div>
      ) : null}
    </PulseCard>
  );
}

function IntensityPip({
  label,
  value,
  precision,
}: {
  label: string;
  value: number | null;
  precision: number;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
      <span
        className={`tabular-nums ${value !== null ? 'text-sm font-semibold text-foreground' : 'text-sm text-muted-foreground/60'}`}
      >
        {value !== null ? formatGbp(value, precision) : '—'}
      </span>
      <span className="uppercase tracking-wider text-muted-foreground/80">{label}</span>
    </div>
  );
}

function formatGbp(v: number, precision: number): string {
  const abs = Math.abs(v);
  if (abs >= 100_000) {
    return v.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      notation: 'compact',
      maximumFractionDigits: 1,
    });
  }
  if (abs < 1 && precision >= 2) {
    return v.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: precision,
    });
  }
  return v.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: precision,
  });
}
