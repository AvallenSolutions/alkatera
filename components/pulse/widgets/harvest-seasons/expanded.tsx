'use client';

import { useCallback } from 'react';
import { useRegisterDrillSlot, type DrillSlotRenderer } from '@/lib/pulse/MetricDrillContext';
import { HarvestSeasonsWidget } from '@/components/pulse/widgets/HarvestSeasonsWidget';

export function HarvestSeasonsExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(() => <HarvestSeasonsWidget />, []);
  useRegisterDrillSlot({
    id: 'harvest-seasons-expanded',
    title: 'Per-crop calendar',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'harvest-seasons',
    render: renderer,
  });
  return null;
}
