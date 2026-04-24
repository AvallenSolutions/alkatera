'use client';

import { MetricCard } from '@/components/pulse/widgets/MetricCard';
import { ALL_METRIC_KEYS } from '@/lib/pulse/metric-keys';

/**
 * Pulse — composite widget that renders the four MetricCards as a single
 * grid item so users don't have to position them individually.
 *
 * If we ever want individual MetricCards to be standalone draggable widgets,
 * register them in widget-registry.ts and remove this composite.
 */
export function LiveMetricsStrip() {
  return (
    <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-4">
      {ALL_METRIC_KEYS.map(key => (
        <MetricCard key={key} metricKey={key} />
      ))}
    </div>
  );
}
