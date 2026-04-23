/**
 * Pulse -- Cost-calculation maths.
 *
 * Pure functions (no I/O) that compute every £ figure the Pulse dashboard
 * displays. Extracted from the API routes so:
 *   - the formulas are a single source of truth
 *   - scenario tests can exercise them without mocking Supabase
 *   - the reconciliation logic between "org-wide cost intensity" and
 *     "per-product embodied cost" is provable rather than asserted
 *
 * Terminology used throughout:
 *   - "shadow multiplier" = price_per_unit × native_unit_multiplier, i.e. the
 *     £ you get when you multiply a raw snapshot value (in its native unit --
 *     kg CO2e, m3, etc.) by this number.
 *   - "embodied" = appears in a product LCA (per functional unit)
 *   - "org footprint" = rolled up from metric_snapshots (facility-wide)
 */

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ShadowPriceLike {
  /** Price per display unit, e.g. £85 per tCO2e. */
  price_per_unit: number;
  /** Multiplier from the metric's NATIVE unit to the price's display unit,
   *  e.g. 0.001 for carbon (kg -> tonnes) or 1 for water (m3 -> m3). */
  native_unit_multiplier: number;
  currency: string;
}

/** A minimal shape for the subset of shadow-prices we care about here. */
export interface ShadowPriceMap {
  total_co2e?: ShadowPriceLike;
  water_consumption?: ShadowPriceLike;
}

export interface MetricSnapshotLike {
  metric_key: string;
  /** Raw metric value in its native unit (kg CO2e, m3, etc.). */
  value: number;
}

export interface ProductLcaLike {
  product_id: string;
  /** kg CO2e per functional unit, from aggregated_impacts.climate_change_gwp100. */
  kg_co2e_per_unit: number;
  /** Litres of water per functional unit, from aggregated_impacts.water_consumption. */
  litres_water_per_unit: number;
  /** Annual production volume of this product (units/year). Optional: when
   *  absent, the product is excluded from volume-weighted aggregates. */
  annual_production_volume?: number;
}

// ----------------------------------------------------------------------------
// Shadow-multiplier helpers
// ----------------------------------------------------------------------------

/**
 * Return the £/kg multiplier for carbon. A shadow price of £85/tCO2e with a
 * native_unit_multiplier of 0.001 yields £0.085 per kg.
 */
export function carbonGbpPerKg(prices: ShadowPriceMap): number {
  const p = prices.total_co2e;
  if (!p || p.currency !== 'GBP') return 0;
  return p.price_per_unit * p.native_unit_multiplier;
}

/**
 * Return the £/litre multiplier for water. A shadow price of £2.50/m3 with a
 * native_unit_multiplier of 1 (m3->m3) yields £0.0025 per litre.
 */
export function waterGbpPerLitre(prices: ShadowPriceMap): number {
  const p = prices.water_consumption;
  if (!p || p.currency !== 'GBP') return 0;
  // Price is per m3 in its display unit; 1 m3 = 1000 L so £/m3 / 1000 = £/L.
  return (p.price_per_unit * p.native_unit_multiplier) / 1000;
}

// ----------------------------------------------------------------------------
// Org-wide financial footprint (the cost-intensity numerator)
// ----------------------------------------------------------------------------

export interface FinancialFootprintResult {
  total_gbp: number;
  by_metric_gbp: Record<string, number>;
}

/**
 * Sum daily snapshots × shadow price = org's monetised environmental footprint
 * for the period. Snapshots outside the passed list are not considered -- the
 * caller filters the time window upstream.
 *
 *   £total = Σ (snapshot.value × native_unit_multiplier × price_per_unit)
 *          = Σ (snapshot.value × shadowMultiplier(metric_key))
 */
export function computeFinancialFootprint(
  snapshots: MetricSnapshotLike[],
  prices: ShadowPriceMap,
): FinancialFootprintResult {
  // Pre-compute multipliers so each row does one Map lookup.
  const multiplierByMetric = new Map<string, number>();
  const carbonM = carbonGbpPerKg(prices);
  const waterM = waterGbpPerLitre(prices) * 1000; // litres->m3 in the native unit path
  if (carbonM > 0) multiplierByMetric.set('total_co2e', carbonM);
  if (waterM > 0) multiplierByMetric.set('water_consumption', waterM);

  const byMetric: Record<string, number> = {};
  let total = 0;
  for (const s of snapshots) {
    const m = multiplierByMetric.get(s.metric_key);
    if (m === undefined) continue;
    const v = Number(s.value);
    if (!Number.isFinite(v)) continue;
    const gbp = v * m;
    total += gbp;
    byMetric[s.metric_key] = (byMetric[s.metric_key] ?? 0) + gbp;
  }
  return { total_gbp: total, by_metric_gbp: byMetric };
}

// ----------------------------------------------------------------------------
// Cost-intensity ratios (org-wide £ ÷ business unit)
// ----------------------------------------------------------------------------

export interface IntensityDenominators {
  /** Annual revenue in GBP. */
  annual_revenue_gbp: number;
  /** Full-time equivalent headcount. */
  fte_count: number;
  /** Total units produced across the window. */
  units_produced: number;
}

export interface CostIntensityResult {
  per_m_revenue: number | null;
  per_fte: number | null;
  per_unit: number | null;
}

/**
 * Compute the three intensity ratios: £ per £m revenue, £ per FTE, £ per unit
 * produced. Returns null for any ratio whose denominator is <= 0 -- the UI
 * surfaces a "needs data" nudge rather than a misleading zero.
 *
 *   per_m_revenue = total_gbp / (annual_revenue_gbp / 1_000_000)
 *   per_fte       = total_gbp / fte_count
 *   per_unit      = total_gbp / units_produced
 */
export function computeCostIntensity(
  totalGbp: number,
  d: IntensityDenominators,
): CostIntensityResult {
  return {
    per_m_revenue:
      d.annual_revenue_gbp > 0 ? totalGbp / (d.annual_revenue_gbp / 1_000_000) : null,
    per_fte: d.fte_count > 0 ? totalGbp / d.fte_count : null,
    per_unit: d.units_produced > 0 ? totalGbp / d.units_produced : null,
  };
}

// ----------------------------------------------------------------------------
// Per-product embodied cost (from the LCA)
// ----------------------------------------------------------------------------

export interface ProductEnvCost {
  product_id: string;
  gbp_per_unit: number;
  gbp_carbon: number;
  gbp_water: number;
  kg_co2e_per_unit: number;
  litres_water_per_unit: number;
}

/**
 * Given an LCA's per-unit embodied impact and the org's shadow prices,
 * produce the per-unit £ figure displayed on the "Environmental cost per
 * unit" widget.
 *
 *   £/unit = kg_co2e × carbonGbpPerKg  +  litres_water × waterGbpPerLitre
 */
export function computeProductEnvCost(
  lca: ProductLcaLike,
  prices: ShadowPriceMap,
): ProductEnvCost {
  const kg = Number.isFinite(lca.kg_co2e_per_unit) ? lca.kg_co2e_per_unit : 0;
  const l = Number.isFinite(lca.litres_water_per_unit) ? lca.litres_water_per_unit : 0;
  const gbpCarbon = kg * carbonGbpPerKg(prices);
  const gbpWater = l * waterGbpPerLitre(prices);
  return {
    product_id: lca.product_id,
    kg_co2e_per_unit: kg,
    litres_water_per_unit: l,
    gbp_carbon: gbpCarbon,
    gbp_water: gbpWater,
    gbp_per_unit: gbpCarbon + gbpWater,
  };
}

// ----------------------------------------------------------------------------
// Portfolio aggregates -- simple vs volume-weighted average
// ----------------------------------------------------------------------------

export interface PortfolioAggregate {
  /** Simple arithmetic mean of per-unit £ across products. */
  simple_mean_gbp_per_unit: number;
  /** Production-volume-weighted mean of per-unit £ (the "apples-to-apples"
   *  figure vs Cost Intensity). null when no product has production volume. */
  weighted_mean_gbp_per_unit: number | null;
  /** Total annual £ contributed by products with annual volume on file. */
  lca_attributed_gbp_per_year: number;
  /** Total annual units of products with LCAs + volumes. */
  lca_attributed_units: number;
  /** Count of products included. */
  product_count: number;
  /** Count of products with annual volume on file (for the weighted mean). */
  products_with_volume: number;
}

/**
 * Aggregate per-product embodied costs into portfolio-level figures.
 *
 * The widget historically showed a simple mean (each product equal weight).
 * Cost Intensity uses total £ / total units, which is effectively a
 * volume-weighted mean. We compute both so callers can display the
 * apples-to-apples figure.
 *
 *   simple_mean   = Σ(£/unit_i) / n
 *   weighted_mean = Σ(£/unit_i × units_i) / Σ(units_i)
 */
export function aggregatePortfolio(products: ProductEnvCost[]): PortfolioAggregate {
  const n = products.length;
  if (n === 0) {
    return {
      simple_mean_gbp_per_unit: 0,
      weighted_mean_gbp_per_unit: null,
      lca_attributed_gbp_per_year: 0,
      lca_attributed_units: 0,
      product_count: 0,
      products_with_volume: 0,
    };
  }

  const simple_mean_gbp_per_unit =
    products.reduce((s, p) => s + p.gbp_per_unit, 0) / n;

  // Volume-weighted mean: only consider products with a known annual volume.
  let weighted_gbp = 0;
  let weighted_units = 0;
  let products_with_volume = 0;
  for (const p of products) {
    const v = (p as ProductEnvCost & { annual_production_volume?: number })
      .annual_production_volume;
    if (typeof v === 'number' && v > 0) {
      weighted_gbp += p.gbp_per_unit * v;
      weighted_units += v;
      products_with_volume += 1;
    }
  }

  return {
    simple_mean_gbp_per_unit,
    weighted_mean_gbp_per_unit:
      weighted_units > 0 ? weighted_gbp / weighted_units : null,
    lca_attributed_gbp_per_year: weighted_gbp,
    lca_attributed_units: weighted_units,
    product_count: n,
    products_with_volume,
  };
}

// ----------------------------------------------------------------------------
// Reconciliation
// ----------------------------------------------------------------------------

export interface ReconciliationResult {
  /** Total org-wide £ liability over the period. */
  org_footprint_gbp: number;
  /** Annual £ attributed to products via their LCAs + production volumes. */
  lca_attributed_gbp: number;
  /** £ NOT yet attributed to any product ("unattributed overhead"). */
  unattributed_gbp: number;
  /** Share of org footprint attributed to products (0..1). */
  lca_coverage_pct: number;
  /** True when the two are within `tolerance` of each other. */
  reconciles: boolean;
  /** Absolute £ gap. */
  gap_gbp: number;
}

/**
 * Compare the org footprint to the sum-of-LCA-attributed cost and surface
 * the gap. A perfectly-allocated system has lca_attributed_gbp ≈ org_footprint
 * and lca_coverage_pct ≈ 1. Gaps indicate overhead emissions not yet landed
 * on a product LCA, OR production volume data entry errors.
 *
 * The `tolerance_pct` parameter (default 2%) accepts small rounding drift as
 * "reconciled". Set to 0 for strict equality in tests.
 */
export function reconcileCostIntensity(args: {
  org_footprint_gbp: number;
  lca_attributed_gbp: number;
  tolerance_pct?: number;
}): ReconciliationResult {
  const { org_footprint_gbp, lca_attributed_gbp } = args;
  const tolerance = args.tolerance_pct ?? 0.02;
  const gap = org_footprint_gbp - lca_attributed_gbp;
  const coverage = org_footprint_gbp > 0 ? lca_attributed_gbp / org_footprint_gbp : 0;
  const reconciles =
    org_footprint_gbp > 0
      ? Math.abs(gap) / org_footprint_gbp <= tolerance
      : Math.abs(gap) <= 1e-9;
  return {
    org_footprint_gbp,
    lca_attributed_gbp,
    unattributed_gbp: Math.max(0, gap),
    lca_coverage_pct: coverage,
    reconciles,
    gap_gbp: gap,
  };
}
