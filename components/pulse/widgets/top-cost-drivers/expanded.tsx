'use client';

/**
 * Pulse U5 -- Top cost drivers expanded view.
 *
 * Composes:
 *   1. Rosa commentary block (read first, but only after the drivers data
 *      is loaded so Rosa has something concrete to comment on)
 *   2. The existing rich TopCostDriversCard (tabbed line items / category /
 *      facility) from /pulse/financial
 */

import { useCallback, useEffect, useState } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import {
  useRegisterDrillSlot,
  type DrillSlotRenderer,
} from '@/lib/pulse/MetricDrillContext';
import { TopCostDriversCard as FinancialTopCostDrivers } from '@/components/pulse/financial/TopCostDriversCard';
import { RosaCommentaryBlock } from '@/components/pulse/RosaCommentaryBlock';

interface Payload {
  total_gbp: number;
  by_category: Array<{ label: string; gbp: number; pct_of_total: number }>;
  top_line_items: Array<{
    category_label: string;
    facility_name: string;
    gbp: number;
    pct_of_total: number;
  }>;
}

export function TopCostDriversExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(
    () => <TopCostDriversExpanded />,
    [],
  );
  useRegisterDrillSlot({
    id: 'top-cost-drivers-expanded',
    title: 'Cost drivers, all views',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'top-cost-drivers',
    render: renderer,
  });
  return null;
}

function TopCostDriversExpanded() {
  const { currentOrganization } = useOrganization();
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/pulse/cost-drivers?organization_id=${currentOrganization.id}&days=365`,
      );
      const json = await res.json();
      if (!cancelled && res.ok) setPayload(json as Payload);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  // Tight summary for Rosa -- don't send the whole response.
  const context = payload
    ? {
        total_gbp: payload.total_gbp,
        top_line_items: payload.top_line_items.slice(0, 5).map(l => ({
          label: `${l.category_label} at ${l.facility_name}`,
          gbp_per_year: Math.round(l.gbp),
          pct_of_total: Math.round(l.pct_of_total),
        })),
        by_category: payload.by_category.slice(0, 5).map(c => ({
          label: c.label,
          gbp_per_year: Math.round(c.gbp),
          pct_of_total: Math.round(c.pct_of_total),
        })),
      }
    : null;

  return (
    <div className="space-y-6">
      {context && (
        <RosaCommentaryBlock widgetId="top-cost-drivers" context={context} />
      )}
      <FinancialTopCostDrivers />
    </div>
  );
}
