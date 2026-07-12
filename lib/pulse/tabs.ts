// Pulse -- themed section definitions for the default (curated) experience.
//
// One scrolling paper: the statement answers "are we on track?" at the top;
// Performance, Operations and Plan follow as quiet sections, grouped by the
// question they answer. Widgets render through the same registry/renderer
// machinery as the Customise grid, so drill-downs and explainers carry over.
//
// Money deliberately has no section: /pulse/financial/ is the one money
// surface (the statement's cost figure links straight to it).
//
// Widgets deliberately NOT in any section (still in the registry, the
// Customise grid, and reachable via ?drill=): live-activity, harvest-seasons,
// insight-card (folded into the insight line under the statement),
// alerts-inbox card (folded into the statement's attention count),
// live-metrics-strip (replaced by the statement figures), ask-rosa (the
// app-wide ink band owns asking Rosa), and the money four
// (financial-footprint, top-cost-drivers, regulatory-exposure,
// scenario-sensitivity), which live on /pulse/financial/.

import type { WidgetId } from './widget-registry';

export type PulseTabId = 'overview' | 'performance' | 'operations' | 'plan';

export interface PulseTabMeta {
  id: PulseTabId;
  label: string;
  /** One line under the section eyebrow explaining what it answers. */
  blurb: string;
  /** Grid widgets rendered in this section (Overview composes its own parts). */
  widgets: WidgetId[];
}

export const PULSE_TABS: Record<PulseTabId, PulseTabMeta> = {
  overview: {
    id: 'overview',
    label: 'Overview',
    blurb: 'Are we on track, what is it costing, and what needs attention.',
    widgets: [],
  },
  performance: {
    id: 'performance',
    label: 'Performance',
    blurb: 'Progress towards your targets, budgets and peers.',
    widgets: ['target-trajectory', 'carbon-budgets', 'peer-benchmark', 'csrd-gaps'],
  },
  operations: {
    id: 'operations',
    label: 'Operations',
    blurb: 'Where the impact comes from: sites, suppliers and products.',
    widgets: ['facility-impact', 'supplier-hotspots', 'product-env-cost', 'grid-carbon', 'energy-timing'],
  },
  plan: {
    id: 'plan',
    label: 'Plan',
    blurb: 'The cheapest ways to cut carbon, and the actions behind your targets.',
    widgets: ['macc', 'what-if'],
  },
};

export const PULSE_TAB_ORDER: PulseTabId[] = ['overview', 'performance', 'operations', 'plan'];
