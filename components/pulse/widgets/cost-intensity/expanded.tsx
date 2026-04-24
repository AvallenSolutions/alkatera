'use client';

import { useCallback } from 'react';
import {
  useRegisterDrillSlot,
  type DrillSlotRenderer,
} from '@/lib/pulse/MetricDrillContext';
import { CostIntensityCard } from '@/components/pulse/financial/CostIntensityCard';

export function CostIntensityExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(() => <CostIntensityCard />, []);
  useRegisterDrillSlot({
    id: 'cost-intensity-expanded',
    title: 'All intensity ratios',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'cost-intensity',
    render: renderer,
  });
  return null;
}
