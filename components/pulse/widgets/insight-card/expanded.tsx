'use client';

import { useCallback } from 'react';
import { useRegisterDrillSlot, type DrillSlotRenderer } from '@/lib/pulse/MetricDrillContext';
import { InsightCard } from '@/components/pulse/widgets/InsightCard';

export function InsightCardExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(() => <InsightCard />, []);
  useRegisterDrillSlot({
    id: 'insight-card-expanded',
    title: "Today's brief",
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'insight-card',
    render: renderer,
  });
  return null;
}
