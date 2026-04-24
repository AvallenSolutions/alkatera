'use client';

import { useCallback } from 'react';
import { useRegisterDrillSlot, type DrillSlotRenderer } from '@/lib/pulse/MetricDrillContext';
import { ProductEnvironmentalCostWidget } from '@/components/pulse/widgets/ProductEnvironmentalCostWidget';

export function ProductEnvCostExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(() => <ProductEnvironmentalCostWidget />, []);
  useRegisterDrillSlot({
    id: 'product-env-cost-expanded',
    title: 'Per-SKU environmental cost',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'product-env-cost',
    render: renderer,
  });
  return null;
}
