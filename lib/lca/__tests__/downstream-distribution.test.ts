/**
 * The distribution stage, with the factor lookup stubbed.
 *
 * Distribution is the one downstream stage that reaches outside the process:
 * `calculateTransportEmissions` fetches a DEFRA freight factor through the
 * BROWSER Supabase client. Every other downstream test therefore sees
 * distribution as zero, and the end-to-end verification script sees zero too,
 * because neither is a signed-in browser (the SELECT policies on
 * staging_emission_factors are scoped to the `authenticated` role, verified
 * directly: authenticated reads the global factor, anon reads nothing).
 *
 * That left the stage that varies MOST between channels as the least covered.
 * Stubbing the client at the module boundary closes it: the arithmetic, the
 * per-leg walk and the channel difference are all exercised for real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const TRUCK_FACTOR = 0.10749; // DEFRA 2025, kg CO2e per tonne-km

vi.mock('../../supabase/browser-client', () => ({
  getSupabaseBrowserClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { co2_factor: TRUCK_FACTOR, source: 'DEFRA 2025', metadata: {} },
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
}));

const { computeDownstreamStages } = await import('../downstream-stages');
const { presetConfigsFor } = await import('../scenarios');

const BASE = {
  boundary: 'cradle-to-shelf',
  materials: [] as any[],
  volumeLitres: 0.7,
};

describe('distribution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('computes tonne-kilometres per leg and sums them', async () => {
    const r = await computeDownstreamStages({
      ...BASE,
      distributionConfig: {
        legs: [
          { id: 'a', label: 'Factory to depot', transportMode: 'truck', distanceKm: 200 },
          { id: 'b', label: 'Depot to shop', transportMode: 'truck', distanceKm: 150 },
        ],
        productWeightKg: 1.2,
      },
    });

    // 1.2 kg = 0.0012 t. (0.0012 x 200 + 0.0012 x 150) x 0.10749
    // Compared at 6 dp, not exactly: calculateTransportEmissions rounds EACH
    // leg with Number(emissions.toFixed(6)) before summing, so the total
    // carries per-leg rounding. Immaterial at kg CO2e scale, but it means
    // distribution is not perfectly linear (see the next test).
    const expected = 0.0012 * 200 * TRUCK_FACTOR + 0.0012 * 150 * TRUCK_FACTOR;
    expect(r.distribution.total).toBeCloseTo(expected, 6);
    expect(r.distribution.perLeg).toHaveLength(2);
    expect(r.distribution.perLeg[0].emissions).toBeGreaterThan(r.distribution.perLeg[1].emissions);
  });

  it('scales with weight and distance, so a heavier or further product costs more', async () => {
    const light = await computeDownstreamStages({
      ...BASE,
      distributionConfig: { legs: [{ id: 'a', label: 'l', transportMode: 'truck', distanceKm: 100 }], productWeightKg: 0.5 },
    });
    const heavy = await computeDownstreamStages({
      ...BASE,
      distributionConfig: { legs: [{ id: 'a', label: 'l', transportMode: 'truck', distanceKm: 100 }], productWeightKg: 1.0 },
    });

    // Doubling the weight doubles the emissions, but only to within the per-leg
    // rounding: 0.5 kg over 100 km is 0.0053745, stored as 0.005375, so twice
    // that overshoots the true 0.010749 by a full unit in the 6th decimal.
    // The bound is therefore 1e-6 per leg, not zero. Asserted explicitly rather
    // than loosened until green, so the rounding stays visible.
    expect(Math.abs(heavy.distribution.total - light.distribution.total * 2)).toBeLessThanOrEqual(1e-6);
  });

  it('separates a local bar run from national retail distribution', async () => {
    // The user's original problem, in one assertion: same bottle, same weight,
    // two journeys, two numbers.
    const weight = { usePhaseConfig: null, eolConfig: null, productWeightKg: 1.2 };
    const bar = await computeDownstreamStages({
      ...BASE,
      distributionConfig: presetConfigsFor('on_trade', weight as any).distribution_config,
    });
    const retail = await computeDownstreamStages({
      ...BASE,
      distributionConfig: presetConfigsFor('off_trade_retail', weight as any).distribution_config,
    });

    expect(bar.distribution.total).toBeGreaterThan(0);
    // On-trade preset is a single 50 km local leg; retail is 200 + 150 km.
    expect(retail.distribution.total).toBeGreaterThan(bar.distribution.total);
    expect(bar.distribution.perLeg).toHaveLength(1);
    expect(retail.distribution.perLeg).toHaveLength(2);
  });

  it('is excluded entirely at cradle-to-gate', async () => {
    const r = await computeDownstreamStages({
      ...BASE,
      boundary: 'cradle-to-gate',
      distributionConfig: { legs: [{ id: 'a', label: 'l', transportMode: 'truck', distanceKm: 500 }], productWeightKg: 1.2 },
    });
    expect(r.distribution.total).toBe(0);
  });

  it('reports a zero-weight configuration as zero rather than throwing', async () => {
    // productWeightKg is auto-filled from materials and can legitimately be 0
    // before a recipe exists. A born-with-a-footprint product must not crash.
    const r = await computeDownstreamStages({
      ...BASE,
      distributionConfig: { legs: [{ id: 'a', label: 'l', transportMode: 'truck', distanceKm: 100 }], productWeightKg: 0 },
    });
    expect(r.distribution.total).toBe(0);
    expect(r.warnings).toHaveLength(0);
  });
});
