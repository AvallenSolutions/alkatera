'use client';

/**
 * Pulse -- curated persona grid.
 *
 * The default Pulse experience: a small, read-only set of cards tuned to one
 * audience (founder / CFO / sustainability lead). No drag, no resize, no
 * per-user persistence -- just the questions that audience cares about, in a
 * sensible order. The full customisable grid lives behind "Advanced".
 *
 * Uses a static CSS grid (same approach as the Financial page) rather than
 * react-grid-layout. Footprint drives col/row span. Cards open their drill
 * overlay via MetricDrillContext, which PulseShell mounts at shell level.
 */

import { WIDGET_REGISTRY, type Footprint } from '@/lib/pulse/widget-registry';
import { PERSONAS, type Persona } from '@/lib/pulse/layout';
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

export function PulsePersonaGrid({ persona }: { persona: Persona }) {
  const preset = PERSONAS[persona];

  return (
    <div
      className="grid auto-rows-[200px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      role="group"
      aria-label={`${preset.label} cards`}
    >
      {preset.widgets.map(id => {
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
