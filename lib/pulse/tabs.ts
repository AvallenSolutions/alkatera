// Pulse -- themed tab definitions for the default (curated) experience.
//
// Progressive disclosure: the Overview tab answers "are we on track?" in one
// viewport; everything else is one deliberate click away, grouped by the
// question it answers. Widgets render through the same registry/renderer
// machinery as the Customise grid, so drill-downs and explainers carry over.
//
// Widgets deliberately NOT on any tab (still in the registry, the Customise
// grid, and reachable via ?drill=): live-activity, harvest-seasons,
// insight-card (folded into the Overview insight line), alerts-inbox card
// (folded into the Overview alerts count), live-metrics-strip (replaced by
// the Overview stat strip), ask-rosa full block (replaced by the collapsed
// quick-ask).

import type { WidgetId } from './widget-registry';

export type PulseTabId = 'overview' | 'performance' | 'money' | 'operations' | 'plan';

export interface PulseTabMeta {
  id: PulseTabId;
  label: string;
  /** One line under the tab header explaining what this view answers. */
  blurb: string;
  /** Grid widgets rendered on this tab (Overview composes its own parts). */
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
  money: {
    id: 'money',
    label: 'Money',
    blurb: 'Your impact in pounds: costs, taxes and what-ifs.',
    widgets: ['financial-footprint', 'top-cost-drivers', 'regulatory-exposure', 'scenario-sensitivity'],
  },
  operations: {
    id: 'operations',
    label: 'Operations',
    blurb: 'Where the impact comes from: sites, suppliers and products.',
    widgets: ['facility-impact', 'supplier-hotspots', 'product-env-cost', 'grid-carbon'],
  },
  plan: {
    id: 'plan',
    label: 'Plan',
    blurb: 'The cheapest ways to cut carbon, and the actions behind your targets.',
    widgets: ['macc', 'what-if'],
  },
};

export const PULSE_TAB_ORDER: PulseTabId[] = ['overview', 'performance', 'money', 'operations', 'plan'];
