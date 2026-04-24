'use client';

import { useCallback } from 'react';
import {
  useRegisterDrillSlot,
  type DrillSlotRenderer,
} from '@/lib/pulse/MetricDrillContext';
import { IssbDisclosureCard } from '@/components/pulse/financial/IssbDisclosureCard';

export function IssbDisclosureExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(() => <IssbDisclosureCard />, []);
  useRegisterDrillSlot({
    id: 'issb-disclosure-expanded',
    title: 'Full disclosure + CSV export',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'issb-disclosure',
    render: renderer,
  });
  return null;
}
