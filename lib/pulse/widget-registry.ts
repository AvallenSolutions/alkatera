/**
 * Pulse -- widget registry.
 *
 * Single source of truth for every widget on /pulse:
 *   - id              stable string used as grid key + persisted in layouts
 *   - label + desc    human-readable metadata
 *   - footprint       size class on the uniform grid: '1x1' | '2x1' | '2x2'
 *   - exempt          optional: widget renders outside the grid (full-width band)
 *
 * Adding a new widget? Append a row here, write the component, and reference
 * it in components/pulse/PulseGrid.tsx renderer map. Layout migration is
 * automatic -- unrecognised entries in a saved layout are ignored, and
 * unknown width/height fields on saved items are overwritten from the
 * current registry footprint on read.
 */

export type WidgetId =
  | 'insight-card'
  | 'live-metrics-strip'
  | 'target-trajectory'
  | 'alerts-inbox'
  | 'grid-carbon'
  | 'peer-benchmark'
  | 'live-activity'
  | 'facility-impact'
  | 'csrd-gaps'
  | 'ask-rosa'
  | 'supplier-hotspots'
  | 'what-if'
  | 'harvest-seasons'
  | 'financial-footprint'
  | 'scenario-sensitivity'
  | 'product-env-cost'
  | 'regulatory-exposure'
  | 'macc'
  | 'carbon-budgets'
  // Financial subpage widgets. Exempt from the main grid but registered so
  // drill-overlay lookups (`?drill=top-cost-drivers`) find a label.
  | 'cost-intensity'
  | 'top-cost-drivers'
  | 'issb-disclosure'
  | 'impact-valuation';

export type Footprint = '1x1' | '2x1' | '2x2';

export interface WidgetMeta {
  id: WidgetId;
  label: string;
  description: string;
  /** Size class on the uniform grid. */
  footprint: Footprint;
  /**
   * When true, widget is rendered as a full-width band by PulseShell instead
   * of placed on the draggable grid. Currently live-metrics-strip and
   * ask-rosa, which don't fit the one-metric-one-card pattern.
   */
  exempt?: boolean;
  /** Phase that introduced this widget -- shown in the "Add widget" sheet. */
  phase: number;
  /**
   * Back-compat: derived width / height / min dimensions for react-grid-layout.
   * Don't set these by hand -- call `footprintToLayout()` instead.
   */
  defaultW: number;
  defaultH: number;
  minW: number;
  minH: number;
}

/**
 * Convert a footprint to react-grid-layout coordinates.
 *
 * PulseGrid uses a 12-col grid at lg, rowHeight=10px, vMargin=12px so each
 * grid-row unit ~= 22px of visible height. A 1x1 card is 200px tall = 9 row
 * units; a 2x2 is 412px = 19 row units. We use 10/20 for cleaner arithmetic
 * and let the fixed-height CSS on PulseCard clip anything over.
 */
export function footprintToLayout(f: Footprint): {
  w: number;
  h: number;
  minW: number;
  minH: number;
} {
  switch (f) {
    case '1x1':
      return { w: 3, h: 10, minW: 3, minH: 10 };
    case '2x1':
      return { w: 6, h: 10, minW: 6, minH: 10 };
    case '2x2':
      return { w: 6, h: 20, minW: 6, minH: 20 };
  }
}

/** Fill in the derived width/height fields from a footprint. */
function withLayout(
  meta: Omit<WidgetMeta, 'defaultW' | 'defaultH' | 'minW' | 'minH'>,
): WidgetMeta {
  const { w, h, minW, minH } = footprintToLayout(meta.footprint);
  return { ...meta, defaultW: w, defaultH: h, minW, minH };
}

// Per-widget specs follow the plan's compact-card table. Exempt widgets keep
// their metadata for the Add-widget sheet but render outside the grid.
export const WIDGET_REGISTRY: Record<WidgetId, WidgetMeta> = {
  'insight-card': withLayout({
    id: 'insight-card',
    label: 'AI insight of the day',
    description: 'Claude-written brief explaining what changed and why.',
    footprint: '2x1',
    phase: 3,
  }),
  'live-metrics-strip': withLayout({
    id: 'live-metrics-strip',
    label: 'Live metrics strip',
    description: 'Headline KPIs with sparklines, deltas and live tickers.',
    footprint: '2x1',
    exempt: true,
    phase: 1,
  }),
  'target-trajectory': withLayout({
    id: 'target-trajectory',
    label: 'Target trajectories',
    description: 'Forecast vs target with on-track / at-risk pill.',
    footprint: '2x1',
    phase: 4,
  }),
  'alerts-inbox': withLayout({
    id: 'alerts-inbox',
    label: 'Alerts inbox',
    description: 'Anomaly detector output. Acknowledge or dismiss.',
    footprint: '1x1',
    phase: 5,
  }),
  'grid-carbon': withLayout({
    id: 'grid-carbon',
    label: 'UK grid carbon',
    description: 'Live g CO₂/kWh + cleanest production window.',
    footprint: '1x1',
    phase: 6,
  }),
  'peer-benchmark': withLayout({
    id: 'peer-benchmark',
    label: 'Peer benchmarks',
    description: 'Anonymised percentile vs your industry segment.',
    footprint: '1x1',
    phase: 7,
  }),
  'live-activity': withLayout({
    id: 'live-activity',
    label: 'Live activity feed',
    description: 'Chronological stream of every live event in the org.',
    footprint: '2x2',
    phase: 2,
  }),
  'facility-impact': withLayout({
    id: 'facility-impact',
    label: 'Facility impact',
    description:
      'Scope 1 & 2 utilities, water and waste over 12 months with live grid-carbon overlay.',
    footprint: '2x2',
    phase: 8,
  }),
  'csrd-gaps': withLayout({
    id: 'csrd-gaps',
    label: 'CSRD readiness',
    description:
      'ESRS disclosure points evaluated against your live data. Each gap has a one-click fix.',
    footprint: '1x1',
    phase: 9,
  }),
  'ask-rosa': withLayout({
    id: 'ask-rosa',
    label: 'Ask Rosa',
    description:
      'Embedded conversational AI with live tool access. Ask anything about your data without leaving the dashboard.',
    footprint: '2x2',
    exempt: true,
    phase: 10,
  }),
  'supplier-hotspots': withLayout({
    id: 'supplier-hotspots',
    label: 'Supplier hotspots',
    description:
      'Top Scope 3 contributors with concentration risk and category split.',
    footprint: '2x1',
    phase: 11,
  }),
  'what-if': withLayout({
    id: 'what-if',
    label: 'What-if playground',
    description:
      'Decarbonisation levers: renewables, heat pumps, HVO. Instant emissions and £-saving impact.',
    footprint: '2x1',
    phase: 12,
  }),
  'harvest-seasons': withLayout({
    id: 'harvest-seasons',
    label: 'Harvest calendar',
    description:
      'Annual harvest windows for your crops. Anticipate seasonal supply and emissions spikes.',
    footprint: '2x1',
    phase: 13,
  }),
  'financial-footprint': withLayout({
    id: 'financial-footprint',
    label: 'Annual financial liability',
    description: 'Environmental cost of the last 12 months with year-on-year delta.',
    footprint: '2x2',
    phase: 14,
  }),
  'scenario-sensitivity': withLayout({
    id: 'scenario-sensitivity',
    label: 'Carbon price sensitivity',
    description:
      'What happens to your annual carbon bill if UK ETS moves.',
    footprint: '2x1',
    phase: 15,
  }),
  'product-env-cost': withLayout({
    id: 'product-env-cost',
    label: 'Environmental cost per unit',
    description:
      'Embedded £/unit for every product with a completed LCA.',
    footprint: '2x1',
    phase: 16,
  }),
  'regulatory-exposure': withLayout({
    id: 'regulatory-exposure',
    label: 'Regulatory exposure',
    description:
      'Annual £ liability under UK ETS, EU CBAM, Plastic Packaging Tax and Packaging EPR.',
    footprint: '2x1',
    phase: 17,
  }),
  macc: withLayout({
    id: 'macc',
    label: 'Abatement cost curve',
    description:
      'Decarbonisation levers plotted by tCO₂e abated vs £/t cost.',
    footprint: '2x2',
    phase: 18,
  }),
  'carbon-budgets': withLayout({
    id: 'carbon-budgets',
    label: 'Carbon budgets',
    description:
      'Monthly, quarterly or annual carbon budgets with traffic-light variance.',
    footprint: '2x1',
    phase: 19,
  }),
  'cost-intensity': withLayout({
    id: 'cost-intensity',
    label: 'Cost intensity',
    description:
      'Environmental £ per £m revenue, per FTE, per unit produced. Financial subpage only.',
    footprint: '2x1',
    exempt: true,
    phase: 14,
  }),
  'top-cost-drivers': withLayout({
    id: 'top-cost-drivers',
    label: 'Top cost drivers',
    description:
      'Ranked line items by £ cost across facilities and categories.',
    footprint: '2x2',
    exempt: true,
    phase: 14,
  }),
  'issb-disclosure': withLayout({
    id: 'issb-disclosure',
    label: 'ISSB / IFRS S2 disclosure',
    description:
      'Auto-populated climate-related financial disclosure.',
    footprint: '1x1',
    exempt: true,
    phase: 14,
  }),
  'impact-valuation': withLayout({
    id: 'impact-valuation',
    label: 'Impact valuation',
    description:
      'Monetised four-capital impact (natural, human, social, governance). Full report at /pulse/financial/impact-valuation.',
    footprint: '2x1',
    exempt: true, // rendered inside FinancialGrid, not on the main Pulse grid
    phase: 20,
  }),
};

export const ALL_WIDGET_IDS = Object.keys(WIDGET_REGISTRY) as WidgetId[];

/** Widgets that go in the draggable grid (not exempt). */
export const GRID_WIDGET_IDS = ALL_WIDGET_IDS.filter(id => !WIDGET_REGISTRY[id].exempt);
