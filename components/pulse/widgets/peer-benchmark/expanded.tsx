'use client';

import { useCallback } from 'react';
import { useRegisterDrillSlot, type DrillSlotRenderer } from '@/lib/pulse/MetricDrillContext';
import { PeerBenchmarkWidget } from '@/components/pulse/widgets/PeerBenchmarkWidget';

export function PeerBenchmarkExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(() => <PeerBenchmarkWidget />, []);
  useRegisterDrillSlot({
    id: 'peer-benchmark-expanded',
    title: 'Percentile by metric',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'peer-benchmark',
    render: renderer,
  });
  return null;
}
