/**
 * Pulse metric key registry.
 *
 * One canonical place that defines:
 *   - the stable string identifier written to metric_snapshots.metric_key
 *   - the unit + display label used by MetricCard
 *   - whether a higher value is "good" (for trend-colour direction)
 *
 * Phase 1 ships four metrics. Later phases extend this list.
 */

export type MetricKey =
  | 'total_co2e'
  | 'water_consumption'
  | 'products_assessed'
  | 'lca_completeness_pct';

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  unit: string;
  /** True when a higher value is "good" (e.g. completeness %). False for emissions/water. */
  higherIsBetter: boolean;
  /** Where the metric card links to for drill-down. */
  href: string;
  /** Short blurb shown beneath the value. */
  description: string;
  /** Whether to show the value in compact ("1.2k") or full notation. */
  compact?: boolean;
}

export const METRIC_DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  total_co2e: {
    key: 'total_co2e',
    label: 'Total emissions',
    unit: 'kg CO₂e',
    higherIsBetter: false,
    href: '/data/scope-1-2/',
    description: 'Trailing 12 months, scope 1 + 2 from facility activity',
    compact: true,
  },
  water_consumption: {
    key: 'water_consumption',
    label: 'Water intake',
    unit: 'm³',
    higherIsBetter: false,
    href: '/performance/',
    description: 'Trailing 12 months, operational facility intake',
    compact: true,
  },
  products_assessed: {
    key: 'products_assessed',
    label: 'Products assessed',
    unit: 'LCAs',
    higherIsBetter: true,
    href: '/products/',
    description: 'Cumulative completed product LCAs',
  },
  lca_completeness_pct: {
    key: 'lca_completeness_pct',
    label: 'LCA coverage',
    unit: '%',
    higherIsBetter: true,
    href: '/products/',
    description: 'Share of products with a completed LCA',
  },
};

export const ALL_METRIC_KEYS = Object.keys(METRIC_DEFINITIONS) as MetricKey[];
