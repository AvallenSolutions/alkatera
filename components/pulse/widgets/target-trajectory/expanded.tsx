'use client';

import { useCallback } from 'react';
import {
  useRegisterDrillSlot,
  type DrillSlotRenderer,
} from '@/lib/pulse/MetricDrillContext';
import { TargetTrajectoryWidget } from '@/components/pulse/widgets/TargetTrajectoryWidget';

export function TargetTrajectoryExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(
    () => <TargetTrajectoryWidget />,
    [],
  );
  useRegisterDrillSlot({
    id: 'target-trajectory-expanded',
    title: 'All active targets',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'target-trajectory',
    render: renderer,
  });
  return null;
}
