'use client';

import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';

interface ProductRow {
  product_name: string;
  gbp_per_unit: number;
  functional_unit: string;
}

interface ApiPayload {
  products: ProductRow[];
  product_count: number;
}

export function ProductEnvCostCard() {
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
          `/api/pulse/product-costs?organization_id=${currentOrganization.id}`,
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

  const avg =
    data?.products?.length
      ? data.products.reduce((s, p) => s + p.gbp_per_unit, 0) / data.products.length
      : null;
  const top = data?.products?.[0];

  return (
    <PulseCard
      icon={Package}
      label="Env cost per unit"
      headline={avg !== null ? formatGbp(avg) : '—'}
      sub={`avg across ${data?.product_count ?? 0} product${data?.product_count === 1 ? '' : 's'}`}
      footprint="2x1"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'product-env-cost' })}
      footer={top ? `Highest: ${top.product_name} at ${formatGbp(top.gbp_per_unit)}/${top.functional_unit}` : 'No LCAs yet'}
    >
      {data?.products?.length ? (
        <Distribution products={data.products} />
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground/50">
          Run an LCA to populate
        </div>
      )}
    </PulseCard>
  );
}

function Distribution({ products }: { products: ProductRow[] }) {
  const max = Math.max(...products.map(p => p.gbp_per_unit), 0.001);
  const sample = products.slice(0, 12);
  return (
    <div className="relative flex h-full items-end gap-px">
      {sample.map((p, i) => {
        const h = (p.gbp_per_unit / max) * 100;
        return (
          <div
            key={i}
            className="flex-1 rounded-t-sm bg-[#ccff00]/80"
            style={{ height: `${h}%` }}
            title={`${p.product_name}: ${formatGbp(p.gbp_per_unit)}/${p.functional_unit}`}
          />
        );
      })}
    </div>
  );
}

function formatGbp(v: number): string {
  if (v < 0.01) return '<£0.01';
  if (v < 10) {
    return v.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 2,
    });
  }
  return v.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });
}
