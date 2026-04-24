'use client';

import { useCallback } from 'react';
import { useRegisterDrillSlot, type DrillSlotRenderer } from '@/lib/pulse/MetricDrillContext';
import { AlertsInbox } from '@/components/pulse/widgets/AlertsInbox';

export function AlertsInboxExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(() => <AlertsInbox />, []);
  useRegisterDrillSlot({
    id: 'alerts-inbox-expanded',
    title: 'All open alerts',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'alerts-inbox',
    render: renderer,
  });
  return null;
}
