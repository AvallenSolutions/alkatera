/**
 * Pulse metric key registry.
 *
 * One canonical place that defines:
 *   - the stable string identifier written to metric_snapshots.metric_key
 *   - the unit + display label used by MetricCard
 *   - whether a higher value is "good" (for trend-colour direction)
 *   - the minimum subscription tier that can set a target on this metric
 *
 * Phase 1 shipped four metrics. Targetable environmental metrics are gated by
 * tier (see `minTier`): carbon at Seed, water at Blossom, circularity + nature
 * at Canopy. Later phases extend this list.
 */

import { TIER_LEVELS, type TierName } from '@/lib/subscription/feature-catalog';

export type MetricKey =
  | 'total_co2e'
  | 'water_consumption'
  | 'waste_diversion_rate'
  | 'land_use'
  | 'products_assessed'
  | 'lca_completeness_pct';

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  unit: string;
  /** True when a higher value is "good" (e.g. completeness %). False for emissions/water. */
  higherIsBetter: boolean;
  /**
   * Minimum subscription tier that can set a target on this metric.
   * Seed = carbon (+ non-environmental progress metrics), Blossom adds water,
   * Canopy adds circularity (waste diversion) and nature (land use).
   */
  minTier: TierName;
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
    minTier: 'seed',
    href: '/data/scope-1-2/',
    description: 'Trailing 12 months, scope 1 + 2 from facility activity',
    compact: true,
  },
  water_consumption: {
    key: 'water_consumption',
    label: 'Water intake',
    unit: 'm³',
    higherIsBetter: false,
    minTier: 'blossom',
    href: '/performance/',
    description: 'Trailing 12 months, operational facility intake',
    compact: true,
  },
  waste_diversion_rate: {
    key: 'waste_diversion_rate',
    label: 'Waste diversion',
    unit: '%',
    higherIsBetter: true,
    minTier: 'canopy',
    href: '/performance/',
    description: 'Trailing 12 months, share of waste kept out of disposal',
  },
  land_use: {
    key: 'land_use',
    label: 'Land use',
    unit: 'm²·yr',
    higherIsBetter: false,
    minTier: 'canopy',
    href: '/products/',
    description: 'Embedded land use across products with a completed LCA',
    compact: true,
  },
  products_assessed: {
    key: 'products_assessed',
    label: 'Products assessed',
    unit: 'products',
    higherIsBetter: true,
    minTier: 'seed',
    href: '/products/',
    description: 'Products with at least one completed LCA',
  },
  lca_completeness_pct: {
    key: 'lca_completeness_pct',
    label: 'LCA coverage',
    unit: '%',
    higherIsBetter: true,
    minTier: 'seed',
    href: '/products/',
    description: 'Share of products with a completed LCA',
  },
};

export const ALL_METRIC_KEYS = Object.keys(METRIC_DEFINITIONS) as MetricKey[];

/**
 * Metric keys an org on `tier` is allowed to set targets on — every metric
 * whose `minTier` is at or below the org's tier. Cumulative: Canopy gets all,
 * Blossom gets carbon + water (+ progress), Seed gets carbon (+ progress).
 */
export function metricKeysForTier(tier: TierName): MetricKey[] {
  const level = TIER_LEVELS[tier];
  return ALL_METRIC_KEYS.filter(
    (key) => TIER_LEVELS[METRIC_DEFINITIONS[key].minTier] <= level,
  );
}
