/**
 * Characterisation test for the downstream-stage extraction.
 *
 * The numbers below were CAPTURED from the aggregator BEFORE
 * `computeDownstreamStages` existed (git 5c2ff8fc, `lib/product-lca-aggregator.ts`
 * with distribution/use-phase/EoL/loss still inline) and then reproduced
 * bit-identically by the extracted module. They are not aspirational values or
 * hand-computed expectations; they are what the engine actually produced for
 * paying customers, pinned so the scenario work cannot silently move anyone's
 * footprint.
 *
 * Why this file exists at all: the pre-existing aggregator suites assert
 * downstream stages only DIRECTIONALLY (`toBeGreaterThan(0)`, `not.toBe(0)`).
 * A mutation inflating end-of-life by 50% passed all 102 of them. Exact values
 * are the only thing that makes this refactor provable, so exact values are
 * what this file asserts.
 *
 * See `tasks/lca-end-use-scenarios-plan.md` phase 1.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeDownstreamStages } from '../downstream-stages';

// ── Mock harness (mirrors the aggregator suites) ────────────────────────────

const mockSupabaseClient = { from: vi.fn() };

function createQueryMock(response: { data: unknown; error: unknown }) {
  const mock: Record<string, unknown> = {};
  const chainable = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'ilike', 'lte', 'gte', 'order', 'limit', 'in'];
  chainable.forEach(m => { mock[m] = vi.fn().mockReturnValue(mock); });
  mock.single = vi.fn().mockResolvedValue(response);
  mock.maybeSingle = vi.fn().mockResolvedValue(response);
  mock.then = (resolve: (r: typeof response) => void) => { resolve(response); return Promise.resolve(response); };
  return mock;
}

const MALT = {
  id: 'mat-malt', material_name: 'Pale Malt', material_type: 'ingredient',
  category_type: 'MANUFACTURING_MATERIAL', quantity: 0.5, unit: 'kg',
  impact_climate: 0.45, impact_climate_fossil: 0.4, impact_climate_biogenic: 0.05,
  impact_climate_dluc: 0, impact_transport: 0.01, impact_water: 5, impact_water_scarcity: 2,
  impact_land: 0.3, impact_waste: 0.01, impact_terrestrial_ecotoxicity: 0,
  impact_freshwater_eutrophication: 0.001, impact_terrestrial_acidification: 0.002,
  impact_fossil_resource_scarcity: 0.05, confidence_score: 70, ch4_kg: 0, n2o_kg: 0,
};

const CAN = {
  id: 'mat-can', material_name: 'Aluminium Can 330ml', material_type: 'packaging',
  category_type: 'MANUFACTURING_MATERIAL', packaging_category: 'aluminium',
  container_material: 'aluminium', quantity: 0.015, unit: 'kg',
  impact_climate: 0.225, impact_climate_fossil: 0.22, impact_climate_biogenic: 0.005,
  impact_climate_dluc: 0, impact_transport: 0.005, impact_water: 1, impact_water_scarcity: 0.4,
  impact_land: 0.02, impact_waste: 0.001, impact_terrestrial_ecotoxicity: 0,
  impact_freshwater_eutrophication: 0, impact_terrestrial_acidification: 0.001,
  impact_fossil_resource_scarcity: 0.02, confidence_score: 80, ch4_kg: 0, n2o_kg: 0,
};

/** Shared secondary packaging: its EoL must be divided by units_per_group. */
const CARTON = {
  id: 'mat-carton', material_name: '4-pack carton', material_type: 'packaging',
  category_type: 'MANUFACTURING_MATERIAL', packaging_category: 'secondary',
  container_material: 'paper', units_per_group: 4, quantity: 0.08, unit: 'kg',
  impact_climate: 0.06, impact_climate_fossil: 0.05, impact_climate_biogenic: 0.01,
  impact_climate_dluc: 0, impact_transport: 0.002, impact_water: 0.5, impact_water_scarcity: 0.2,
  impact_land: 0.01, impact_waste: 0.002, impact_terrestrial_ecotoxicity: 0,
  impact_freshwater_eutrophication: 0, impact_terrestrial_acidification: 0,
  impact_fossil_resource_scarcity: 0.01, confidence_score: 60, ch4_kg: 0, n2o_kg: 0,
};

const MATERIALS = [MALT, CAN, CARTON];

const USE_PHASE = {
  needsRefrigeration: true, refrigerationDays: 7, retailFraction: 0.5,
  consumerCountryCode: 'GB', isCarbonated: true, carbonationType: 'beer_cider' as const,
};
const EOL = {
  region: 'eu' as const,
  pathways: { aluminium: { recycling: 70, landfill: 15, incineration: 10, composting: 5 } },
};
const LOSS = { distributionLossPercent: 2, retailLossPercent: 3, consumerWastePercent: 5 };
const PRODUCT = { unit_size_value: 330, unit_size_unit: 'ml' };
const VOLUME_LITRES = 0.33;

function setupAggregatorMocks(boundary: string) {
  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'product_carbon_footprint_materials') {
      return createQueryMock({ data: MATERIALS, error: null });
    }
    if (table === 'product_carbon_footprints') {
      return createQueryMock({
        data: { product_id: 'prod-001', organization_id: 'org-001', system_boundary: boundary },
        error: null,
      });
    }
    if (table === 'products') return createQueryMock({ data: PRODUCT, error: null });
    return createQueryMock({ data: null, error: null });
  });
}

/**
 * Captured from the pre-extraction aggregator. Any change to these numbers is
 * a change to a customer's published footprint and must be deliberate.
 */
const GOLDEN = {
  'cradle-to-grave': {
    total: 0.8371995451213351,
    use_phase: 0.0023717232,
    end_of_life: 0.00211275,
    raw_materials: 0.5093735812284763,
    packaging: 0.3233414906928589,
    fossil: 0.763227843426007,
    biogenic: 0.07397170169532816,
  },
  'cradle-to-shelf': {
    total: 0.7925998989252684,
    use_phase: 0.0015205806, // retail refrigeration only
    end_of_life: 0,
    raw_materials: 0.48390490216705245,
    packaging: 0.30717441615821595,
    fossil: 0.7242220323147066,
    biogenic: 0.06837786661056176,
  },
  'cradle-to-consumer': {
    total: 0.7543717232,
    use_phase: 0.0023717232,
    end_of_life: 0,
    raw_materials: 0.46,
    packaging: 0.29200000000000004,
    fossil: 0.6893717232000001,
    biogenic: 0.065,
  },
  'cradle-to-gate': {
    total: 0.752,
    use_phase: 0,
    end_of_life: 0,
    raw_materials: 0.46,
    packaging: 0.29200000000000004,
    fossil: 0.687,
    biogenic: 0.065,
  },
} as const;

describe('downstream stage extraction: the numbers do not move', () => {
  beforeEach(() => vi.clearAllMocks());

  // The loss multiplier applies only beyond the gate, so cradle-to-gate is the
  // control: identical inputs, no downstream, no upstream inflation.
  for (const [boundary, expected] of Object.entries(GOLDEN)) {
    it(`reproduces the pre-extraction footprint at ${boundary}`, async () => {
      setupAggregatorMocks(boundary);
      const { aggregateProductImpacts } = await import('../../product-lca-aggregator');
      const result: any = await aggregateProductImpacts(
        mockSupabaseClient as any, 'pcf-001', [], boundary,
        USE_PHASE, EOL, undefined,
        boundary === 'cradle-to-consumer' ? undefined : LOSS,
      );

      expect(result.success).toBe(true);
      const stages = result.impacts.breakdown.by_lifecycle_stage;

      expect(result.total_carbon_footprint).toBe(expected.total);
      expect(stages.use_phase).toBe(expected.use_phase);
      expect(stages.end_of_life).toBe(expected.end_of_life);
      expect(stages.raw_materials).toBe(expected.raw_materials);
      expect(stages.packaging).toBe(expected.packaging);
      expect(result.impacts.total_climate_fossil).toBe(expected.fossil);
      expect(result.impacts.total_climate_biogenic).toBe(expected.biogenic);
    });
  }
});

describe('computeDownstreamStages in isolation', () => {
  it('returns the same use-phase and EoL totals the aggregator reports', async () => {
    const r = await computeDownstreamStages({
      boundary: 'cradle-to-grave',
      materials: MATERIALS as any,
      volumeLitres: VOLUME_LITRES,
      usePhaseConfig: USE_PHASE,
      eolConfig: EOL,
      productLossConfig: LOSS,
    });

    expect(r.usePhase.total).toBe(GOLDEN['cradle-to-grave'].use_phase);
    expect(r.endOfLife.total).toBe(GOLDEN['cradle-to-grave'].end_of_life);
    // Upstream inflation for 2%/3%/5% losses, applied by the caller.
    expect(r.lossMultiplier).toBeGreaterThan(1);
  });

  it('gives every scenario the same core: only downstream responds to config', async () => {
    // The whole premise of end-use scenarios. Same materials, same volume, two
    // journeys: the EoL region changes the bin, nothing upstream moves.
    const bar = await computeDownstreamStages({
      boundary: 'cradle-to-grave', materials: MATERIALS as any, volumeLitres: VOLUME_LITRES,
      usePhaseConfig: USE_PHASE, eolConfig: { ...EOL, region: 'eu' },
    });
    const retailUS = await computeDownstreamStages({
      boundary: 'cradle-to-grave', materials: MATERIALS as any, volumeLitres: VOLUME_LITRES,
      usePhaseConfig: USE_PHASE, eolConfig: { ...EOL, region: 'us' },
    });

    expect(bar.usePhase.total).toBe(retailUS.usePhase.total);
    expect(bar.endOfLife.total).not.toBe(retailUS.endOfLife.total);
    expect(bar.endOfLife.breakdown.length).toBe(retailUS.endOfLife.breakdown.length);
  });

  it('applies the shared-packaging divisor to the carton, not the can', async () => {
    const r = await computeDownstreamStages({
      boundary: 'cradle-to-grave', materials: MATERIALS as any, volumeLitres: VOLUME_LITRES,
      eolConfig: EOL,
    });
    const carton = r.endOfLife.breakdown.find(b => b.material === '4-pack carton');
    const can = r.endOfLife.breakdown.find(b => b.material === 'Aluminium Can 330ml');

    // 0.08 kg carton over 4 units = 0.02 kg attributable to this one can.
    expect(carton?.massKg).toBe(0.02);
    expect(can?.massKg).toBe(0.015);
    // Ingredients never reach end of life.
    expect(r.endOfLife.breakdown.some(b => b.material === 'Pale Malt')).toBe(false);
  });

  // ISO 14067 §6.4.9 origin split. Soft drinks and most RTDs are carbonated
  // with fossil-derived industrial CO2 (an ammonia-plant by-product), while
  // fermentation CO2 in beer and sparkling wine is biogenic. Booking one as the
  // other misstates the origin split without moving the headline total, which
  // is exactly the kind of error a total-only assertion cannot see.
  it('books soft-drink carbonation as fossil', async () => {
    const r = await computeDownstreamStages({
      boundary: 'cradle-to-grave', materials: MATERIALS as any, volumeLitres: VOLUME_LITRES,
      usePhaseConfig: { ...USE_PHASE, carbonationType: 'soft_drink' } as any,
    });

    expect(r.usePhase.total).toBe(0.0046817232);
    expect(r.usePhase.climateFossilDelta).toBe(0.0046817232); // refrigeration + carbonation
    expect(r.usePhase.climateBiogenicDelta).toBe(0);
    expect(r.usePhase.co2BiogenicDelta).toBe(0);
  });

  it('books sparkling-wine carbonation as biogenic', async () => {
    const r = await computeDownstreamStages({
      boundary: 'cradle-to-grave', materials: MATERIALS as any, volumeLitres: VOLUME_LITRES,
      usePhaseConfig: { ...USE_PHASE, carbonationType: 'sparkling_wine' } as any,
    });

    // Same total as the soft drink, split differently: fermentation CO2 is
    // short-cycle carbon, so it belongs in the biogenic bucket.
    expect(r.usePhase.climateFossilDelta).toBe(0.0023717232); // refrigeration only
    expect(r.usePhase.climateBiogenicDelta).toBeGreaterThan(0);
    expect(r.usePhase.co2BiogenicDelta).toBe(r.usePhase.climateBiogenicDelta);
  });

  it('computes nothing downstream at cradle-to-gate', async () => {
    const r = await computeDownstreamStages({
      boundary: 'cradle-to-gate', materials: MATERIALS as any, volumeLitres: VOLUME_LITRES,
      usePhaseConfig: USE_PHASE, eolConfig: EOL, productLossConfig: LOSS,
    });

    expect(r.usePhase.total).toBe(0);
    expect(r.endOfLife.total).toBe(0);
    expect(r.distribution.total).toBe(0);
    expect(r.lossMultiplier).toBe(1); // losses are a beyond-the-gate concept
  });
});
