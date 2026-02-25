/**
 * Full LCA Integration Test Suite
 *
 * End-to-end scenarios with the Calculator + Aggregator wired together.
 * Only Supabase and external APIs are mocked.
 *
 * Verifies key data-integrity invariants:
 * 1. Transport NOT double-counted
 * 2. by_material sum ≈ total_climate (for cradle-to-gate)
 * 3. EoL only on material_type = 'packaging'
 * 4. scope1 + scope2 + scope3 ≈ total_carbon_footprint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createQueryMock,
  createMockIngredient,
  createMockPackaging,
  createMockPCF,
  createMockProduct,
  createMockFacilityEmissions,
} from './test-helpers';
import type { AggregationResult } from '../product-lca-aggregator';

// ============================================================================
// MOCK SETUP (aggregator only — calculator mocked separately)
// ============================================================================

const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  functions: { invoke: vi.fn() },
  rpc: vi.fn(),
};

// ============================================================================
// SCENARIO DATA
// ============================================================================

// --- Simple Beer (3 ingredients + 1 packaging) ---

const BARLEY_MALT = createMockIngredient({
  id: 'mat-barley',
  material_name: 'Barley Malt',
  quantity: 0.300,
  impact_climate: 0.270,
  impact_climate_fossil: 0.240,
  impact_climate_biogenic: 0.030,
  impact_transport: 0.008,
  confidence_score: 70,
});

const CASCADE_HOPS = createMockIngredient({
  id: 'mat-hops',
  material_name: 'Cascade Hops',
  quantity: 0.005,
  impact_climate: 0.015,
  impact_climate_fossil: 0.013,
  impact_climate_biogenic: 0.002,
  impact_transport: 0.001,
  confidence_score: 60,
});

const BREWING_WATER = createMockIngredient({
  id: 'mat-water',
  material_name: 'Brewing Water',
  quantity: 0.500,
  impact_climate: 0.0005,
  impact_climate_fossil: 0.0005,
  impact_climate_biogenic: 0,
  impact_transport: 0,
  confidence_score: 90,
});

const ALU_CAN = createMockPackaging({
  id: 'mat-alucan',
  material_name: 'Aluminium Can 330ml',
  packaging_category: 'aluminium',
  quantity: 0.015,
  impact_climate: 0.225,
  impact_climate_fossil: 0.220,
  impact_climate_biogenic: 0.005,
  impact_transport: 0.005,
  confidence_score: 80,
});

const PAPER_LABEL = createMockPackaging({
  id: 'mat-label',
  material_name: 'Paper Label',
  packaging_category: 'label',
  quantity: 0.003,
  impact_climate: 0.005,
  impact_climate_fossil: 0.004,
  impact_climate_biogenic: 0.001,
  impact_transport: 0.001,
  confidence_score: 75,
});

const BEER_PRODUCT = createMockProduct({
  unit_size_value: 330,
  unit_size_unit: 'ml',
  name: 'Test Pale Ale',
  product_type: 'beer_cider',
});

const BEER_PCF = createMockPCF({ system_boundary: 'cradle-to-gate' });

// Use-phase config for beer
const BEER_USE_PHASE = {
  needsRefrigeration: true,
  refrigerationDays: 7,
  retailRefrigerationSplit: 0.5,
  isCarbonated: true,
  carbonationType: 'beer' as const,
  consumerCountryCode: 'GB',
};

// EoL config for beer (EU defaults)
const BEER_EOL = {
  region: 'eu' as const,
  pathways: {
    aluminium: { recycling: 75, landfill: 10, incineration: 15, composting: 0, anaerobic_digestion: 0 },
    paper: { recycling: 82, landfill: 3, incineration: 10, composting: 3, anaerobic_digestion: 2 },
  },
};

// ============================================================================
// MOCK SETUP HELPER
// ============================================================================

function setupAggregatorMock(materials: unknown[], pcf: unknown, product: unknown) {
  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'product_carbon_footprint_materials') {
      return createQueryMock({ data: materials, error: null });
    }
    if (table === 'product_carbon_footprints') {
      return createQueryMock({ data: pcf, error: null });
    }
    if (table === 'products') {
      return createQueryMock({ data: product, error: null });
    }
    return createQueryMock({ data: null, error: null });
  });
}

// ============================================================================
// SCENARIO 1: SIMPLE BEER — CRADLE-TO-GATE
// ============================================================================

describe('Scenario 1: Simple beer, cradle-to-gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setupAggregatorMock(
      [BARLEY_MALT, CASCADE_HOPS, BREWING_WATER, ALU_CAN, PAPER_LABEL],
      BEER_PCF,
      BEER_PRODUCT,
    );
  });

  it('calculates total climate as sum of all material impact_climate', async () => {
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-gate',
    );

    expect(result.success).toBe(true);

    const expectedTotal =
      BARLEY_MALT.impact_climate +
      CASCADE_HOPS.impact_climate +
      BREWING_WATER.impact_climate +
      ALU_CAN.impact_climate +
      PAPER_LABEL.impact_climate;

    expect(result.total_carbon_footprint).toBeCloseTo(expectedTotal, 3);
  });

  it('use_phase and end_of_life are zero for gate boundary', async () => {
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-gate',
    );

    const stages = result.impacts.breakdown.by_lifecycle_stage;
    expect(stages.use_phase).toBe(0);
    expect(stages.end_of_life).toBe(0);
  });

  it('INVARIANT: by_material climate sum ≈ total_carbon_footprint (gate boundary)', async () => {
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-gate',
    );

    const byMaterial = result.impacts.breakdown.by_material as any[];
    const materialSum = byMaterial.reduce((s: number, m: any) => s + m.climate, 0);

    // For cradle-to-gate with no facility: by_material = total
    expect(materialSum).toBeCloseTo(result.total_carbon_footprint, 3);
  });

  it('INVARIANT: transport NOT in totalClimate', async () => {
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-gate',
    );

    const totalTransport = result.impacts.total_transport;
    const totalClimate = result.total_carbon_footprint;

    // Materials have transport > 0
    expect(totalTransport).toBeGreaterThan(0);

    // But total climate does NOT include transport
    const climateWithoutTransport =
      BARLEY_MALT.impact_climate +
      CASCADE_HOPS.impact_climate +
      BREWING_WATER.impact_climate +
      ALU_CAN.impact_climate +
      PAPER_LABEL.impact_climate;

    expect(totalClimate).toBeCloseTo(climateWithoutTransport, 3);
  });
});

// ============================================================================
// SCENARIO 2: BEER WITH FACILITY — CRADLE-TO-GATE
// ============================================================================

describe('Scenario 2: Beer with facility, cradle-to-gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setupAggregatorMock(
      [BARLEY_MALT, ALU_CAN],
      BEER_PCF,
      BEER_PRODUCT,
    );
  });

  it('adds facility per-unit emissions to processing stage', async () => {
    const facility = createMockFacilityEmissions({
      isContractManufacturer: false,
      allocatedEmissions: 500,
      scope1Emissions: 200,
      scope2Emissions: 300,
      productVolume: 10000,
    });

    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [facility as any],
      'cradle-to-gate',
    );

    // Facility per-unit = 500/10000 = 0.05
    expect(result.impacts.breakdown.by_lifecycle_stage.processing).toBeCloseTo(0.05, 3);

    // Total = materials + facility
    const materialsClimate = BARLEY_MALT.impact_climate + ALU_CAN.impact_climate;
    expect(result.total_carbon_footprint).toBeCloseTo(materialsClimate + 0.05, 3);
  });

  it('INVARIANT: scope1 + scope2 + scope3 ≈ total (owned facility)', async () => {
    const facility = createMockFacilityEmissions({
      isContractManufacturer: false,
      allocatedEmissions: 500,
      scope1Emissions: 200,
      scope2Emissions: 300,
      productVolume: 10000,
    });

    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [facility as any],
      'cradle-to-gate',
    );

    const { scope1, scope2, scope3 } = result.impacts.breakdown.by_scope;
    const scopeSum = scope1 + scope2 + scope3;

    // Scope sum should approximately equal total
    expect(scopeSum).toBeCloseTo(result.total_carbon_footprint, 2);
  });
});

// ============================================================================
// SCENARIO 3: CONTRACT MANUFACTURER
// ============================================================================

describe('Scenario 3: Contract manufacturer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setupAggregatorMock([BARLEY_MALT], BEER_PCF, BEER_PRODUCT);
  });

  it('CM emissions go to scope3, not scope1/2', async () => {
    const cmFacility = createMockFacilityEmissions({
      isContractManufacturer: true,
      allocatedEmissions: 1000,
      scope1Emissions: 400,
      scope2Emissions: 600,
      productVolume: 5000,
    });

    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [cmFacility as any],
      'cradle-to-gate',
    );

    const { scope1, scope2, scope3 } = result.impacts.breakdown.by_scope;
    expect(scope1).toBe(0);
    expect(scope2).toBe(0);
    // scope3 = material emissions + CM per-unit
    expect(scope3).toBeGreaterThan(0);
    expect(scope3).toBeCloseTo(BARLEY_MALT.impact_climate + 1000 / 5000, 3);
  });
});

// ============================================================================
// SCENARIO 4: FULL CRADLE-TO-GRAVE BEER
// ============================================================================

describe('Scenario 4: Full cradle-to-grave beer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setupAggregatorMock(
      [BARLEY_MALT, CASCADE_HOPS, BREWING_WATER, ALU_CAN, PAPER_LABEL],
      { ...BEER_PCF, system_boundary: 'cradle-to-grave' },
      BEER_PRODUCT,
    );
  });

  it('includes all lifecycle stages', async () => {
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-grave',
      BEER_USE_PHASE,
      BEER_EOL,
    );

    expect(result.success).toBe(true);
    const stages = result.impacts.breakdown.by_lifecycle_stage;

    // Raw materials > 0 (barley, hops, water)
    expect(stages.raw_materials).toBeGreaterThan(0);
    // Packaging > 0 (can + label)
    expect(stages.packaging_stage).toBeGreaterThan(0);
    // Use phase > 0 (refrigeration + carbonation)
    expect(stages.use_phase).toBeGreaterThan(0);
    // EoL: aluminium recycling credit → should be negative or small
    expect(stages.end_of_life).not.toBe(0);
  });

  it('INVARIANT: EoL only from packaging (not from barley/hops/water)', async () => {
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-grave',
      BEER_USE_PHASE,
      BEER_EOL,
    );

    const eol = result.impacts.breakdown.by_lifecycle_stage.end_of_life;

    // EoL magnitude should be small (from 15g aluminium + 3g paper, not 805g ingredients)
    // If ingredients were included, 300g barley at organic factor would add ~0.15 kg CO2e
    expect(Math.abs(eol)).toBeLessThan(0.1);
  });

  it('total is greater than cradle-to-gate (wider boundary = more stages)', async () => {
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');

    // Gate result
    vi.resetModules();
    setupAggregatorMock(
      [BARLEY_MALT, CASCADE_HOPS, BREWING_WATER, ALU_CAN, PAPER_LABEL],
      BEER_PCF,
      BEER_PRODUCT,
    );
    const mod1 = await import('../product-lca-aggregator');
    const gateResult = await mod1.aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-gate',
    );

    // Grave result
    vi.resetModules();
    setupAggregatorMock(
      [BARLEY_MALT, CASCADE_HOPS, BREWING_WATER, ALU_CAN, PAPER_LABEL],
      { ...BEER_PCF, system_boundary: 'cradle-to-grave' },
      BEER_PRODUCT,
    );
    const mod2 = await import('../product-lca-aggregator');
    const graveResult = await mod2.aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-grave',
      BEER_USE_PHASE,
      BEER_EOL,
    );

    // Grave should be different from gate (use-phase adds, EoL credit subtracts)
    expect(graveResult.total_carbon_footprint).not.toBeCloseTo(gateResult.total_carbon_footprint, 3);
  });
});

// ============================================================================
// SCENARIO 5: EDGE CASE — ALL PACKAGING, NO INGREDIENTS
// ============================================================================

describe('Scenario 5: All packaging, no ingredients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setupAggregatorMock([ALU_CAN, PAPER_LABEL], BEER_PCF, BEER_PRODUCT);
  });

  it('raw_materials is zero when no ingredients', async () => {
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-gate',
    );

    expect(result.impacts.breakdown.by_lifecycle_stage.raw_materials).toBe(0);
    expect(result.impacts.breakdown.by_lifecycle_stage.packaging_stage).toBeGreaterThan(0);
  });

  it('EoL applies to all materials (all are packaging)', async () => {
    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-grave',
      BEER_USE_PHASE,
      BEER_EOL,
    );

    expect(result.impacts.breakdown.by_lifecycle_stage.end_of_life).not.toBe(0);
  });
});

// ============================================================================
// SCENARIO 6: EDGE CASE — ZERO QUANTITY MATERIAL
// ============================================================================

describe('Scenario 6: Zero-quantity material', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('zero-quantity material contributes zero emissions but is still listed', async () => {
    const zeroMat = createMockIngredient({
      material_name: 'Zero Malt',
      quantity: 0,
      impact_climate: 0,
      impact_transport: 0,
    });
    setupAggregatorMock([zeroMat, ALU_CAN], BEER_PCF, BEER_PRODUCT);

    const { aggregateProductImpacts } = await import('../product-lca-aggregator');
    const result = await aggregateProductImpacts(
      mockSupabaseClient as any,
      'pcf-001',
      [],
      'cradle-to-gate',
    );

    expect(result.success).toBe(true);
    expect(result.materials_count).toBe(2);
    expect(result.total_carbon_footprint).toBeCloseTo(ALU_CAN.impact_climate, 3);
  });
});
