'use client';

/**
 * Pulse U5 -- Supplier hotspots expanded view.
 *
 * Composes:
 *   1. Rosa commentary block (top-5 concentration, engagement suggestion)
 *   2. The existing rich SupplierHotspotsWidget (full list + category splits)
 */

import { useCallback, useEffect, useState } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import {
  useRegisterDrillSlot,
  type DrillSlotRenderer,
} from '@/lib/pulse/MetricDrillContext';
import { SupplierHotspotsWidget } from '@/components/pulse/widgets/SupplierHotspotsWidget';
import { RosaCommentaryBlock } from '@/components/pulse/RosaCommentaryBlock';

interface Payload {
  totals: {
    supplier_attributed_t_co2e: number;
    supplier_coverage_pct: number;
    product_count: number;
  };
  by_supplier: Array<{
    supplier_name: string;
    total_t_co2e: number;
    pct_of_attributed: number;
  }>;
  by_category: Array<{ category: string; pct_of_total: number }>;
}

export function SupplierHotspotsExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(
    () => <SupplierHotspotsExpanded />,
    [],
  );
  useRegisterDrillSlot({
    id: 'supplier-hotspots-expanded',
    title: 'Supplier detail + commentary',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'supplier-hotspots',
    render: renderer,
  });
  return null;
}

function SupplierHotspotsExpanded() {
  const { currentOrganization } = useOrganization();
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/pulse/supplier-hotspots?organization_id=${currentOrganization.id}`,
      );
      const json = await res.json();
      if (!cancelled && res.ok) setPayload(json as Payload);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  const context = payload
    ? {
        supplier_attributed_t_co2e: Math.round(
          payload.totals.supplier_attributed_t_co2e,
        ),
        supplier_coverage_pct: Math.round(payload.totals.supplier_coverage_pct),
        top_suppliers: payload.by_supplier.slice(0, 5).map(s => ({
          name: s.supplier_name,
          tco2e: Math.round(s.total_t_co2e * 10) / 10,
          pct_of_attributed: Math.round(s.pct_of_attributed),
        })),
        category_mix: (payload.by_category ?? []).map(c => ({
          category: c.category,
          pct: Math.round(c.pct_of_total),
        })),
      }
    : null;

  return (
    <div className="space-y-6">
      {context && context.top_suppliers.length > 0 && (
        <RosaCommentaryBlock widgetId="supplier-hotspots" context={context} />
      )}
      <SupplierHotspotsWidget />
    </div>
  );
}
