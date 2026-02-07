import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AggregationResult } from '../product-lca-aggregator';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Create a mock Supabase client that we can control per-test
const mockSupabaseClient = {
  from: vi.fn(),
};

// ============================================================================
// MOCK BUILDER HELPERS
// ============================================================================

interface MockResponse {
  data: unknown;
  error: unknown;
}

function createQueryMock(response: MockResponse) {
  const mock: Record<string, unknown> = {};

  const chainableMethods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'ilike', 'lte', 'gte', 'order', 'limit', 'in'];
  chainableMethods.forEach(method => {
    mock[method] = vi.fn().mockReturnValue(mock);
  });

  mock.maybeSingle = vi.fn().mockResolvedValue(response);
  mock.single = vi.fn().mockResolvedValue(response);

  mock.then = (resolve: (r: MockResponse) => void) => {
    resolve(response);
    return Promise.resolve(response);
  };

  return mock;
}

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

function createMockMaterial(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pcf-mat-001',
    material_name: 'Test Ingredient',
    material_type: 'ingredient',
    category_type: 'MANUFACTURING_MATERIAL',
    quantity: 1.0,
    unit: 'kg',
    impact_climate: 1.5,
    impact_climate_fossil: 1.275,
    impact_climate_biogenic: 0.225,
    impact_climate_dluc: 0,
    impact_transport: 0,
    impact_water: 10,
    impact_water_scarcity: 4.2,
    impact_land: 0.5,
    impact_waste: 0.1,
    impact_terrestrial_ecotoxicity: 0.05,
    impact_freshwater_eutrophication: 0.02,
    impact_terrestrial_acidification: 0.03,
    impact_fossil_resource_scarcity: 0,
    ...overrides,
  };
}

function createMaturationBarrelMaterial(overrides: Record<string, unknown> = {}) {
  return createMockMaterial({
    id: 'pcf-mat-barrel',
    material_name: '[Maturation] Oak Barrel Allocation',
    material_type: 'ingredient',
    quantity: 784.7, // output volume after angel's share
    unit: 'L',
    impact_climate: 200, // 40 kg × 5 barrels
    impact_climate_fossil: 190,
    impact_climate_biogenic: 10,
    impact_climate_dluc: 0,
    impact_transport: 0,
    impact_water: 0,
    impact_water_scarcity: 0,
    impact_land: 0,
    impact_waste: 0,
    impact_terrestrial_ecotoxicity: 0,
    impact_freshwater_eutrophication: 0,
    impact_terrestrial_acidification: 0,
    impact_fossil_resource_scarcity: 0,
    ...overrides,
  });
}

function createMaturationWarehouseMaterial(overrides: Record<string, unknown> = {}) {
  return createMockMaterial({
    id: 'pcf-mat-warehouse',
    material_name: '[Maturation] Warehouse Energy',
    material_type: 'ingredient',
    quantity: 12, // years
    unit: 'years',
    impact_climate: 186.3, // 15 kWh × 5 barrels × 12 years × 0.207
    impact_climate_fossil: 186.3,
    impact_climate_biogenic: 0,
    impact_climate_dluc: 0,
    impact_transport: 0,
    impact_water: 0,
    impact_water_scarcity: 0,
    impact_land: 0,
    impact_waste: 0,
    impact_terrestrial_ecotoxicity: 0,
    impact_freshwater_eutrophication: 0,
    impact_terrestrial_acidification: 0,
    impact_fossil_resource_scarcity: 0,
    ...overrides,
  });
}

function createPackagingMaterial(overrides: Record<string, unknown> = {}) {
  return createMockMaterial({
    id: 'pcf-mat-pkg',
    material_name: 'Glass Bottle',
    material_type: 'packaging',
    quantity: 0.35,
    unit: 'kg',
    impact_climate: 10,
    impact_climate_fossil: 9.5,
    impact_climate_biogenic: 0.5,
    ...overrides,
  });
}

// Import after defining helpers (no module-level mock needed — we pass client as arg)
import { aggregateProductImpacts } from '../product-lca-aggregator';

// ============================================================================
// MATURATION AGGREGATOR TEST SUITES
// ============================================================================

describe('aggregateProductImpacts — Maturation Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to setup the mock client for aggregation tests
  function setupAggregatorMocks(materials: unknown[]) {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'product_carbon_footprint_materials') {
        return createQueryMock({ data: materials, error: null });
      }
      if (table === 'product_carbon_footprints') {
        return createQueryMock({
          data: { product_id: 123, organization_id: 'org-456' },
          error: null,
        });
      }
      if (table === 'products') {
        return createQueryMock({
          data: { unit_size_value: 700, unit_size_unit: 'ml', functional_unit: '1 bottle' },
          error: null,
        });
      }
      // Default: update and other tables
      return createQueryMock({ data: null, error: null });
    });
  }

  // ==========================================================================
  // MATERIAL ROUTING
  // ==========================================================================

  describe('Material Routing to Lifecycle Stages', () => {
    it('should route [Maturation] materials to processingEmissions', async () => {
      const materials = [
        createMaturationBarrelMaterial(),
        createMaturationWarehouseMaterial(),
      ];

      setupAggregatorMocks(materials);

      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001'
      );

      expect(result.success).toBe(true);
      expect(result.impacts.breakdown.by_lifecycle_stage.processing).toBeCloseTo(200 + 186.3, 1);
    });

    it('should route regular ingredients to rawMaterialsEmissions', async () => {
      const materials = [
        createMockMaterial({ impact_climate: 50 }),
      ];

      setupAggregatorMocks(materials);

      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001'
      );

      expect(result.success).toBe(true);
      expect(result.impacts.breakdown.by_lifecycle_stage.raw_materials).toBe(50);
    });

    it('should route packaging materials to packagingEmissions', async () => {
      const materials = [
        createPackagingMaterial({ impact_climate: 10 }),
      ];

      setupAggregatorMocks(materials);

      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001'
      );

      expect(result.success).toBe(true);
      expect(result.impacts.breakdown.by_lifecycle_stage.packaging_stage).toBe(10);
    });

    it('should correctly separate all three material types in mixed product', async () => {
      const ingredientImpact = 50;
      const packagingImpact = 10;
      const barrelImpact = 200;
      const warehouseImpact = 186.3;

      const materials = [
        createMockMaterial({ id: 'ing-1', material_name: 'Malted Barley', impact_climate: ingredientImpact }),
        createPackagingMaterial({ impact_climate: packagingImpact }),
        createMaturationBarrelMaterial({ impact_climate: barrelImpact }),
        createMaturationWarehouseMaterial({ impact_climate: warehouseImpact }),
      ];

      setupAggregatorMocks(materials);

      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001'
      );

      expect(result.success).toBe(true);

      const stages = result.impacts.breakdown.by_lifecycle_stage;

      // Regular ingredient → raw_materials
      expect(stages.raw_materials).toBeCloseTo(ingredientImpact, 1);

      // Packaging → packaging_stage
      expect(stages.packaging_stage).toBeCloseTo(packagingImpact, 1);

      // Maturation (barrel + warehouse) → processing
      expect(stages.processing).toBeCloseTo(barrelImpact + warehouseImpact, 1);
    });

    it('should NOT route maturation materials to rawMaterialsEmissions', async () => {
      const materials = [
        createMaturationBarrelMaterial(),
        createMaturationWarehouseMaterial(),
      ];

      setupAggregatorMocks(materials);

      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001'
      );

      expect(result.success).toBe(true);

      // Maturation should NOT appear in raw_materials
      expect(result.impacts.breakdown.by_lifecycle_stage.raw_materials).toBe(0);
    });
  });

  // ==========================================================================
  // TOTAL AGGREGATION
  // ==========================================================================

  describe('Total Aggregation', () => {
    it('should include maturation impacts in total climate', async () => {
      const barrelImpact = 200;
      const warehouseImpact = 186.3;

      const materials = [
        createMaturationBarrelMaterial({ impact_climate: barrelImpact }),
        createMaturationWarehouseMaterial({ impact_climate: warehouseImpact }),
      ];

      setupAggregatorMocks(materials);

      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001'
      );

      expect(result.success).toBe(true);

      // Total climate should include both maturation materials
      expect(result.total_carbon_footprint).toBeCloseTo(barrelImpact + warehouseImpact, 1);
    });

    it('should include all material types in total carbon footprint', async () => {
      const materials = [
        createMockMaterial({ id: 'ing-1', impact_climate: 50 }),
        createPackagingMaterial({ impact_climate: 10 }),
        createMaturationBarrelMaterial({ impact_climate: 200 }),
        createMaturationWarehouseMaterial({ impact_climate: 186.3 }),
      ];

      setupAggregatorMocks(materials);

      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001'
      );

      expect(result.success).toBe(true);

      // Total = ingredient + packaging + barrel + warehouse + end-of-life
      // (packaging has end-of-life: 0.35 × 0.05 × 0.30 = 0.00525)
      const packagingEoL = 0.35 * 0.05 * 0.30;
      expect(result.total_carbon_footprint).toBeCloseTo(
        50 + 10 + 200 + 186.3 + packagingEoL,
        0
      );
    });

    it('should report correct materials count including maturation', async () => {
      const materials = [
        createMockMaterial({ id: 'ing-1' }),
        createMaturationBarrelMaterial(),
        createMaturationWarehouseMaterial(),
      ];

      setupAggregatorMocks(materials);

      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001'
      );

      expect(result.success).toBe(true);
      expect(result.materials_count).toBe(3);
    });
  });
});
