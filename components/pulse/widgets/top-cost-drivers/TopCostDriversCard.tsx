'use client';

/**
 * Pulse -- Top cost drivers, compact card.
 *
 * Headline: biggest single line item (category × facility) by £/year.
 * Supporting: top-5 horizontal bars.
 */

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';

interface LineItem {
  category_label: string;
  facility_name: string;
  gbp: number;
  pct_of_total: number;
}

interface ApiPayload {
  total_gbp: number;
  top_line_items: LineItem[];
}

export function TopCostDriversCard() {
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
          `/api/pulse/cost-drivers?organization_id=${currentOrganization.id}&days=365`,
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

  const top = data?.top_line_items[0];
  const top5 = data?.top_line_items.slice(0, 5) ?? [];
  const maxGbp = top5.length ? Math.max(...top5.map(t => t.gbp)) : 1;

  return (
    <PulseCard
      icon={Flame}
      label="Top cost driver"
      headline={top ? formatGbp(top.gbp) : '—'}
      sub={top ? `${top.category_label} · ${top.facility_name}` : 'No data yet'}
      footprint="2x2"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'top-cost-drivers' })}
      footer={
        data && data.total_gbp > 0
          ? `${formatGbp(data.total_gbp)} total across all drivers`
          : undefined
      }
    >
      {top5.length > 0 ? (
        <ul className="flex h-full flex-col justify-center space-y-1.5 pr-1">
          {top5.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-[11px]">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-foreground">
                  {item.category_label}{' '}
                  <span className="text-muted-foreground">· {item.facility_name}</span>
                </p>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-[#ccff00]"
                    style={{ width: `${(item.gbp / maxGbp) * 100}%` }}
                  />
                </div>
              </div>
              <span className="w-14 text-right tabular-nums text-foreground">
                {formatGbp(item.gbp)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground/50">
          No facility activity yet
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
    maximumFractionDigits: 0,
  });
}
