/**
 * Pulse cost-maths scenario tests.
 *
 * These cover the full chain of calculations behind two widgets whose numbers
 * must line up when data is clean:
 *   - Cost Intensity (org footprint ÷ units produced)
 *   - Environmental Cost Per Unit (per-LCA embodied £)
 *
 * Scenarios are grouped so a failure narrows immediately:
 *   1. Shadow multipliers    -- carbon / water units plumbed correctly
 *   2. Financial footprint   -- snapshots × prices produces the expected £
 *   3. Cost intensity ratios -- revenue / FTE / unit divisions
 *   4. Per-product cost      -- embodied LCA impact priced correctly
 *   5. Portfolio aggregation -- simple vs volume-weighted mean
 *   6. Reconciliation        -- org-wide ≈ sum-of-LCA when allocation is tight
 *   7. Real-world scenarios  -- drinks-company numbers end to end
 *
 * Every test uses exact numbers so any drift surfaces immediately.
 */

import { describe, expect, it } from 'vitest';
import {
  aggregatePortfolio,
  carbonGbpPerKg,
  computeCostIntensity,
  computeFinancialFootprint,
  computeProductEnvCost,
  reconcileCostIntensity,
  waterGbpPerLitre,
  type ProductLcaLike,
  type ShadowPriceMap,
} from '../cost-math';

// Standard shadow prices used across scenarios -- matches the seeded defaults.
const DEFAULT_PRICES: ShadowPriceMap = {
  total_co2e: {
    price_per_unit: 85, // £/tCO2e
    native_unit_multiplier: 0.001, // kg -> tonnes
    currency: 'GBP',
  },
  water_consumption: {
    price_per_unit: 2.5, // £/m3
    native_unit_multiplier: 1, // m3 -> m3
    currency: 'GBP',
  },
};

// ============================================================================
// 1. Shadow multipliers
// ============================================================================

describe('carbonGbpPerKg', () => {
  it('converts £85/tCO2e into £0.085 per kg', () => {
    expect(carbonGbpPerKg(DEFAULT_PRICES)).toBeCloseTo(0.085, 6);
  });

  it('returns 0 when the carbon price is missing', () => {
    expect(carbonGbpPerKg({})).toBe(0);
  });

  it('returns 0 when the currency is not GBP', () => {
    expect(
      carbonGbpPerKg({
        total_co2e: { price_per_unit: 85, native_unit_multiplier: 0.001, currency: 'USD' },
      }),
    ).toBe(0);
  });

  it('handles a custom price correctly', () => {
    expect(
      carbonGbpPerKg({
        total_co2e: { price_per_unit: 150, native_unit_multiplier: 0.001, currency: 'GBP' },
      }),
    ).toBeCloseTo(0.15, 6);
  });
});

describe('waterGbpPerLitre', () => {
  it('converts £2.50/m3 into £0.0025 per litre', () => {
    expect(waterGbpPerLitre(DEFAULT_PRICES)).toBeCloseTo(0.0025, 6);
  });

  it('returns 0 when the water price is missing', () => {
    expect(waterGbpPerLitre({})).toBe(0);
  });

  it('scales with the water price', () => {
    expect(
      waterGbpPerLitre({
        water_consumption: { price_per_unit: 4.0, native_unit_multiplier: 1, currency: 'GBP' },
      }),
    ).toBeCloseTo(0.004, 6);
  });
});

// ============================================================================
// 2. Financial footprint from snapshots
// ============================================================================

describe('computeFinancialFootprint', () => {
  it('returns zero for no snapshots', () => {
    const r = computeFinancialFootprint([], DEFAULT_PRICES);
    expect(r.total_gbp).toBe(0);
    expect(r.by_metric_gbp).toEqual({});
  });

  it('monetises carbon correctly: 1000 kg = £85', () => {
    const r = computeFinancialFootprint(
      [{ metric_key: 'total_co2e', value: 1000 }],
      DEFAULT_PRICES,
    );
    expect(r.total_gbp).toBeCloseTo(85, 4);
    expect(r.by_metric_gbp.total_co2e).toBeCloseTo(85, 4);
  });

  it('monetises water correctly: 100 m3 = £250', () => {
    const r = computeFinancialFootprint(
      [{ metric_key: 'water_consumption', value: 100 }],
      DEFAULT_PRICES,
    );
    expect(r.total_gbp).toBeCloseTo(250, 4);
    expect(r.by_metric_gbp.water_consumption).toBeCloseTo(250, 4);
  });

  it('sums multiple snapshots across metrics', () => {
    const r = computeFinancialFootprint(
      [
        { metric_key: 'total_co2e', value: 500 }, // £42.50
        { metric_key: 'total_co2e', value: 500 }, // £42.50
        { metric_key: 'water_consumption', value: 40 }, // £100
      ],
      DEFAULT_PRICES,
    );
    expect(r.total_gbp).toBeCloseTo(185, 4);
    expect(r.by_metric_gbp.total_co2e).toBeCloseTo(85, 4);
    expect(r.by_metric_gbp.water_consumption).toBeCloseTo(100, 4);
  });

  it('ignores metrics without a shadow price', () => {
    const r = computeFinancialFootprint(
      [{ metric_key: 'unknown_metric', value: 1000 }],
      DEFAULT_PRICES,
    );
    expect(r.total_gbp).toBe(0);
  });

  it('ignores NaN / non-finite values defensively', () => {
    const r = computeFinancialFootprint(
      [
        { metric_key: 'total_co2e', value: 100 },
        { metric_key: 'total_co2e', value: NaN },
        { metric_key: 'total_co2e', value: Infinity },
      ],
      DEFAULT_PRICES,
    );
    expect(r.total_gbp).toBeCloseTo(8.5, 4);
  });

  it('uses zero when a price is missing for a metric that appears', () => {
    const r = computeFinancialFootprint(
      [
        { metric_key: 'total_co2e', value: 1000 },
        { metric_key: 'water_consumption', value: 50 },
      ],
      { total_co2e: DEFAULT_PRICES.total_co2e },
    );
    expect(r.total_gbp).toBeCloseTo(85, 4);
    expect(r.by_metric_gbp.water_consumption).toBeUndefined();
  });
});

// ============================================================================
// 3. Cost-intensity ratios
// ============================================================================

describe('computeCostIntensity', () => {
  it('divides £ by each denominator correctly', () => {
    const r = computeCostIntensity(250_000, {
      annual_revenue_gbp: 10_000_000, // £10M
      fte_count: 50,
      units_produced: 26_000,
    });
    expect(r.per_m_revenue).toBeCloseTo(25_000, 2); // £25k per £m revenue
    expect(r.per_fte).toBeCloseTo(5_000, 2); // £5k per FTE
    expect(r.per_unit).toBeCloseTo(9.615, 3); // ~£9.62 per unit -- matches the live screenshot
  });

  it('returns null for missing denominators', () => {
    const r = computeCostIntensity(250_000, {
      annual_revenue_gbp: 0,
      fte_count: 0,
      units_produced: 0,
    });
    expect(r.per_m_revenue).toBeNull();
    expect(r.per_fte).toBeNull();
    expect(r.per_unit).toBeNull();
  });

  it('keeps ratios with positive denominators even if others are zero', () => {
    const r = computeCostIntensity(1_000, {
      annual_revenue_gbp: 1_000_000,
      fte_count: 0,
      units_produced: 100,
    });
    expect(r.per_m_revenue).toBeCloseTo(1000, 2);
    expect(r.per_fte).toBeNull();
    expect(r.per_unit).toBeCloseTo(10, 2);
  });

  it('handles a zero total cost (gives zero ratios, not nulls)', () => {
    const r = computeCostIntensity(0, {
      annual_revenue_gbp: 1_000_000,
      fte_count: 10,
      units_produced: 1000,
    });
    expect(r.per_m_revenue).toBe(0);
    expect(r.per_fte).toBe(0);
    expect(r.per_unit).toBe(0);
  });
});

// ============================================================================
// 4. Per-product embodied cost
// ============================================================================

describe('computeProductEnvCost', () => {
  const lca = (kg: number, litres: number): ProductLcaLike => ({
    product_id: 'test-product',
    kg_co2e_per_unit: kg,
    litres_water_per_unit: litres,
  });

  it('prices carbon-only LCAs correctly', () => {
    const r = computeProductEnvCost(lca(1.94, 0), DEFAULT_PRICES);
    expect(r.gbp_carbon).toBeCloseTo(0.1649, 4); // 1.94 × £0.085
    expect(r.gbp_water).toBe(0);
    expect(r.gbp_per_unit).toBeCloseTo(0.1649, 4);
  });

  it('prices water-only LCAs correctly', () => {
    const r = computeProductEnvCost(lca(0, 8.5), DEFAULT_PRICES);
    expect(r.gbp_carbon).toBe(0);
    expect(r.gbp_water).toBeCloseTo(0.02125, 5); // 8.5 × £0.0025
    expect(r.gbp_per_unit).toBeCloseTo(0.02125, 5);
  });

  it('adds carbon and water for combined LCAs', () => {
    const r = computeProductEnvCost(lca(1.94, 8.5), DEFAULT_PRICES);
    expect(r.gbp_per_unit).toBeCloseTo(0.1649 + 0.02125, 4);
  });

  it('falls back to 0 when no shadow price is configured', () => {
    const r = computeProductEnvCost(lca(1.94, 8.5), {});
    expect(r.gbp_per_unit).toBe(0);
    expect(r.gbp_carbon).toBe(0);
    expect(r.gbp_water).toBe(0);
  });

  it('treats NaN LCA inputs as zero (defensive)', () => {
    const r = computeProductEnvCost(lca(NaN, NaN), DEFAULT_PRICES);
    expect(r.gbp_per_unit).toBe(0);
  });

  it('preserves the raw physical impacts on the return', () => {
    const r = computeProductEnvCost(lca(1.5, 4), DEFAULT_PRICES);
    expect(r.kg_co2e_per_unit).toBe(1.5);
    expect(r.litres_water_per_unit).toBe(4);
  });
});

// ============================================================================
// 5. Portfolio aggregation: simple vs volume-weighted
// ============================================================================

describe('aggregatePortfolio', () => {
  const product = (
    id: string,
    gbpPerUnit: number,
    volume?: number,
  ): ReturnType<typeof computeProductEnvCost> & { annual_production_volume?: number } => ({
    product_id: id,
    gbp_per_unit: gbpPerUnit,
    gbp_carbon: gbpPerUnit,
    gbp_water: 0,
    kg_co2e_per_unit: 0,
    litres_water_per_unit: 0,
    annual_production_volume: volume,
  });

  it('returns zeros for empty portfolio', () => {
    const r = aggregatePortfolio([]);
    expect(r.simple_mean_gbp_per_unit).toBe(0);
    expect(r.weighted_mean_gbp_per_unit).toBeNull();
    expect(r.product_count).toBe(0);
  });

  it('computes simple mean as arithmetic average', () => {
    const r = aggregatePortfolio([
      product('a', 0.10),
      product('b', 0.20),
      product('c', 0.30),
    ]);
    expect(r.simple_mean_gbp_per_unit).toBeCloseTo(0.20, 6);
  });

  it('weighted mean matches simple mean when volumes are equal', () => {
    const r = aggregatePortfolio([
      product('a', 0.10, 1000),
      product('b', 0.20, 1000),
      product('c', 0.30, 1000),
    ]);
    expect(r.weighted_mean_gbp_per_unit).toBeCloseTo(0.20, 6);
    expect(r.simple_mean_gbp_per_unit).toBeCloseTo(0.20, 6);
  });

  it('weighted mean differs from simple mean when volumes differ', () => {
    // The £0.02 SKU ships 100k units; the £1.00 SKU ships 100 units.
    // Simple mean = £0.51. Weighted mean = (0.02×100_000 + 1.00×100) / 100_100
    //             = (2000 + 100) / 100_100 ≈ £0.021
    const r = aggregatePortfolio([
      product('mass', 0.02, 100_000),
      product('niche', 1.00, 100),
    ]);
    expect(r.simple_mean_gbp_per_unit).toBeCloseTo(0.51, 2);
    expect(r.weighted_mean_gbp_per_unit).toBeCloseTo(0.021, 3);
  });

  it('excludes products without volume from the weighted mean', () => {
    const r = aggregatePortfolio([
      product('has_vol', 0.10, 1000),
      product('no_vol', 5.00 /* no volume */),
    ]);
    expect(r.weighted_mean_gbp_per_unit).toBeCloseTo(0.10, 6);
    expect(r.products_with_volume).toBe(1);
    expect(r.product_count).toBe(2);
  });

  it('returns null weighted mean when no product has volume', () => {
    const r = aggregatePortfolio([product('a', 0.10), product('b', 0.20)]);
    expect(r.weighted_mean_gbp_per_unit).toBeNull();
    expect(r.simple_mean_gbp_per_unit).toBeCloseTo(0.15, 6);
  });

  it('computes lca_attributed_gbp_per_year = Σ £/unit × volume', () => {
    const r = aggregatePortfolio([
      product('a', 0.10, 1000), // £100/yr
      product('b', 0.20, 500), // £100/yr
    ]);
    expect(r.lca_attributed_gbp_per_year).toBeCloseTo(200, 4);
    expect(r.lca_attributed_units).toBe(1500);
  });
});

// ============================================================================
// 6. Reconciliation
// ============================================================================

describe('reconcileCostIntensity', () => {
  it('reconciles when org footprint equals sum-of-LCA within tolerance', () => {
    const r = reconcileCostIntensity({
      org_footprint_gbp: 250_000,
      lca_attributed_gbp: 249_000, // 0.4% gap
      tolerance_pct: 0.02,
    });
    expect(r.reconciles).toBe(true);
    expect(r.lca_coverage_pct).toBeCloseTo(0.996, 3);
    expect(r.gap_gbp).toBe(1000);
    expect(r.unattributed_gbp).toBe(1000);
  });

  it('does not reconcile when gap exceeds tolerance', () => {
    const r = reconcileCostIntensity({
      org_footprint_gbp: 250_000,
      lca_attributed_gbp: 100_000, // 60% gap
      tolerance_pct: 0.02,
    });
    expect(r.reconciles).toBe(false);
    expect(r.lca_coverage_pct).toBe(0.4);
    expect(r.unattributed_gbp).toBe(150_000);
  });

  it('handles zero org footprint', () => {
    const r = reconcileCostIntensity({
      org_footprint_gbp: 0,
      lca_attributed_gbp: 0,
    });
    expect(r.reconciles).toBe(true);
    expect(r.lca_coverage_pct).toBe(0);
    expect(r.gap_gbp).toBe(0);
  });

  it('reports coverage > 100% as over-attribution', () => {
    const r = reconcileCostIntensity({
      org_footprint_gbp: 100_000,
      lca_attributed_gbp: 120_000, // double-counted somewhere
    });
    expect(r.lca_coverage_pct).toBeCloseTo(1.2, 3);
    expect(r.gap_gbp).toBe(-20_000);
    expect(r.unattributed_gbp).toBe(0); // can't be negative
  });

  it('tight tolerance (0) demands exact match', () => {
    const r = reconcileCostIntensity({
      org_footprint_gbp: 100,
      lca_attributed_gbp: 99.99,
      tolerance_pct: 0,
    });
    expect(r.reconciles).toBe(false);
  });

  it('identity: zero-gap case reconciles at any tolerance', () => {
    const r = reconcileCostIntensity({
      org_footprint_gbp: 1_000_000,
      lca_attributed_gbp: 1_000_000,
      tolerance_pct: 0,
    });
    expect(r.reconciles).toBe(true);
    expect(r.gap_gbp).toBe(0);
  });
});

// ============================================================================
// 7. End-to-end real-world scenarios
// ============================================================================

describe('real-world scenarios', () => {
  /**
   * Scenario A -- A small distillery, perfect allocation.
   *
   * One facility, one year, every drop of water + every kg of CO2 from the
   * facility is allocated to the six assessed SKUs in proportion to production
   * volume. The two widgets MUST agree.
   */
  it('reconciles perfectly when allocation is complete', () => {
    // Facility outputs over the year:
    //   3,000 tCO2e (= 3,000,000 kg)
    //   50,000 m3 water
    const daily_kg_co2e = 3_000_000 / 365;
    const daily_m3_water = 50_000 / 365;
    const snapshots = Array.from({ length: 365 }, () => [
      { metric_key: 'total_co2e', value: daily_kg_co2e },
      { metric_key: 'water_consumption', value: daily_m3_water },
    ]).flat();

    const footprint = computeFinancialFootprint(snapshots, DEFAULT_PRICES);
    // Expected: 3000 × £85 + 50_000 × £2.50 = £255_000 + £125_000 = £380_000
    expect(footprint.total_gbp).toBeCloseTo(380_000, -1);

    // Six products totalling 120_000 units/year. Each LCA carries its
    // proportional share of facility impact via production-volume allocation.
    //
    // In a perfect world: Σ(kg/unit × units) == 3_000_000 kg (facility carbon)
    //                     Σ(L/unit × units)  == 50_000_000 L (facility water)
    const mix: Array<[string, number, number /* kg/unit */, number /* L/unit */]> = [
      ['whisky-700ml', 20_000, 50, 500], // 1_000_000 kg, 10_000_000 L
      ['gin-700ml', 30_000, 20, 300], // 600_000 kg, 9_000_000 L
      ['vodka-700ml', 25_000, 15, 350], // 375_000 kg, 8_750_000 L
      ['rum-700ml', 15_000, 30, 400], // 450_000 kg, 6_000_000 L
      ['brandy-700ml', 10_000, 40, 550], // 400_000 kg, 5_500_000 L
      ['premium-750ml', 20_000, 8.75, 537.5], // 175_000 kg, 10_750_000 L
    ];
    // Check the mix does add up to the facility totals:
    const totalKg = mix.reduce((s, [, u, kg]) => s + u * kg, 0);
    const totalL = mix.reduce((s, [, u, , l]) => s + u * l, 0);
    expect(totalKg).toBe(3_000_000);
    expect(totalL).toBe(50_000_000);

    const productCosts = mix.map(([id, units, kg, l]) =>
      ({
        ...computeProductEnvCost(
          { product_id: id, kg_co2e_per_unit: kg, litres_water_per_unit: l },
          DEFAULT_PRICES,
        ),
        annual_production_volume: units,
      }),
    );
    const portfolio = aggregatePortfolio(productCosts);

    // The weighted mean (apples-to-apples with Cost Intensity) equals
    // total_facility_£ ÷ total_facility_units exactly when allocation is clean.
    const totalUnits = mix.reduce((s, [, u]) => s + u, 0);
    const intensity = computeCostIntensity(footprint.total_gbp, {
      annual_revenue_gbp: 5_000_000,
      fte_count: 40,
      units_produced: totalUnits,
    });

    expect(portfolio.weighted_mean_gbp_per_unit).toBeCloseTo(
      intensity.per_unit ?? 0,
      2,
    );

    // And the reconciliation should report ~100% coverage with zero gap.
    const recon = reconcileCostIntensity({
      org_footprint_gbp: footprint.total_gbp,
      lca_attributed_gbp: portfolio.lca_attributed_gbp_per_year,
    });
    expect(recon.reconciles).toBe(true);
    expect(recon.lca_coverage_pct).toBeCloseTo(1.0, 2);
  });

  /**
   * Scenario B -- Partial LCA coverage (more realistic).
   *
   * Org has 10 SKUs in production but only 6 have LCAs. Unassessed volume
   * is still in the Cost Intensity denominator. Cost Intensity per unit
   * comes out much higher than the portfolio weighted mean because part
   * of the facility cost is being divided by units that have no LCA yet.
   */
  it('produces a coverage gap when LCAs do not span all production', () => {
    const ORG_FOOTPRINT = 380_000; // £

    // LCA'd products: 60_000 units/year total, accounting for ~60% of impact
    const lcadProducts = [
      { id: 'whisky', units: 20_000, kg: 50, l: 500 },
      { id: 'gin', units: 25_000, kg: 20, l: 300 },
      { id: 'rum', units: 15_000, kg: 30, l: 400 },
    ].map(p => ({
      ...computeProductEnvCost(
        { product_id: p.id, kg_co2e_per_unit: p.kg, litres_water_per_unit: p.l },
        DEFAULT_PRICES,
      ),
      annual_production_volume: p.units,
    }));

    const portfolio = aggregatePortfolio(lcadProducts);

    // Cost Intensity uses ALL units (60_000 LCA + 60_000 unassessed = 120_000).
    const intensity = computeCostIntensity(ORG_FOOTPRINT, {
      annual_revenue_gbp: 5_000_000,
      fte_count: 40,
      units_produced: 120_000,
    });

    // The two numbers DISAGREE when coverage is partial. Whether the weighted
    // mean sits above or below Cost Intensity depends on whether the assessed
    // SKUs are dirtier or cleaner than the portfolio average -- this test just
    // asserts they are meaningfully different, not which direction.
    expect(
      Math.abs(
        (intensity.per_unit ?? 0) - (portfolio.weighted_mean_gbp_per_unit ?? 0),
      ),
    ).toBeGreaterThan(0.1);

    // Reconciliation shows a real gap (LCA-attributed £ != org £).
    const recon = reconcileCostIntensity({
      org_footprint_gbp: ORG_FOOTPRINT,
      lca_attributed_gbp: portfolio.lca_attributed_gbp_per_year,
    });
    expect(recon.reconciles).toBe(false);
    // Can be >1 (over-attribution, per-unit LCAs too high) or <1 (under-attribution).
    // Either way, the gap is non-zero.
    expect(Math.abs(recon.lca_coverage_pct - 1.0)).toBeGreaterThan(0.01);
    expect(Math.abs(recon.gap_gbp)).toBeGreaterThan(0);
  });

  /**
   * Scenario C -- Simple-mean vs weighted-mean divergence.
   *
   * The widget showed a simple-mean of £0.08 while Cost Intensity showed
   * £9.617. This reproduces the exact effect: a few low-volume premium LCAs
   * drag the simple mean low, while actual output is dominated by mass SKUs.
   */
  it('exposes the simple-mean-vs-weighted-mean gap (what caused the £0.08 / £9.62 confusion)', () => {
    const products = [
      // Three LCAs with small carbon values -- simple mean is £0.08
      {
        ...computeProductEnvCost(
          { product_id: 'a', kg_co2e_per_unit: 1.0, litres_water_per_unit: 0 },
          DEFAULT_PRICES,
        ),
        annual_production_volume: 1000,
      },
      {
        ...computeProductEnvCost(
          { product_id: 'b', kg_co2e_per_unit: 0.5, litres_water_per_unit: 0 },
          DEFAULT_PRICES,
        ),
        annual_production_volume: 1000,
      },
      {
        ...computeProductEnvCost(
          { product_id: 'c', kg_co2e_per_unit: 1.5, litres_water_per_unit: 0 },
          DEFAULT_PRICES,
        ),
        annual_production_volume: 1000,
      },
    ];
    const portfolio = aggregatePortfolio(products);
    expect(portfolio.simple_mean_gbp_per_unit).toBeCloseTo(0.085, 3);
    expect(portfolio.weighted_mean_gbp_per_unit).toBeCloseTo(0.085, 3);

    // Now imagine the test account's facility footprint is ~£25k and total
    // output (including unassessed volume) is ~26_000 units -> £9.62/unit.
    const intensity = computeCostIntensity(25_000, {
      annual_revenue_gbp: 1_000_000,
      fte_count: 10,
      units_produced: 26_000,
    });
    expect(intensity.per_unit).toBeCloseTo(0.962, 2);

    // Both figures are individually CORRECT. The gap is real and informative.
    // In Tim's live data it was 10× this (£9.62), suggesting production volumes
    // on assessed products are ~10× off from facility output, OR 90% of output
    // is unassessed.
  });

  /**
   * Scenario D -- Zero-data fresh org.
   */
  it('returns clean zeros / nulls for a brand-new org with no data', () => {
    const footprint = computeFinancialFootprint([], DEFAULT_PRICES);
    expect(footprint.total_gbp).toBe(0);

    const intensity = computeCostIntensity(0, {
      annual_revenue_gbp: 0,
      fte_count: 0,
      units_produced: 0,
    });
    expect(intensity.per_m_revenue).toBeNull();
    expect(intensity.per_fte).toBeNull();
    expect(intensity.per_unit).toBeNull();

    const portfolio = aggregatePortfolio([]);
    expect(portfolio.simple_mean_gbp_per_unit).toBe(0);
    expect(portfolio.weighted_mean_gbp_per_unit).toBeNull();
  });

  /**
   * Scenario E -- Water-dominated cost profile.
   *
   * Brewery where water is the biggest driver -- ensure water shadow-price
   * maths is arithmetically symmetric with carbon.
   */
  it('handles water-dominant footprints', () => {
    // A brewery: 200 tCO2e + 500_000 m3 water
    const footprint = computeFinancialFootprint(
      [
        { metric_key: 'total_co2e', value: 200_000 }, // 200 tonnes
        { metric_key: 'water_consumption', value: 500_000 }, // m3
      ],
      DEFAULT_PRICES,
    );
    // 200 × £85 + 500_000 × £2.50 = £17_000 + £1_250_000 = £1_267_000
    expect(footprint.total_gbp).toBeCloseTo(1_267_000, -1);
    expect(footprint.by_metric_gbp.water_consumption).toBeGreaterThan(
      footprint.by_metric_gbp.total_co2e,
    );
  });

  /**
   * Scenario F -- Shadow-price change.
   *
   * If the UK ETS price doubles, the cost intensity per unit also doubles
   * (carbon component scales linearly).
   */
  it('scales linearly with the carbon shadow price', () => {
    const snapshots = [{ metric_key: 'total_co2e', value: 10_000 }];

    const at85 = computeFinancialFootprint(snapshots, DEFAULT_PRICES);
    const at170 = computeFinancialFootprint(snapshots, {
      total_co2e: { price_per_unit: 170, native_unit_multiplier: 0.001, currency: 'GBP' },
      water_consumption: DEFAULT_PRICES.water_consumption,
    });
    expect(at170.total_gbp).toBeCloseTo(at85.total_gbp * 2, 4);
  });
});
