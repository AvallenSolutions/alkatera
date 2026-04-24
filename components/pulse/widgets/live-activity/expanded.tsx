'use client';

import { useCallback } from 'react';
import { useRegisterDrillSlot, type DrillSlotRenderer } from '@/lib/pulse/MetricDrillContext';
import { LiveActivityFeed } from '@/components/pulse/widgets/LiveActivityFeed';

export function LiveActivityExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(() => <LiveActivityFeed />, []);
  useRegisterDrillSlot({
    id: 'live-activity-expanded',
    title: 'Full activity stream',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'live-activity',
    render: renderer,
  });
  return null;
}
