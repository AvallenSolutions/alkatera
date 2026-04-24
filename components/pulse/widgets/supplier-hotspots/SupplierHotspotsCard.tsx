'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';

interface SupplierRow {
  supplier_name: string;
  total_t_co2e: number;
  pct_of_attributed: number;
}

interface ApiPayload {
  totals: { supplier_coverage_pct: number; supplier_attributed_t_co2e: number };
  by_supplier: SupplierRow[];
}

export function SupplierHotspotsCard() {
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
          `/api/pulse/supplier-hotspots?organization_id=${currentOrganization.id}`,
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

  const top = data?.by_supplier?.[0];
  const top5Pct = data?.by_supplier.slice(0, 5).reduce((s, r) => s + r.pct_of_attributed, 0) ?? 0;
  const status =
    top5Pct >= 80
      ? ({ tone: 'bad' as const, label: 'Concentrated' })
      : top5Pct >= 50
        ? ({ tone: 'warn' as const, label: 'Moderate' })
        : top5Pct > 0
          ? ({ tone: 'good' as const, label: 'Diverse' })
          : null;

  return (
    <PulseCard
      icon={Users}
      label="Supplier hotspots"
      headline={top ? `${Math.round(top.pct_of_attributed)}%` : '—'}
      sub={top ? top.supplier_name : 'No supplier data'}
      status={status}
      footprint="2x1"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'supplier-hotspots' })}
      footer={
        data && data.by_supplier.length > 0
          ? `Top 5 account for ${Math.round(top5Pct)}% of attributed Scope 3`
          : undefined
      }
    >
      {data?.by_supplier?.length ? (
        <ul className="flex h-full flex-col justify-center gap-1 text-[10px]">
          {data.by_supplier.slice(0, 5).map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-24 truncate text-muted-foreground">{s.supplier_name}</span>
              <div className="flex-1 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-[#ccff00]" style={{ width: `${Math.min(100, s.pct_of_attributed)}%` }} />
              </div>
              <span className="w-8 text-right tabular-nums text-foreground">{Math.round(s.pct_of_attributed)}%</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground/50">
          Need completed LCAs
        </div>
      )}
    </PulseCard>
  );
}
