'use client';

/**
 * Pulse -- widget identity context.
 *
 * The grid wrappers (PulseGrid's WidgetCell and PulsePersonaGrid's cell) know
 * which widget id they're rendering; the individual card components do not.
 * Rather than thread a `widgetId` prop through all ~20 card components, the
 * wrappers publish the id here and PulseCard reads it to render the right
 * explainer. Keeps the explainer wiring in one place.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { WidgetId } from '@/lib/pulse/widget-registry';

const WidgetCardContext = createContext<WidgetId | null>(null);

export function WidgetCardProvider({
  id,
  children,
}: {
  id: WidgetId;
  children: ReactNode;
}) {
  return <WidgetCardContext.Provider value={id}>{children}</WidgetCardContext.Provider>;
}

/** The widget id of the card currently rendering, or null outside a grid. */
export function useWidgetCardId(): WidgetId | null {
  return useContext(WidgetCardContext);
}
