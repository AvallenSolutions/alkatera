/**
 * Cradle-to-Grave LCA Aggregator Integration Test
 *
 * Tests the complete cradle-to-grave calculation flow verifying:
 * 1. Raw material emissions are correctly aggregated
 * 2. Packaging emissions are segregated from raw materials
 * 3. Use-phase emissions are added (refrigeration + carbonation)
 * 4. End-of-life emissions are added ONLY for packaging (not ingredients)
 * 5. Recycling credits are reflected as negative EoL emissions
 * 6. Total = rawMaterials + packaging + processing + usePhase + EoL
 * 7. Material breakdown by_material matches total_climate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AggregationResult } from '../product-lca-aggregator';

// ============================================================================
// SUPABASE MOCK
// ============================================================================

// Distribution reaches for the browser client to look up a DEFRA freight factor
// in staging_emission_factors. Pinning the factor here (the seeded DEFRA 2025
// values) keeps the leg arithmetic — kg → tonnes × km × factor — under test
// instead of stubbing the whole distribution stage out.
const DEFRA_FREIGHT_FACTORS: Record<string, number> = {
  'Freight - Road (HGV, Average laden)': 0.062,
  'Freight - Sea (Container ship, Average)': 0.011,
};

vi.mock('../supabase/browser-client', () => ({
  getSupabaseBrowserClient: () => ({
    from: () => {
      let factorName = '';
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (_col: string, value: string) => {
          if (value in DEFRA_FREIGHT_FACTORS) factorName = value;
          return chain;
        },
        maybeSingle: async () => ({
          data: factorName
            ? { co2_factor: DEFRA_FREIGHT_FACTORS[factorName], source: 'DEFRA 2025', metadata: {} }
            : null,
          error: null,
        }),
      };
      return chain;
    },
  }),
}));

const mockSupabaseClient = {
  from: vi.fn(),
};

function createQueryMock(response: { data: unknown; error: unknown }) {
  const mock: Record<string, unknown> = {};
  const chainable = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'ilike', 'lte', 'gte', 'order', 'limit', 'in'];
  chainable.forEach(m => { mock[m] = vi.fn().mockReturnValue(mock); });
  mock.single = vi.fn().mockResolvedValue(response);
  mock.maybeSingle = vi.fn().mockResolvedValue(response);
  mock.then = (resolve: (r: typeof response) => void) => {
    resolve(response);
    return Promise.resolve(response);
  };
  return mock;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const MALT_INGREDIENT = {
  id: 'mat-malt',
  material_name: 'Pale Malt',
  material_type: 'ingredient',
  category_type: 'MANUFACTURING_MATERIAL',
  quantity: 0.5, // kg per unit
  unit: 'kg',
  impact_climate: 0.450,       // 0.9 kg CO2e/kg × 0.5 kg
  impact_climate_fossil: 0.400,
  impact_climate_biogenic: 0.050,
  impact_climate_dluc: 0,
  impact_transport: 0.010,
  impact_water: 5.0,
  impact_water_scarcity: 2.0,
  impact_land: 0.3,
  impact_waste: 0.01,
  impact_terrestrial_ecotoxicity: 0,
  impact_freshwater_eutrophication: 0.001,
  impact_terrestrial_acidification: 0.002,
  impact_fossil_resource_scarcity: 0.05,
  confidence_score: 70,
  ch4_kg: 0,
  n2o_kg: 0,
};

const ALUMINIUM_CAN_PACKAGING = {
  id: 'mat-can',
  material_name: 'Aluminium Can 330ml',
  material_type: 'packaging',
  category_type: 'MANUFACTURING_MATERIAL',
  packaging_category: 'aluminium',
  quantity: 0.015, // kg aluminium per can
  unit: 'kg',
  impact_climate: 0.225,       // ~15 kg CO2e/kg × 0.015 kg
  impact_climate_fossil: 0.220,
  impact_climate_biogenic: 0.005,
  impact_climate_dluc: 0,
  impact_transport: 0.005,
  impact_water: 1.0,
  impact_water_scarcity: 0.4,
  impact_land: 0.02,
  impact_waste: 0.001,
  impact_terrestrial_ecotoxicity: 0,
  impact_freshwater_eutrophication: 0,
  impact_terrestrial_acidification: 0.001,
  impact_fossil_resource_scarcity: 0.02,
  confidence_score: 80,
  ch4_kg: 0,
  n2o_kg: 0,
};

// EoL factors: aluminium recycled at 70% → net negative impact (avoided burden)
// At EU rates, aluminium recycling credit is significant
const MOCK_EOL_CONFIG = {
  region: 'eu' as const,
  pathways: {
    aluminium: { recycling: 70, landfill: 15, incineration: 10, composting: 5 },
  },
};

// Use-phase: 330ml can, beer stored refrigerated 7 days.
//
// Both field names here were once wrong and both failed silently:
//   - `retailFraction` is not a UsePhaseConfig field (it is
//     `retailRefrigerationSplit`), so the retail/domestic chiller split fell
//     back to its 0.5 default and happened to match by luck.
//   - `carbonationType: 'beer_cider'` is not a member of the union
//     ('beer' | 'sparkling_wine' | 'soft_drink'). CARBONATION_FACTORS had no
//     such key, so carbonation resolved to ZERO and the fossil/biogenic
//     carbonation split this fixture exists to exercise was never exercised.
// Fixed to the real field names so the numbers below are the real numbers.
const MOCK_USE_PHASE_CONFIG = {
  needsRefrigeration: true,
  refrigerationDays: 7,
  retailRefrigerationSplit: 0.5,
  consumerCountryCode: 'GB',
  isCarbonated: true,
  carbonationType: 'beer' as const,
};

// Product (330ml volume for use-phase calculation)
const MOCK_PRODUCT = {
  unit_size_value: 330,
  unit_size_unit: 'ml',
};

// Distribution: a national two-leg journey for a 545 g packed unit
// (330 ml liquid + 15 g can). Shaped like the DISTRIBUTION_SCENARIOS.national
// preset so the numbers below stay recognisable against the wizard.
const MOCK_DISTRIBUTION_CONFIG = {
  productWeightKg: 0.545,
  legs: [
    { id: 'leg-1', label: 'Factory to distribution centre', transportMode: 'truck' as const, distanceKm: 200 },
    { id: 'leg-2', label: 'Distribution centre to retail', transportMode: 'truck' as const, distanceKm: 150 },
  ],
};

// PCF record
const MOCK_PCF = {
  product_id: 'prod-beer-001',
  organization_id: 'org-001',
  system_boundary: 'cradle-to-grave',
};

// ============================================================================
// GOLDEN VALUES
// ============================================================================

/**
 * CAPTURED, NOT HAND-DERIVED.
 *
 * Every number below was read straight out of `aggregateProductImpacts` running
 * against the fixtures in this file (capture run 2026-07-22, redesign branch,
 * on top of the downstream-stage extraction in `lib/lca/downstream-stages.ts`).
 * They are a photograph of what the engine actually produces, not a target it
 * is being asked to hit — so a failure here means the engine moved, and the
 * only correct response is to work out WHY before re-capturing.
 *
 * Why exact values: this suite used to assert downstream stages only
 * directionally (`toBeGreaterThan(0)`, `not.toBe(0)`, `abs(...) < 0.1`). A
 * mutation inflating end-of-life by 50% passed all 102 tests across the
 * aggregator suites, so value drift in distribution, use phase and end of life
 * was invisible to CI. `lib/lca/__tests__/downstream-stages.test.ts` set the
 * pattern; this file follows it.
 *
 * Fixture basis: 0.5 kg Pale Malt + a 15 g aluminium can, 330 ml, GB grid,
 * 7 days chilled at a 50/50 retail/domestic split, beer carbonation, EU
 * end-of-life at 70/15/10/5 for aluminium, two truck legs totalling 350 km at
 * 545 g packed weight.
 */
const GOLDEN = {
  'cradle-to-gate': {
    distribution: 0,
    use_phase: 0,
    end_of_life: 0,
    raw_materials: 0.46,
    packaging: 0.23,
    total: 0.6900000000000001,
    fossil: 0.635,
    biogenic: 0.055,
  },
  'cradle-to-shelf': {
    distribution: 0.011827,
    use_phase: 0.0015205806, // retail chiller share only: no consumer fridge, no carbonation
    end_of_life: 0,
    raw_materials: 0.46,
    packaging: 0.23,
    total: 0.7033475806000001,
    fossil: 0.6483475806000001,
    biogenic: 0.055,
  },
  'cradle-to-consumer': {
    distribution: 0.011827,
    use_phase: 0.004871723200000001, // retail + domestic chiller + 2.5 g carbonation
    end_of_life: 0,
    raw_materials: 0.46,
    packaging: 0.23,
    total: 0.7066987232,
    fossil: 0.6491987232,
    biogenic: 0.0575, // 0.055 material + 0.0025 biogenic fermentation CO2
  },
  'cradle-to-grave': {
    distribution: 0.011827,
    use_phase: 0.004871723200000001,
    end_of_life: 0.00011774999999999999, // cut-off: gross disposal only, no recycling credit
    raw_materials: 0.46,
    packaging: 0.23,
    total: 0.7068164732000001,
    fossil: 0.6493164732000001,
    biogenic: 0.0575,
  },
} as const;

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Cradle-to-Grave LCA Aggregator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset from mock
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'product_carbon_footprint_materials') {
        return createQueryMock({
          data: [MALT_INGREDIENT, ALUMINIUM_CAN_PACKAGING],
          error: null,
        });
      }
      if (table === 'product_carbon_footprints') {
        return createQueryMock({ data: MOCK_PCF, error: null });
      }
      if (table === 'products') {
        return createQueryMock({ data: MOCK_PRODUCT, error: null });
      }
      if (table === 'aggregated_impacts') {
        return createQueryMock({ data: null, error: null });
      }
      // Default: return empty
      return createQueryMock({ data: null, error: null });
    });
  });

  it('aggregates raw material and packaging emissions separately', async () => {
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result: AggregationResult = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-gate',
      undefined,
      undefined,
    );

    expect(result.success).toBe(true);

    const breakdown = result.impacts?.breakdown;
    expect(breakdown).toBeDefined();

    // Raw materials should be malt only
    const rawMats = breakdown?.by_lifecycle_stage?.raw_materials ?? 0;
    const packaging = breakdown?.by_lifecycle_stage?.packaging ?? 0;

    // Inbound transport rides with each material's stage bucket, added once
    expect(rawMats).toBeCloseTo(0.450 + 0.010, 3);
    expect(packaging).toBeCloseTo(0.225 + 0.005, 3);
  });

  it('includes use-phase emissions for cradle-to-consumer boundary', async () => {
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result: AggregationResult = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-consumer',
      MOCK_USE_PHASE_CONFIG,
      undefined,
    );

    expect(result.success).toBe(true);

    const usePhase = result.impacts?.breakdown?.by_lifecycle_stage?.use_phase ?? 0;
    // Refrigerated carbonated beer: exact value, not merely "> 0". Without a
    // distributionConfig here the stage is use phase only, so this is the same
    // number as GOLDEN['cradle-to-consumer'].
    expect(usePhase).toBe(GOLDEN['cradle-to-consumer'].use_phase);

    // Total should be more than just material emissions
    const materialOnly = MALT_INGREDIENT.impact_climate + ALUMINIUM_CAN_PACKAGING.impact_climate;
    expect(result.total_carbon_footprint).toBeGreaterThan(materialOnly);
  });

  it('applies EoL only to packaging — not to malt ingredient', async () => {
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');

    // Compare cradle-to-gate vs cradle-to-grave to isolate EoL contribution
    const gateResult: AggregationResult = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-gate',
      undefined,
      undefined,
    );

    vi.clearAllMocks();
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'product_carbon_footprint_materials') {
        return createQueryMock({ data: [MALT_INGREDIENT, ALUMINIUM_CAN_PACKAGING], error: null });
      }
      if (table === 'product_carbon_footprints') {
        return createQueryMock({ data: MOCK_PCF, error: null });
      }
      if (table === 'products') {
        return createQueryMock({ data: MOCK_PRODUCT, error: null });
      }
      return createQueryMock({ data: null, error: null });
    });

    const graveResult: AggregationResult = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-grave',
      MOCK_USE_PHASE_CONFIG,
      MOCK_EOL_CONFIG,
    );

    expect(graveResult.success).toBe(true);
    expect(gateResult.success).toBe(true);

    const eolEmissions = graveResult.impacts?.breakdown?.by_lifecycle_stage?.end_of_life ?? 0;

    // Exact: 15 g of aluminium disposed on the EU 70/15/10/5 split under
    // cut-off. `abs(...) < 0.1` used to pass here, which meant a 50% inflation
    // of the whole stage still looked fine — the malt-exclusion claim this test
    // makes was never actually being checked.
    expect(eolEmissions).toBe(GOLDEN['cradle-to-grave'].end_of_life);

    // And the gate control has none of it at all.
    expect(gateResult.impacts?.breakdown?.by_lifecycle_stage?.end_of_life).toBe(0);
  });

  it('stage breakdown is internally consistent: each stage contribution is non-negative for normal materials', async () => {
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result: AggregationResult = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-grave',
      MOCK_USE_PHASE_CONFIG,
      MOCK_EOL_CONFIG,
    );

    expect(result.success).toBe(true);

    const stages = result.impacts?.breakdown?.by_lifecycle_stage;
    expect(stages).toBeDefined();

    // Raw materials and packaging should be positive (they have emissions)
    expect(stages!.raw_materials).toBe(GOLDEN['cradle-to-grave'].raw_materials);
    expect(stages!.packaging).toBe(GOLDEN['cradle-to-grave'].packaging);

    // Use phase: refrigeration for 7 days plus carbonation release.
    expect(stages!.use_phase).toBe(GOLDEN['cradle-to-grave'].use_phase);

    // End-of-life defaults to CUT-OFF allocation (no recycling credit): the
    // recycled-content benefit is claimed once, on the input side, so EoL is
    // gross disposal emissions only and must be non-negative. Avoided-burden
    // is now an explicit opt-in via eolConfig.allocationMethod.
    expect(stages!.end_of_life).toBe(GOLDEN['cradle-to-grave'].end_of_life);
    expect(stages!.end_of_life).toBeGreaterThan(0);

    // Total is reported separately and doesn't need to exactly equal stage sum
    // because transport is added to stage buckets but totalClimate counts only
    // material.impact_climate (transport embedded). This is a known architectural
    // note — the stage breakdown is additive-approximate for display purposes.
    expect(result.total_carbon_footprint).toBeGreaterThan(0);
  });

  it('by_material breakdown uses climate field and materials are correctly listed', async () => {
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result: AggregationResult = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-gate',
      undefined,
      undefined,
    );

    expect(result.success).toBe(true);

    // by_material uses { name, quantity, unit, climate, source } — NOT emissions
    const byMaterial = result.impacts?.breakdown?.by_material as Array<{ name: string; climate: number; source: string }> | undefined;
    expect(byMaterial).toBeDefined();
    expect(byMaterial!.length).toBe(2);

    // Both materials should appear
    const names = byMaterial!.map(m => m.name);
    expect(names).toContain('Pale Malt');
    expect(names).toContain('Aluminium Can 330ml');

    // Climate values are impact_climate + inbound transport (counted once),
    // the same basis as the headline total
    const malt = byMaterial!.find(m => m.name === 'Pale Malt');
    const aluminium = byMaterial!.find(m => m.name === 'Aluminium Can 330ml');
    expect(malt?.climate).toBeCloseTo(0.450 + 0.010, 3);
    expect(aluminium?.climate).toBeCloseTo(0.225 + 0.005, 3);

    // Sum of by_material.climate should equal materials portion of total
    // (total also includes use-phase, EoL, facility — but cradle-to-gate has none)
    const materialSum = byMaterial!.reduce((s, m) => s + m.climate, 0);
    // totalClimate = materialClimateSum (no facility, no use-phase, no EoL for gate)
    // Transport is in stage buckets but NOT in totalClimate — so materialSum matches total
    expect(materialSum).toBeCloseTo(result.total_carbon_footprint, 3);
  });

  // ── Exact downstream stage values, per boundary ───────────────────────────

  for (const [boundary, expected] of Object.entries(GOLDEN)) {
    it(`pins every stage value at ${boundary}`, async () => {
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result: AggregationResult = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        boundary,
        MOCK_USE_PHASE_CONFIG,
        MOCK_EOL_CONFIG,
        MOCK_DISTRIBUTION_CONFIG,
      );

      expect(result.success).toBe(true);
      const stages = result.impacts!.breakdown!.by_lifecycle_stage as Record<string, number>;

      expect(stages.distribution).toBe(expected.distribution);
      expect(stages.use_phase).toBe(expected.use_phase);
      expect(stages.end_of_life).toBe(expected.end_of_life);
      expect(stages.raw_materials).toBe(expected.raw_materials);
      expect(stages.packaging).toBe(expected.packaging);
      expect(result.total_carbon_footprint).toBe(expected.total);
      expect(result.impacts!.total_climate_fossil).toBe(expected.fossil);
      expect(result.impacts!.total_climate_biogenic).toBe(expected.biogenic);
    });
  }

  it('books the whole aluminium can EoL at exact mass and pathway split', async () => {
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result: AggregationResult = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-grave',
      MOCK_USE_PHASE_CONFIG,
      MOCK_EOL_CONFIG,
      MOCK_DISTRIBUTION_CONFIG,
    );

    const rows = (result.impacts as any)?.eol_material_breakdown as any[] | undefined;
    expect(rows).toBeDefined();
    // Malt is consumed in processing, so exactly one row: the can.
    expect(rows!.length).toBe(1);
    const can = rows![0];
    expect(can.material).toBe('Aluminium Can 330ml');
    expect(can.massKg).toBe(0.015);
    expect(can.factorKey).toBe('aluminium');
    expect(can.recyclingPct).toBe(70);
    expect(can.landfillPct).toBe(15);
    expect(can.incinerationPct).toBe(10);
    expect(can.compostingPct).toBe(5);
    expect(can.allocationMethod).toBe('cut-off');
    expect(can.grossEmissions).toBe(0.00011774999999999999);
    // Cut-off claims the recycling credit on the input side, so nothing is
    // avoided here. Compared with `===` because the engine produces -0.
    expect(can.avoidedEmissions === 0).toBe(true);
    expect(can.netEmissions).toBe(0.00011774999999999999);
  });

  it('warns when use-phase config is missing for consumer boundary', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');

    await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-consumer',
      undefined, // ← deliberately missing
      undefined,
    );

    // Should warn about missing use-phase config
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('usePhaseConfig')
    );
    consoleWarnSpy.mockRestore();
  });

  it('warns when EoL config is missing for cradle-to-grave boundary', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');

    await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-grave',
      MOCK_USE_PHASE_CONFIG,
      undefined, // ← deliberately missing
    );

    // Should warn about missing EoL config
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('eolConfig')
    );
    consoleWarnSpy.mockRestore();
  });
});
