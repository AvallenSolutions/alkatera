import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CalculatePCFParams } from '../product-lca-calculator';

// ============================================================================
// MOCK SETUP (mirrors product-lca-calculator.test.ts + extra dependencies)
// ============================================================================

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  functions: {
    invoke: vi.fn(),
  },
};

vi.mock('../supabase/browser-client', () => ({
  getSupabaseBrowserClient: vi.fn(() => mockSupabaseClient),
}));

const mockResolveImpactFactors = vi.fn();
const mockNormalizeToKg = vi.fn((quantity: string | number, unit: string) => {
  const qty = typeof quantity === 'string' ? parseFloat(quantity) : quantity;
  const unitLower = unit?.toLowerCase() || 'kg';
  if (unitLower === 'g' || unitLower === 'grams') return qty / 1000;
  if (unitLower === 'ml' || unitLower === 'millilitres') return qty / 1000;
  if (unitLower === 'l' || unitLower === 'litres') return qty;
  return qty;
});

vi.mock('../impact-waterfall-resolver', () => ({
  resolveImpactFactors: (...args: unknown[]) => mockResolveImpactFactors(...args),
  normalizeToKg: (...args: unknown[]) => mockNormalizeToKg(...args),
}));

const mockCalculateTransportEmissions = vi.fn();
vi.mock('../utils/transport-emissions-calculator', () => ({
  calculateTransportEmissions: (...args: unknown[]) => mockCalculateTransportEmissions(...args),
}));

vi.mock('../utils/data-quality-mapper', () => ({
  resolveImpactSource: vi.fn(() => 'secondary_modelled'),
}));

// Mock the aggregator — called after material insertion
const mockAggregateProductImpacts = vi.fn();
vi.mock('../product-lca-aggregator', () => ({
  aggregateProductImpacts: (...args: unknown[]) => mockAggregateProductImpacts(...args),
}));

// Mock the LCA interpretation engine — called at end of calculation
const mockGenerateLcaInterpretation = vi.fn();
vi.mock('../lca-interpretation-engine', () => ({
  generateLcaInterpretation: (...args: unknown[]) => mockGenerateLcaInterpretation(...args),
}));

// Mock distance calculator — may be called during facility allocation
vi.mock('../utils/distance-calculator', () => ({
  calculateDistance: vi.fn(() => 100),
}));

// Import after mocks are set up
import { calculateProductCarbonFootprint } from '../product-lca-calculator';

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

function createMockProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-123',
    name: 'Test Whisky',
    organization_id: 'org-456',
    unit: 'kg',
    product_type: 'Spirits', // Required: maturation guard now requires explicit type match
    product_description: 'A test spirit product',
    product_image_url: null,
    unit_size_value: 700,
    unit_size_unit: 'ml',
    ...overrides,
  };
}

function createMockMaterial(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mat-001',
    product_id: 'prod-123',
    material_name: 'Malted Barley',
    material_type: 'ingredient',
    quantity: 100,
    unit: 'g',
    data_source: 'openlca',
    data_source_id: 'ds-001',
    origin_country: 'United Kingdom',
    is_organic_certified: false,
    transport_mode: null,
    distance_km: null,
    packaging_category: null,
    supplier_product_id: null,
    origin_address: null,
    origin_lat: null,
    origin_lng: null,
    origin_country_code: 'GB',
    ...overrides,
  };
}

function createMockLCA(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lca-789',
    organization_id: 'org-456',
    product_id: 123,
    product_name: 'Test Whisky',
    product_description: 'A test spirit product',
    product_image_url: null,
    functional_unit: '1 bottle of Test Whisky',
    system_boundary: 'cradle-to-gate',
    reference_year: 2026,
    lca_version: '1.0',
    lca_scope_type: 'cradle-to-gate',
    status: 'pending',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function createMockWaterfallResult(overrides: Record<string, unknown> = {}) {
  return {
    impact_climate: 1.5,
    impact_climate_fossil: 1.275,
    impact_climate_biogenic: 0.225,
    impact_climate_dluc: 0,
    ch4_kg: 0.01,
    ch4_fossil_kg: 0.008,
    ch4_biogenic_kg: 0.002,
    n2o_kg: 0.001,
    impact_water: 10,
    impact_water_scarcity: 4.2,
    impact_land: 0.5,
    impact_waste: 0.1,
    impact_ozone_depletion: 0,
    impact_photochemical_ozone_formation: 0,
    impact_ionising_radiation: 0,
    impact_particulate_matter: 0,
    impact_human_toxicity_carcinogenic: 0,
    impact_human_toxicity_non_carcinogenic: 0,
    impact_terrestrial_ecotoxicity: 0.05,
    impact_freshwater_ecotoxicity: 0,
    impact_marine_ecotoxicity: 0,
    impact_freshwater_eutrophication: 0.02,
    impact_marine_eutrophication: 0,
    impact_terrestrial_acidification: 0.03,
    impact_mineral_resource_scarcity: 0,
    impact_fossil_resource_scarcity: 0,
    data_priority: 3,
    data_quality_tag: 'Secondary_Modelled',
    data_quality_grade: 'MEDIUM',
    source_reference: 'Test Source',
    confidence_score: 70,
    methodology: 'Test Methodology',
    gwp_data_source: 'Test',
    non_gwp_data_source: 'Test',
    is_hybrid_source: false,
    category_type: 'MANUFACTURING_MATERIAL',
    ...overrides,
  };
}

function createMockMaturationProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mat-profile-001',
    product_id: 123,
    organization_id: 'org-456',
    barrel_type: 'american_oak_200',
    barrel_volume_litres: 200,
    barrel_use_number: 1,
    barrel_co2e_new: null,
    aging_duration_months: 144,
    angel_share_percent_per_year: 2.0,
    climate_zone: 'temperate',
    fill_volume_litres: 200,
    number_of_barrels: 5,
    warehouse_energy_kwh_per_barrel_year: 15,
    warehouse_energy_source: 'grid_electricity',
    allocation_method: 'cut_off',
    bottles_produced: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// TABLE MOCK SETUP
// ============================================================================

/**
 * Creates the full table mock routing needed by the LCA calculator.
 * Returns the insert mock so we can inspect what materials were inserted.
 */
function setupFullCalculatorMocks(options: {
  materials: unknown[];
  maturationProfile: unknown | null;
  productOverrides?: Record<string, unknown>;
}) {
  const insertMock = vi.fn().mockReturnValue(createQueryMock({ data: null, error: null }));

  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'products') {
      return createQueryMock({ data: createMockProduct(options.productOverrides), error: null });
    }
    if (table === 'product_materials') {
      return createQueryMock({ data: options.materials, error: null });
    }
    if (table === 'product_carbon_footprints') {
      return createQueryMock({ data: createMockLCA(), error: null });
    }
    if (table === 'maturation_profiles') {
      return createQueryMock({ data: options.maturationProfile, error: null });
    }
    if (table === 'product_carbon_footprint_materials') {
      const mock = createQueryMock({ data: null, error: null });
      mock.insert = insertMock;
      return mock;
    }
    if (table === 'contract_manufacturer_allocations') {
      return createQueryMock({ data: [], error: null });
    }
    if (table === 'product_carbon_footprint_production_sites') {
      return createQueryMock({ data: [], error: null });
    }
    return createQueryMock({ data: null, error: null });
  });

  return insertMock;
}

// ============================================================================
// MATURATION INTEGRATION TEST SUITES
// ============================================================================

describe('calculateProductCarbonFootprint — Maturation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Auth setup
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-001', email: 'test@example.com' } },
      error: null,
    });

    // Default aggregator mock — returns success
    mockAggregateProductImpacts.mockResolvedValue({
      success: true,
      total_carbon_footprint: 100,
      impacts: {},
      materials_count: 1,
      production_sites_count: 0,
    });

    // Default interpretation mock — returns success
    mockGenerateLcaInterpretation.mockResolvedValue({
      success: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // NO MATURATION PROFILE
  // ==========================================================================

  describe('No Maturation Profile', () => {
    it('should succeed when product has no maturation profile', async () => {
      setupFullCalculatorMocks({
        materials: [createMockMaterial()],
        maturationProfile: null,
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      const result = await calculateProductCarbonFootprint({ productId: 'prod-123' });

      expect(result.success).toBe(true);
    });

    it('should not inject any maturation materials when no profile exists', async () => {
      const insertMock = setupFullCalculatorMocks({
        materials: [createMockMaterial()],
        maturationProfile: null,
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      const result = await calculateProductCarbonFootprint({ productId: 'prod-123' });

      expect(result.success).toBe(true);

      // Verify that insert was called with only 1 material (no maturation)
      expect(insertMock).toHaveBeenCalled();
      const insertedMaterials = insertMock.mock.calls[0][0];
      const maturationMaterials = insertedMaterials.filter(
        (m: any) => m.material_name?.startsWith('[Maturation]')
      );
      expect(maturationMaterials.length).toBe(0);
    });
  });

  // ==========================================================================
  // WITH MATURATION PROFILE
  // ==========================================================================

  describe('With Maturation Profile', () => {
    it('should inject maturation materials when profile exists', async () => {
      const insertMock = setupFullCalculatorMocks({
        materials: [createMockMaterial()],
        maturationProfile: createMockMaturationProfile(),
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      const result = await calculateProductCarbonFootprint({ productId: 'prod-123' });

      expect(result.success).toBe(true);

      expect(insertMock).toHaveBeenCalled();
      const insertedMaterials = insertMock.mock.calls[0][0];

      const barrelAllocation = insertedMaterials.find(
        (m: any) => m.material_name === '[Maturation] Oak Barrel Allocation'
      );
      const warehouseEnergy = insertedMaterials.find(
        (m: any) => m.material_name === '[Maturation] Warehouse Energy'
      );

      expect(barrelAllocation).toBeDefined();
      expect(warehouseEnergy).toBeDefined();
    });

    it('should set correct barrel allocation impact for new American oak', async () => {
      const insertMock = setupFullCalculatorMocks({
        materials: [createMockMaterial()],
        maturationProfile: createMockMaturationProfile({
          barrel_use_number: 1,
          barrel_type: 'american_oak_200',
          number_of_barrels: 5,
        }),
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      await calculateProductCarbonFootprint({ productId: 'prod-123' });

      const insertedMaterials = insertMock.mock.calls[0][0];
      const barrelAllocation = insertedMaterials.find(
        (m: any) => m.material_name === '[Maturation] Oak Barrel Allocation'
      );

      // 40 kg CO2e × 5 barrels = 200 kg total
      // Output volume: 1000L × (1-0.02)^12 ≈ 784.7L → 784.7/0.7 ≈ 1121 bottles
      // Per bottle: 200 / 1121 ≈ 0.1784 kg
      expect(barrelAllocation.impact_climate).toBeCloseTo(200 / (1000 * Math.pow(0.98, 12) / 0.7), 2);
    });

    it('should set photochemical ozone formation from angel share on barrel material', async () => {
      const insertMock = setupFullCalculatorMocks({
        materials: [createMockMaterial()],
        maturationProfile: createMockMaturationProfile({ angel_share_percent_per_year: 5.0 }),
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      await calculateProductCarbonFootprint({ productId: 'prod-123' });

      const insertedMaterials = insertMock.mock.calls[0][0];
      const barrelAllocation = insertedMaterials.find(
        (m: any) => m.material_name === '[Maturation] Oak Barrel Allocation'
      );

      expect(barrelAllocation.impact_photochemical_ozone_formation).toBeGreaterThan(0);
    });

    it('should set correct warehouse energy impact', async () => {
      const insertMock = setupFullCalculatorMocks({
        materials: [createMockMaterial()],
        maturationProfile: createMockMaturationProfile({
          warehouse_energy_kwh_per_barrel_year: 15,
          warehouse_energy_source: 'grid_electricity',
          number_of_barrels: 5,
          aging_duration_months: 144,
        }),
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      await calculateProductCarbonFootprint({ productId: 'prod-123' });

      const insertedMaterials = insertMock.mock.calls[0][0];
      const warehouseEnergy = insertedMaterials.find(
        (m: any) => m.material_name === '[Maturation] Warehouse Energy'
      );

      // 15 kWh × 5 barrels × 12 years × 0.490 (global avg, no country code) = 441.0 kg total
      // Output volume: 1000L × (1-0.02)^12 ≈ 784.7L → 784.7/0.7 ≈ 1121 bottles
      // Per bottle: 441.0 / 1121 ≈ 0.3934 kg
      const warehouseTotalCO2e = 15 * 5 * 12 * 0.490;
      const outputVolume = 1000 * Math.pow(0.98, 12);
      const totalBottles = outputVolume / 0.7;
      expect(warehouseEnergy.impact_climate).toBeCloseTo(warehouseTotalCO2e / totalBottles, 2);
    });

    it('should set correct metadata on maturation materials', async () => {
      const insertMock = setupFullCalculatorMocks({
        materials: [createMockMaterial()],
        maturationProfile: createMockMaturationProfile(),
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      await calculateProductCarbonFootprint({ productId: 'prod-123' });

      const insertedMaterials = insertMock.mock.calls[0][0];
      const maturationMaterials = insertedMaterials.filter(
        (m: any) => m.material_name?.startsWith('[Maturation]')
      );

      for (const mat of maturationMaterials) {
        expect(mat.data_priority).toBe(3);
        expect(mat.data_quality_tag).toBe('Secondary_Estimated');
        expect(mat.impact_source).toBe('secondary_modelled');
        expect(mat.material_type).toBe('ingredient');
      }
    });

    it('should have near-zero barrel impact for reused barrels', async () => {
      const insertMock = setupFullCalculatorMocks({
        materials: [createMockMaterial()],
        maturationProfile: createMockMaturationProfile({ barrel_use_number: 2, number_of_barrels: 5 }),
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      await calculateProductCarbonFootprint({ productId: 'prod-123' });

      const insertedMaterials = insertMock.mock.calls[0][0];
      const barrelAllocation = insertedMaterials.find(
        (m: any) => m.material_name === '[Maturation] Oak Barrel Allocation'
      );

      // Reused barrel: 0.5 kg × 5 barrels = 2.5 kg total
      // Output volume: 1000L × (1-0.02)^12 ≈ 784.7L → 784.7/0.7 ≈ 1121 bottles
      // Per bottle: 2.5 / 1121 ≈ 0.00223 kg
      const outputVolume = 1000 * Math.pow(0.98, 12);
      const totalBottles = outputVolume / 0.7;
      expect(barrelAllocation.impact_climate).toBeCloseTo(2.5 / totalBottles, 4);
    });

    it('should insert correct total material count (regular + maturation)', async () => {
      const insertMock = setupFullCalculatorMocks({
        materials: [
          createMockMaterial({ id: 'mat-001', material_name: 'Malted Barley' }),
          createMockMaterial({ id: 'mat-002', material_name: 'Water' }),
        ],
        maturationProfile: createMockMaturationProfile(),
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      await calculateProductCarbonFootprint({ productId: 'prod-123' });

      const insertedMaterials = insertMock.mock.calls[0][0];

      // 2 regular materials + 2 maturation synthetic materials = 4 total
      expect(insertedMaterials.length).toBe(4);

      const maturationMaterials = insertedMaterials.filter(
        (m: any) => m.material_name?.startsWith('[Maturation]')
      );
      expect(maturationMaterials.length).toBe(2);
    });
  });

  // ==========================================================================
  // PER-BOTTLE ALLOCATION
  // ==========================================================================

  describe('Per-Bottle Allocation', () => {
    it('should use bottles_produced override when set', async () => {
      const insertMock = setupFullCalculatorMocks({
        materials: [createMockMaterial()],
        maturationProfile: createMockMaturationProfile({
          barrel_use_number: 1,
          number_of_barrels: 5,
          bottles_produced: 287,  // User override: single-cask bottling
        }),
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      await calculateProductCarbonFootprint({ productId: 'prod-123' });

      const insertedMaterials = insertMock.mock.calls[0][0];
      const barrelAllocation = insertedMaterials.find(
        (m: any) => m.material_name === '[Maturation] Oak Barrel Allocation'
      );
      const warehouseEnergy = insertedMaterials.find(
        (m: any) => m.material_name === '[Maturation] Warehouse Energy'
      );

      // 200 kg total ÷ 287 bottles = 0.6969 kg/bottle
      expect(barrelAllocation.impact_climate).toBeCloseTo(200 / 287, 3);

      // Warehouse: 15 kWh × 5 barrels × 12 years × 0.490 (global avg) = 441.0 kg total
      // 441.0 ÷ 287 bottles = 1.537 kg/bottle
      const warehouseTotalCO2e = 15 * 5 * 12 * 0.490;
      expect(warehouseEnergy.impact_climate).toBeCloseTo(warehouseTotalCO2e / 287, 2);
    });

    it('should fall back to 0.75L bottle size when product has no unit_size_value', async () => {
      // Override product to have no bottle size info
      const insertMock = vi.fn().mockReturnValue(createQueryMock({ data: null, error: null }));

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'products') {
          return createQueryMock({
            data: createMockProduct({ unit_size_value: null, unit_size_unit: null }),
            error: null,
          });
        }
        if (table === 'product_materials') {
          return createQueryMock({ data: [createMockMaterial()], error: null });
        }
        if (table === 'product_carbon_footprints') {
          return createQueryMock({ data: createMockLCA(), error: null });
        }
        if (table === 'maturation_profiles') {
          return createQueryMock({ data: createMockMaturationProfile(), error: null });
        }
        if (table === 'product_carbon_footprint_materials') {
          const mock = createQueryMock({ data: null, error: null });
          mock.insert = insertMock;
          return mock;
        }
        if (table === 'contract_manufacturer_allocations') {
          return createQueryMock({ data: [], error: null });
        }
        if (table === 'product_carbon_footprint_production_sites') {
          return createQueryMock({ data: [], error: null });
        }
        return createQueryMock({ data: null, error: null });
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      await calculateProductCarbonFootprint({ productId: 'prod-123' });

      const insertedMaterials = insertMock.mock.calls[0][0];
      const barrelAllocation = insertedMaterials.find(
        (m: any) => m.material_name === '[Maturation] Oak Barrel Allocation'
      );

      // Fallback: 0.75L bottle size → 784.7L / 0.75 ≈ 1046 bottles
      // Per bottle: 200 / 1046 ≈ 0.1912 kg
      const outputVolume = 1000 * Math.pow(0.98, 12);
      const fallbackBottles = outputVolume / 0.75;
      expect(barrelAllocation.impact_climate).toBeCloseTo(200 / fallbackBottles, 2);
    });

    it('should include per-bottle provenance in source_reference', async () => {
      const insertMock = setupFullCalculatorMocks({
        materials: [createMockMaterial()],
        maturationProfile: createMockMaturationProfile(),
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      await calculateProductCarbonFootprint({ productId: 'prod-123' });

      const insertedMaterials = insertMock.mock.calls[0][0];
      const barrelAllocation = insertedMaterials.find(
        (m: any) => m.material_name === '[Maturation] Oak Barrel Allocation'
      );

      // source_reference should contain per-bottle provenance info
      expect(barrelAllocation.source_reference).toContain('kg/bottle');
      expect(barrelAllocation.source_reference).toContain('bottles');
      expect(barrelAllocation.source_reference).toContain('700ml');
    });
  });

  // ==========================================================================
  // MIXED PRODUCT: INGREDIENTS + PACKAGING + MATURATION
  // ==========================================================================

  describe('Mixed Product: Ingredients + Packaging + Maturation', () => {
    it('should correctly handle ingredients, packaging, and maturation together', async () => {
      const insertMock = setupFullCalculatorMocks({
        materials: [
          createMockMaterial({ id: 'mat-001', material_name: 'Malted Barley', material_type: 'ingredient' }),
          createMockMaterial({ id: 'mat-002', material_name: 'Water', material_type: 'ingredient' }),
          createMockMaterial({
            id: 'mat-003',
            material_name: 'Glass Bottle',
            material_type: 'packaging',
            packaging_category: 'container',
            quantity: 350,
            unit: 'g',
          }),
        ],
        maturationProfile: createMockMaturationProfile(),
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      const result = await calculateProductCarbonFootprint({ productId: 'prod-123' });

      expect(result.success).toBe(true);

      const insertedMaterials = insertMock.mock.calls[0][0];

      // 3 regular materials + 2 maturation = 5 total
      expect(insertedMaterials.length).toBe(5);

      const regularMaterials = insertedMaterials.filter(
        (m: any) => !m.material_name?.startsWith('[Maturation]')
      );
      const maturationMaterials = insertedMaterials.filter(
        (m: any) => m.material_name?.startsWith('[Maturation]')
      );

      expect(regularMaterials.length).toBe(3);
      expect(maturationMaterials.length).toBe(2);
    });
  });
});
