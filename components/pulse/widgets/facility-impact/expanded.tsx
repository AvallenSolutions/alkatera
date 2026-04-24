'use client';

import { useCallback } from 'react';
import {
  useRegisterDrillSlot,
  type DrillSlotRenderer,
} from '@/lib/pulse/MetricDrillContext';
import { FacilityImpactWidget } from '@/components/pulse/widgets/FacilityImpactWidget';

export function FacilityImpactExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(() => <FacilityImpactWidget />, []);
  useRegisterDrillSlot({
    id: 'facility-impact-expanded',
    title: 'Facility impact detail',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'facility-impact',
    render: renderer,
  });
  return null;
}
