'use client';

import { useCallback } from 'react';
import { useRegisterDrillSlot, type DrillSlotRenderer } from '@/lib/pulse/MetricDrillContext';
import { GridCarbonWidget } from '@/components/pulse/widgets/GridCarbonWidget';

export function GridCarbonExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(() => <GridCarbonWidget />, []);
  useRegisterDrillSlot({
    id: 'grid-carbon-expanded',
    title: 'Forecast + optimal windows',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'grid-carbon',
    render: renderer,
  });
  return null;
}
