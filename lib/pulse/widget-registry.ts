/**
 * Pulse -- widget registry.
 *
 * Single source of truth for every widget on /pulse:
 *   - id              stable string used as grid key + persisted in layouts
 *   - label + desc    human-readable metadata
 *   - footprint       size class on the uniform grid: '1x1' | '2x1' | '2x2'
 *   - exempt          optional: widget renders outside the grid (full-width band)
 *   - explainer       plain-language "what / why / what to do" surfaced via the
 *                     info affordance on each card (see PulseExplainer)
 *
 * Adding a new widget? Append a row here, write the component, and reference
 * it in components/pulse/widgetRenderers.tsx. Layout migration is automatic --
 * unrecognised entries in a saved layout are ignored, and unknown width/height
 * fields on saved items are overwritten from the current registry footprint on
 * read.
 */

import { TIER_LEVELS, type TierName } from '@/lib/subscription/feature-catalog';

export type WidgetId =
  | 'insight-card'
  | 'live-metrics-strip'
  | 'target-trajectory'
  | 'alerts-inbox'
  | 'grid-carbon'
  | 'energy-timing'
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
  | 'soil-carbon-trajectory'
  // Financial subpage widgets. Exempt from the main grid but registered so
  // drill-overlay lookups (`?drill=top-cost-drivers`) find a label.
  | 'cost-intensity'
  | 'top-cost-drivers'
  | 'issb-disclosure';

export type Footprint = '1x1' | '2x1' | '2x2';

/**
 * Plain-language help shown in the card's info popover. No jargon -- the reader
 * may be a founder or CFO, not a sustainability specialist.
 */
export interface WidgetExplainer {
  /** What this card shows, in one sentence. */
  what: string;
  /** Why it matters to the reader, in one sentence. */
  why: string;
  /** One concrete next step. Optional. */
  todo?: string;
  /** Where the number comes from, in plain terms. Optional. */
  source?: string;
  /** True when the figure is modelled / estimated rather than measured. */
  isEstimate?: boolean;
}

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
  /** Plain-language help for the card's info affordance. */
  explainer?: WidgetExplainer;
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
    label: "Today's insight",
    description: 'Claude-written brief explaining what changed and why.',
    footprint: '2x1',
    phase: 3,
    explainer: {
      what: 'A short brief, written fresh each morning, explaining what changed in your data and why.',
      why: "It surfaces the one or two things worth your attention so you don't have to read every chart.",
      todo: 'Read it each morning, or open it for the full write-up.',
      source: 'Generated daily from your latest metrics, anomalies and targets.',
    },
  }),
  'live-metrics-strip': withLayout({
    id: 'live-metrics-strip',
    label: 'Live metrics strip',
    description: 'Headline KPIs with sparklines, deltas and live tickers.',
    footprint: '2x1',
    exempt: true,
    phase: 1,
    explainer: {
      what: 'Your headline numbers, each updated as new data lands.',
      why: 'A two-second read on where your key metrics sit today and which way they are moving.',
      source: 'Your daily metric snapshots, with the pound value from your shadow prices.',
    },
  }),
  'target-trajectory': withLayout({
    id: 'target-trajectory',
    label: 'Progress to targets',
    description: 'Forecast vs target with on-track / at-risk pill.',
    footprint: '2x1',
    phase: 4,
    explainer: {
      what: "Your progress towards a target, with a forecast of where today's pace lands you.",
      why: "Shows whether you'll hit a commitment while there's still time to change course.",
      todo: 'Set or adjust targets in Pulse > Targets.',
      source: 'Your active targets compared against your metric history.',
    },
  }),
  'alerts-inbox': withLayout({
    id: 'alerts-inbox',
    label: 'Alerts',
    description: 'Anomaly detector output. Acknowledge or dismiss.',
    footprint: '1x1',
    phase: 5,
    explainer: {
      what: 'Unusual movements in your data that have been flagged automatically.',
      why: 'Catches data-entry errors and real changes early, before they reach a report.',
      todo: 'Open an alert to see the likely cause, then acknowledge or dismiss it.',
      source: 'Statistical checks run against your daily metric history.',
    },
  }),
  'grid-carbon': withLayout({
    id: 'grid-carbon',
    label: 'Grid electricity now',
    description: 'Live g CO₂/kWh + cleanest production window.',
    footprint: '1x1',
    phase: 6,
    explainer: {
      what: 'How clean the electricity grid is right now, and when it will be cleanest today.',
      why: 'Running energy-heavy work in a greener window cuts your carbon for no extra cost.',
      todo: 'Shift flexible, energy-intensive tasks into the cleanest window shown.',
      source: 'Live national grid carbon-intensity data (UK today; EU coming next).',
    },
  }),
  'energy-timing': withLayout({
    id: 'energy-timing',
    label: 'Cleanest energy window',
    description: "Today's cleanest grid window + a load-shift saving.",
    footprint: '2x1',
    phase: 6,
    explainer: {
      what: "Today's cleanest and dirtiest 2-hour windows on your facility's regional grid, and what shifting load saves.",
      why: 'Running flexible, energy-intensive work when the grid is greenest cuts carbon (and often cost) for free.',
      todo: 'Move shiftable load (bottling, CIP, cold storage) into the cleanest window shown.',
      source: 'UK Carbon Intensity API, regional to your facility postcode; weighted by your half-hourly data when present.',
    },
  }),
  'peer-benchmark': withLayout({
    id: 'peer-benchmark',
    label: 'How you compare',
    description: 'Anonymised percentile vs your industry segment.',
    footprint: '1x1',
    phase: 7,
    explainer: {
      what: 'Where you sit against anonymised peers in your part of the industry.',
      why: 'Tells you whether a number is good or bad relative to similar businesses.',
      source: 'Aggregated, anonymised data from comparable organisations (minimum five).',
    },
  }),
  'live-activity': withLayout({
    id: 'live-activity',
    label: 'Latest activity',
    description: 'Chronological stream of every live event in the org.',
    footprint: '2x2',
    phase: 2,
    explainer: {
      what: 'A running feed of changes happening across your organisation.',
      why: 'A live pulse of activity, handy for spotting what is moving right now.',
      source: 'Real-time events from your emissions, product and supplier data.',
    },
  }),
  'facility-impact': withLayout({
    id: 'facility-impact',
    label: 'Impact by site',
    description:
      'Scope 1 & 2 utilities, water and waste over 12 months with live grid-carbon overlay.',
    footprint: '2x2',
    phase: 8,
    explainer: {
      what: 'Emissions, water and waste broken down by site over the last 12 months.',
      why: 'Shows which facilities drive your footprint, so you know where to focus effort.',
      source: 'Your facility utility, water and waste entries, with a live grid-carbon overlay.',
    },
  }),
  'csrd-gaps': withLayout({
    id: 'csrd-gaps',
    label: 'Disclosure readiness',
    description:
      'EU sustainability reporting checks against your data. Each gap has a one-click fix.',
    footprint: '1x1',
    phase: 9,
    explainer: {
      what: "How ready you are to report against the EU's sustainability disclosure rules.",
      why: "Highlights exactly which data points you're still missing for compliance.",
      todo: 'Work through each gap; many have a one-click fix.',
      source: 'EU ESRS disclosure points checked against your live data.',
    },
  }),
  'ask-rosa': withLayout({
    id: 'ask-rosa',
    label: 'Ask Rosa',
    description:
      'Embedded conversational AI with live tool access. Ask anything about your data without leaving the dashboard.',
    footprint: '2x2',
    exempt: true,
    phase: 10,
    explainer: {
      what: 'Ask questions about your sustainability data in plain language.',
      why: 'Get answers without building a report or leaving the dashboard.',
    },
  }),
  'supplier-hotspots': withLayout({
    id: 'supplier-hotspots',
    label: 'Supplier hotspots',
    description:
      'Top Scope 3 contributors with concentration risk and category split.',
    footprint: '2x1',
    phase: 11,
    explainer: {
      what: 'The suppliers contributing most to your supply-chain (Scope 3) emissions.',
      why: 'Your biggest reduction opportunities usually sit with a handful of suppliers.',
      source: 'Your completed product footprints, grouped by supplier.',
    },
  }),
  'what-if': withLayout({
    id: 'what-if',
    label: 'Try a change',
    description:
      'Decarbonisation levers: renewables, heat pumps, HVO. Instant emissions and £-saving impact.',
    footprint: '2x1',
    phase: 12,
    explainer: {
      what: 'A playground to test decarbonisation moves like renewables, heat pumps or HVO.',
      why: 'See the emissions and cost impact of a change before you commit to it.',
      source: 'Modelled against your last 12 months of emissions.',
    },
  }),
  'harvest-seasons': withLayout({
    id: 'harvest-seasons',
    label: 'Harvest calendar',
    description:
      'Annual harvest windows for your crops. Anticipate seasonal supply and emissions spikes.',
    footprint: '2x1',
    phase: 13,
    explainer: {
      what: 'When your key crops are typically harvested through the year.',
      why: 'Helps you anticipate seasonal swings in supply and emissions.',
      source: 'A general crop calendar matched to your product ingredients.',
      isEstimate: true,
    },
  }),
  'financial-footprint': withLayout({
    id: 'financial-footprint',
    label: 'What your impact costs',
    description: 'The pound value of your last 12 months of carbon, water and waste.',
    footprint: '2x2',
    phase: 14,
    explainer: {
      what: 'The cost of your environmental impact over the last 12 months, in pounds.',
      why: 'Turns emissions and resource use into a number the whole business understands.',
      source: 'Your live impact data multiplied by recognised damage-cost prices (what a tonne of CO₂e or cubic metre of water costs society).',
    },
  }),
  'scenario-sensitivity': withLayout({
    id: 'scenario-sensitivity',
    label: 'Carbon price stress test',
    description:
      'How much your annual carbon bill changes if carbon prices rise or fall.',
    footprint: '2x1',
    phase: 15,
    explainer: {
      what: 'Your annual emissions re-priced at higher and lower carbon prices.',
      why: 'Shows how exposed your costs are if carbon gets more expensive in future.',
      source: 'Your annual emissions multiplied by a range of illustrative carbon prices.',
      isEstimate: true,
    },
  }),
  'product-env-cost': withLayout({
    id: 'product-env-cost',
    label: 'Cost per product',
    description:
      'Embedded £/unit for every product with a completed LCA.',
    footprint: '2x1',
    phase: 16,
    explainer: {
      what: 'The embedded environmental cost, in pounds, of each product you make.',
      why: 'Reveals which products carry the most impact per unit sold.',
      source: 'Your completed product life-cycle assessments, priced with shadow prices.',
    },
  }),
  'regulatory-exposure': withLayout({
    id: 'regulatory-exposure',
    label: 'Carbon taxes and levies',
    description:
      'The carbon and packaging charges you actually have to pay each year.',
    footprint: '2x1',
    phase: 17,
    explainer: {
      what: 'Your estimated annual bill under each UK carbon and packaging rule, with the ones you are exempt from marked "not applicable".',
      why: "Tells you the regulatory cost you genuinely carry, so it isn't a surprise and you don't budget for charges that don't apply to you.",
      source: 'Your emissions and packaging tonnage tested against each regime’s eligibility thresholds (UK ETS, UK CBAM, Plastic Packaging Tax and Packaging EPR).',
    },
  }),
  macc: withLayout({
    id: 'macc',
    label: 'Cheapest ways to cut carbon',
    description:
      'Your carbon-cutting options ranked by cost per tonne saved.',
    footprint: '2x2',
    phase: 18,
    explainer: {
      what: 'Your decarbonisation options ranked by cost per tonne of carbon saved.',
      why: 'Shows the cheapest ways to cut carbon first, so your budget goes furthest.',
      source: 'Modelled abatement levers applied to your emissions mix.',
    },
  }),
  'carbon-budgets': withLayout({
    id: 'carbon-budgets',
    label: 'Carbon budgets',
    description:
      'Monthly, quarterly or annual carbon budgets with traffic-light variance.',
    footprint: '2x1',
    phase: 19,
    explainer: {
      what: 'Your carbon budgets and how actual emissions are tracking against them.',
      why: 'Keeps emissions on plan with a clear over-or-under signal.',
      todo: 'Set budgets from this card if you have none yet.',
      source: 'Budgets you set, compared against your metric history.',
    },
  }),
  'soil-carbon-trajectory': withLayout({
    id: 'soil-carbon-trajectory',
    label: 'Soil carbon trajectory',
    description:
      'Measured soil organic carbon over time per field, with the annual change and a confidence grade.',
    footprint: '2x2',
    phase: 20,
    explainer: {
      what: 'How your measured soil carbon has changed over time, field by field.',
      why: 'The credible removal claim is the measured direction and scale of change, not a single-day figure.',
      todo: 'Add repeated soil samples (same depth, same lab) on your fields to populate this.',
      source: 'Your soil carbon measurements, with a conservative discount for low-confidence sampling.',
      isEstimate: false,
    },
  }),
  'cost-intensity': withLayout({
    id: 'cost-intensity',
    label: 'Cost intensity',
    description:
      'Environmental £ per £m revenue, per FTE, per unit produced. Financial subpage only.',
    footprint: '2x1',
    exempt: true,
    phase: 14,
    explainer: {
      what: 'Your environmental cost relative to revenue, headcount and units produced.',
      why: 'Normalises impact so you can compare it fairly as the business grows.',
      source: 'Your financial footprint divided by revenue, employees and production volumes.',
    },
  }),
  'top-cost-drivers': withLayout({
    id: 'top-cost-drivers',
    label: 'Top cost drivers',
    description:
      'Ranked line items by £ cost across facilities and categories.',
    footprint: '2x2',
    exempt: true,
    phase: 14,
    explainer: {
      what: 'Your biggest environmental cost line items, ranked.',
      why: 'Points straight at where the money and impact are concentrated.',
      source: 'Your facility activity, priced and ranked by shadow-price cost.',
    },
  }),
  'issb-disclosure': withLayout({
    id: 'issb-disclosure',
    label: 'Investor climate disclosure',
    description:
      'Auto-populated climate-related financial disclosure.',
    footprint: '1x1',
    exempt: true,
    phase: 14,
    explainer: {
      what: 'An auto-filled draft of the IFRS S2 climate financial disclosure.',
      why: 'Gives you a head start on investor-ready and audit-ready climate reporting.',
      source: 'Your emissions data mapped to IFRS S2 fields; some regulatory inputs use placeholder values until you enter them.',
      isEstimate: true,
    },
  }),
};

export const ALL_WIDGET_IDS = Object.keys(WIDGET_REGISTRY) as WidgetId[];

/** Widgets that go in the draggable grid (not exempt). */
export const GRID_WIDGET_IDS = ALL_WIDGET_IDS.filter(id => !WIDGET_REGISTRY[id].exempt);

/**
 * Minimum subscription tier that unlocks each widget. Single source of truth
 * for Pulse tier gating — mirrors FEATURE_MIN_TIER (feature-catalog) and the
 * metric `minTier` map. Seed is the entry tier (live awareness + targets),
 * Blossom adds operational analytics, Canopy adds the financial-valuation and
 * compliance band. The Record<WidgetId, …> type forces every widget to be
 * classified.
 */
export const WIDGET_MIN_TIER: Record<WidgetId, TierName> = {
  // Seed — live awareness + the targets anchor
  'target-trajectory': 'seed',
  'insight-card': 'seed',
  'live-metrics-strip': 'seed',
  'grid-carbon': 'seed',
  'energy-timing': 'seed',
  'live-activity': 'seed',
  'ask-rosa': 'seed',
  // Blossom — operational analytics
  'alerts-inbox': 'blossom',
  'peer-benchmark': 'blossom',
  'facility-impact': 'blossom',
  'supplier-hotspots': 'blossom',
  'harvest-seasons': 'blossom',
  'carbon-budgets': 'blossom',
  // Canopy — financial valuation + compliance
  'financial-footprint': 'canopy',
  'cost-intensity': 'canopy',
  'top-cost-drivers': 'canopy',
  'product-env-cost': 'canopy',
  'scenario-sensitivity': 'canopy',
  'regulatory-exposure': 'canopy',
  'macc': 'canopy',
  'what-if': 'canopy',
  'csrd-gaps': 'canopy',
  'issb-disclosure': 'canopy',
  'soil-carbon-trajectory': 'canopy',
};

/** Widget ids an org on `tier` can see (cumulative: higher tiers inherit). */
export function widgetIdsForTier(tier: TierName): WidgetId[] {
  const level = TIER_LEVELS[tier];
  return ALL_WIDGET_IDS.filter(id => TIER_LEVELS[WIDGET_MIN_TIER[id]] <= level);
}

/** True when `tier` unlocks `id`. */
export function isWidgetAllowedForTier(id: WidgetId, tier: TierName): boolean {
  return TIER_LEVELS[WIDGET_MIN_TIER[id]] <= TIER_LEVELS[tier];
}
