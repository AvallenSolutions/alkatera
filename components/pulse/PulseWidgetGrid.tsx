'use client';

/**
 * Pulse -- static curated grid.
 *
 * Renders an ordered list of registry widgets on a read-only CSS grid (no
 * drag, no resize, no persistence). Footprint drives col/row span. Cards
 * open their drill overlay via MetricDrillContext, which PulseShell mounts
 * at shell level, so this grid can live anywhere (tab panels, sub-pages).
 */

import { WIDGET_REGISTRY, type Footprint, type WidgetId } from '@/lib/pulse/widget-registry';
import { WIDGET_RENDERERS } from '@/components/pulse/widgetRenderers';
import { WidgetCardProvider } from '@/components/pulse/WidgetCardContext';

/** Footprint -> Tailwind span classes at the `sm`+ breakpoint (4-col grid). */
function spanClass(footprint: Footprint): string {
  switch (footprint) {
    case '1x1':
      return 'sm:col-span-1 sm:row-span-1';
    case '2x1':
      return 'sm:col-span-2 sm:row-span-1';
    case '2x2':
      return 'sm:col-span-2 sm:row-span-2';
  }
}

export function PulseWidgetGrid({ widgets, ariaLabel }: { widgets: WidgetId[]; ariaLabel?: string }) {
  return (
    <div
      className="grid auto-rows-[200px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      role="group"
      aria-label={ariaLabel ?? 'Pulse cards'}
    >
      {widgets.map(id => {
        const meta = WIDGET_REGISTRY[id];
        const renderer = WIDGET_RENDERERS[id];
        if (!meta || !renderer) return null;
        return (
          <div key={id} className={spanClass(meta.footprint)}>
            <WidgetCardProvider id={id}>{renderer()}</WidgetCardProvider>
          </div>
        );
      })}
    </div>
  );
}
