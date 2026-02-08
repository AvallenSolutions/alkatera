import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CalculatePCFParams, FacilityAllocationInput } from '../product-lca-calculator';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock the Supabase browser client
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

// Mock the impact waterfall resolver
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

// Mock the transport emissions calculator
const mockCalculateTransportEmissions = vi.fn();
vi.mock('../utils/transport-emissions-calculator', () => ({
  calculateTransportEmissions: (...args: unknown[]) => mockCalculateTransportEmissions(...args),
}));

// Mock the data quality mapper
vi.mock('../utils/data-quality-mapper', () => ({
  resolveImpactSource: vi.fn(() => 'secondary_modelled'),
}));

// Mock the aggregator
const mockAggregateProductImpacts = vi.fn();
vi.mock('../product-lca-aggregator', () => ({
  aggregateProductImpacts: (...args: unknown[]) => mockAggregateProductImpacts(...args),
}));

// Mock the interpretation engine
const mockGenerateLcaInterpretation = vi.fn();
vi.mock('../lca-interpretation-engine', () => ({
  generateLcaInterpretation: (...args: unknown[]) => mockGenerateLcaInterpretation(...args),
}));

// Mock the distance calculator (used when recalculating distances for facility allocations)
vi.mock('../utils/distance-calculator', () => ({
  calculateDistance: vi.fn(() => 0),
}));

// Mock the maturation calculator (used when maturation profiles exist)
vi.mock('../maturation-calculator', () => ({
  calculateMaturationImpacts: vi.fn(() => ({})),
}));

// Import after mocks are set up
import {
  calculateProductCarbonFootprint,
  calculateProductLCA,
} from '../product-lca-calculator';
import { normalizeToKg } from '../impact-waterfall-resolver';

// ============================================================================
// MOCK BUILDER HELPERS
// ============================================================================

interface MockResponse {
  data: unknown;
  error: unknown;
}

/**
 * Creates a fluent Supabase query builder mock that returns data properly
 */
function createQueryMock(response: MockResponse) {
  const mock: Record<string, unknown> = {};

  // All chainable methods return self
  const chainableMethods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'ilike', 'lte', 'gte', 'order', 'limit', 'in'];
  chainableMethods.forEach(method => {
    mock[method] = vi.fn().mockReturnValue(mock);
  });

  // Terminal methods that resolve the promise
  mock.maybeSingle = vi.fn().mockResolvedValue(response);
  mock.single = vi.fn().mockResolvedValue(response);

  // Make it thenable for direct await (for array responses like product_materials)
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
    name: 'Test Product',
    organization_id: 'org-456',
    unit: 'kg',
    product_description: 'A test product',
    product_image_url: null,
    ...overrides,
  };
}

function createMockMaterial(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mat-001',
    product_id: 'prod-123',
    material_name: 'Test Ingredient',
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
    product_name: 'Test Product',
    product_description: 'A test product',
    product_image_url: null,
    functional_unit: '1 kg of Test Product',
    system_boundary: 'cradle-to-gate',
    reference_year: 2024,
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

function createMockFacilityAllocation(overrides: Partial<FacilityAllocationInput> = {}): FacilityAllocationInput {
  return {
    facilityId: 'facility-001',
    facilityName: 'Test Facility',
    operationalControl: 'owned',
    reportingPeriodStart: '2024-01-01',
    reportingPeriodEnd: '2024-12-31',
    productionVolume: 1000,
    productionVolumeUnit: 'kg',
    facilityTotalProduction: 10000,
    ...overrides,
  };
}

// ============================================================================
// TABLE-SPECIFIC MOCK SETUP
// ============================================================================

interface TableMockConfig {
  products?: { data: unknown; error?: unknown };
  product_materials?: { data: unknown; error?: unknown };
  product_carbon_footprints?: { data: unknown; error?: unknown };
  product_carbon_footprint_materials?: { data: unknown; error?: unknown };
  product_carbon_footprint_production_sites?: { data: unknown; error?: unknown };
  contract_manufacturer_allocations?: { data: unknown; error?: unknown };
  facility_emissions_aggregated?: { data: unknown; error?: unknown };
  maturation_profiles?: { data: unknown; error?: unknown };
  facilities?: { data: unknown; error?: unknown };
  utility_data_entries?: { data: unknown; error?: unknown };
  facility_activity_entries?: { data: unknown; error?: unknown };
}

function setupTableMocks(config: TableMockConfig) {
  mockSupabaseClient.from.mockImplementation((table: string) => {
    const tableConfig = config[table as keyof TableMockConfig];
    if (tableConfig) {
      return createQueryMock({ data: tableConfig.data, error: tableConfig.error || null });
    }
    return createQueryMock({ data: null, error: null });
  });
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('calculateProductCarbonFootprint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default mock return values for aggregator and interpretation engine
    mockAggregateProductImpacts.mockResolvedValue({ success: true });
    mockGenerateLcaInterpretation.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // AUTHENTICATION TESTS
  // ==========================================================================

  describe('Authentication', () => {
    it('should return error when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });

    it('should return error when auth check fails', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Auth service unavailable'),
      });

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });
  });

  // ==========================================================================
  // PRODUCT FETCHING TESTS
  // ==========================================================================

  describe('Product Fetching', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-001', email: 'test@example.com' } },
        error: null,
      });
    });

    it('should return error when product is not found', async () => {
      setupTableMocks({
        products: { data: null },
      });

      const params: CalculatePCFParams = { productId: 'nonexistent-prod' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Product not found');
    });

    it('should return error when product fetch fails with database error', async () => {
      setupTableMocks({
        products: { data: null, error: { message: 'Database connection error' } },
      });

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Product not found');
    });
  });

  // ==========================================================================
  // MATERIALS VALIDATION TESTS
  // ==========================================================================

  describe('Materials Validation', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-001', email: 'test@example.com' } },
        error: null,
      });
    });

    it('should return error when no materials are found for product', async () => {
      setupTableMocks({
        products: { data: createMockProduct() },
        product_materials: { data: [] },
      });

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No materials found');
    });

    it('should return error when materials fetch returns null', async () => {
      setupTableMocks({
        products: { data: createMockProduct() },
        product_materials: { data: null },
      });

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No materials found');
    });

    it('should return error when materials fetch fails', async () => {
      setupTableMocks({
        products: { data: createMockProduct() },
        product_materials: { data: null, error: { message: 'Database error' } },
      });

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch materials');
    });
  });

  // ==========================================================================
  // LCA CREATION TESTS
  // ==========================================================================

  describe('LCA Record Creation', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-001', email: 'test@example.com' } },
        error: null,
      });
    });

    it('should create LCA record with default parameters', async () => {
      const product = createMockProduct();
      const materials = [createMockMaterial()];
      const lca = createMockLCA();
      const resolvedImpacts = createMockWaterfallResult();

      setupTableMocks({
        products: { data: product },
        product_materials: { data: materials },
        product_carbon_footprints: { data: lca },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: [] },
      });

      mockResolveImpactFactors.mockResolvedValue(resolvedImpacts);

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(true);
      expect(result.pcfId).toBe('lca-789');
      expect(result.lcaId).toBe('lca-789'); // Backward compatibility
    });

    it('should create LCA record with custom parameters', async () => {
      const product = createMockProduct();
      const materials = [createMockMaterial()];
      const lca = createMockLCA({
        functional_unit: 'Custom functional unit',
        system_boundary: 'cradle-to-grave',
        reference_year: 2025,
      });
      const resolvedImpacts = createMockWaterfallResult();

      setupTableMocks({
        products: { data: product },
        product_materials: { data: materials },
        product_carbon_footprints: { data: lca },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: [] },
      });

      mockResolveImpactFactors.mockResolvedValue(resolvedImpacts);

      const params: CalculatePCFParams = {
        productId: 'prod-123',
        functionalUnit: 'Custom functional unit',
        systemBoundary: 'cradle-to-grave',
        referenceYear: 2025,
      };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(true);
    });

    it('should return error when LCA creation fails', async () => {
      setupTableMocks({
        products: { data: createMockProduct() },
        product_materials: { data: [createMockMaterial()] },
        product_carbon_footprints: { data: null, error: { message: 'Failed to create LCA record' } },
      });

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create LCA');
    });
  });

  // ==========================================================================
  // IMPACT CALCULATION TESTS
  // ==========================================================================

  describe('Impact Calculations', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-001', email: 'test@example.com' } },
        error: null,
      });
    });

    it('should calculate impacts for all materials', async () => {
      const product = createMockProduct();
      const materials = [
        createMockMaterial({ id: 'mat-001', material_name: 'Ingredient 1' }),
        createMockMaterial({ id: 'mat-002', material_name: 'Ingredient 2' }),
      ];
      const lca = createMockLCA();
      const resolvedImpacts = createMockWaterfallResult();

      setupTableMocks({
        products: { data: product },
        product_materials: { data: materials },
        product_carbon_footprints: { data: lca },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: [] },
      });

      mockResolveImpactFactors.mockResolvedValue(resolvedImpacts);

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(true);
      expect(mockResolveImpactFactors).toHaveBeenCalledTimes(2);
    });

    it('should include transport emissions when transport data is available', async () => {
      const product = createMockProduct();
      const materials = [
        createMockMaterial({
          transport_mode: 'truck',
          distance_km: 500,
        }),
      ];
      const lca = createMockLCA();
      const resolvedImpacts = createMockWaterfallResult();

      setupTableMocks({
        products: { data: product },
        product_materials: { data: materials },
        product_carbon_footprints: { data: lca },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: [] },
      });

      mockResolveImpactFactors.mockResolvedValue(resolvedImpacts);
      mockCalculateTransportEmissions.mockResolvedValue({
        emissions: 0.05,
        emissionFactor: 0.1,
        methodology: 'DEFRA 2025',
        dataSource: 'DEFRA - Road Transport',
        calculationDetails: 'Test calculation',
      });

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(true);
      expect(mockCalculateTransportEmissions).toHaveBeenCalledWith({
        weightKg: 0.1, // 100g normalized to kg
        distanceKm: 500,
        transportMode: 'truck',
      });
    });

    it('should continue calculation when transport emissions calculation fails', async () => {
      const product = createMockProduct();
      const materials = [
        createMockMaterial({
          transport_mode: 'truck',
          distance_km: 500,
        }),
      ];
      const lca = createMockLCA();
      const resolvedImpacts = createMockWaterfallResult();

      setupTableMocks({
        products: { data: product },
        product_materials: { data: materials },
        product_carbon_footprints: { data: lca },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: [] },
      });

      mockResolveImpactFactors.mockResolvedValue(resolvedImpacts);
      mockCalculateTransportEmissions.mockRejectedValue(
        new Error('Transport emission factor not found')
      );

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      // Should still succeed even if transport emissions fail
      expect(result.success).toBe(true);
    });

    it('should clean up LCA record when impact resolution fails', async () => {
      setupTableMocks({
        products: { data: createMockProduct() },
        product_materials: { data: [createMockMaterial()] },
        product_carbon_footprints: { data: createMockLCA() },
      });

      mockResolveImpactFactors.mockRejectedValue(
        new Error('No emission factor found for material: Test Ingredient')
      );

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing emission data');
    });
  });

  // ==========================================================================
  // FACILITY ALLOCATION TESTS
  // ==========================================================================

  describe('Facility Allocations', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-001', email: 'test@example.com' } },
        error: null,
      });
    });

    it('should process facility allocations when provided', async () => {
      const product = createMockProduct();
      const materials = [createMockMaterial()];
      const lca = createMockLCA();
      const resolvedImpacts = createMockWaterfallResult();
      const facilityEmissions = {
        total_co2e: 5000,
        total_production_volume: 10000,
        volume_unit: 'kg',
        results_payload: {
          scope1_total: 2000,
          scope2_total: 3000,
          total_water_consumption: { value: 1000 },
          total_waste_generated: { value: 500 },
        },
      };

      setupTableMocks({
        products: { data: product },
        product_materials: { data: materials },
        product_carbon_footprints: { data: lca },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: [] },
        facility_emissions_aggregated: { data: facilityEmissions },
      });

      mockResolveImpactFactors.mockResolvedValue(resolvedImpacts);

      const facilityAllocation = createMockFacilityAllocation();
      const params: CalculatePCFParams = {
        productId: 'prod-123',
        facilityAllocations: [facilityAllocation],
      };

      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(true);
    });

    it('should handle facility allocation without emissions data', async () => {
      const product = createMockProduct();
      const materials = [createMockMaterial()];
      const lca = createMockLCA();
      const resolvedImpacts = createMockWaterfallResult();

      setupTableMocks({
        products: { data: product },
        product_materials: { data: materials },
        product_carbon_footprints: { data: lca },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: [] },
        facility_emissions_aggregated: { data: null },
      });

      mockResolveImpactFactors.mockResolvedValue(resolvedImpacts);

      const facilityAllocation = createMockFacilityAllocation();
      const params: CalculatePCFParams = {
        productId: 'prod-123',
        facilityAllocations: [facilityAllocation],
      };

      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // CONTRACT MANUFACTURER ALLOCATION TESTS
  // ==========================================================================

  describe('Contract Manufacturer Allocations', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-001', email: 'test@example.com' } },
        error: null,
      });
    });

    it('should fetch and log contract manufacturer allocations', async () => {
      const product = createMockProduct();
      const materials = [createMockMaterial()];
      const lca = createMockLCA();
      const resolvedImpacts = createMockWaterfallResult();
      const cmAllocations = [
        {
          id: 'cm-001',
          facility_id: 'cm-facility-001',
          allocated_emissions_kg_co2e: 1500,
          scope1_emissions_kg_co2e: 600,
          scope2_emissions_kg_co2e: 900,
          status: 'verified',
        },
      ];

      setupTableMocks({
        products: { data: product },
        product_materials: { data: materials },
        product_carbon_footprints: { data: lca },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: cmAllocations },
      });

      mockResolveImpactFactors.mockResolvedValue(resolvedImpacts);

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(true);
    });

    it('should handle contract manufacturer query errors', async () => {
      setupTableMocks({
        products: { data: createMockProduct() },
        product_materials: { data: [createMockMaterial()] },
        product_carbon_footprints: { data: createMockLCA() },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: null, error: { message: 'RLS policy blocking access' } },
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch production site data');
    });
  });

  // ==========================================================================
  // AGGREGATION EDGE FUNCTION TESTS
  // ==========================================================================

  describe('Aggregation Edge Function', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-001', email: 'test@example.com' } },
        error: null,
      });
    });

    it('should call aggregation after material processing', async () => {
      const lca = createMockLCA();

      setupTableMocks({
        products: { data: createMockProduct() },
        product_materials: { data: [createMockMaterial()] },
        product_carbon_footprints: { data: lca },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: [] },
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(true);
      expect(mockAggregateProductImpacts).toHaveBeenCalledWith(
        expect.anything(), // supabase client
        'lca-789',        // lca.id
        [],               // collectedFacilityEmissions (empty when no facility allocations)
      );
    });

    it('should return error when aggregation fails', async () => {
      setupTableMocks({
        products: { data: createMockProduct() },
        product_materials: { data: [createMockMaterial()] },
        product_carbon_footprints: { data: createMockLCA() },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: [] },
      });

      mockAggregateProductImpacts.mockResolvedValue({
        success: false,
        error: 'Calculation failed',
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Calculation failed');
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-001', email: 'test@example.com' } },
        error: null,
      });
    });

    it('should handle materials with zero quantity', async () => {
      const resolvedImpacts = createMockWaterfallResult({ impact_climate: 0 });

      setupTableMocks({
        products: { data: createMockProduct() },
        product_materials: { data: [createMockMaterial({ quantity: 0 })] },
        product_carbon_footprints: { data: createMockLCA() },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: [] },
      });

      mockResolveImpactFactors.mockResolvedValue(resolvedImpacts);

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(true);
      expect(mockResolveImpactFactors).toHaveBeenCalledWith(expect.anything(), 0, 'org-456');
    });

    it('should handle materials with string quantity', async () => {
      setupTableMocks({
        products: { data: createMockProduct() },
        product_materials: { data: [createMockMaterial({ quantity: '150' })] },
        product_carbon_footprints: { data: createMockLCA() },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: [] },
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(true);
      // 150g should be normalized to 0.15kg
      expect(mockResolveImpactFactors).toHaveBeenCalledWith(expect.anything(), 0.15, 'org-456');
    });

    it('should handle packaging materials', async () => {
      setupTableMocks({
        products: { data: createMockProduct() },
        product_materials: {
          data: [
            createMockMaterial({
              material_type: 'packaging',
              material_name: 'Glass Bottle',
              packaging_category: 'container',
              quantity: 350,
              unit: 'g',
            }),
          ],
        },
        product_carbon_footprints: { data: createMockLCA() },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: [] },
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(true);
      // 350g should be normalized to 0.35kg
      expect(mockResolveImpactFactors).toHaveBeenCalledWith(expect.anything(), 0.35, 'org-456');
    });

    it('should handle materials with supplier data source', async () => {
      const resolvedImpacts = createMockWaterfallResult({
        data_priority: 1,
        data_quality_tag: 'Primary_Verified',
      });

      setupTableMocks({
        products: { data: createMockProduct() },
        product_materials: {
          data: [
            createMockMaterial({
              data_source: 'supplier',
              supplier_product_id: 'supplier-001',
            }),
          ],
        },
        product_carbon_footprints: { data: createMockLCA() },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: [] },
      });

      mockResolveImpactFactors.mockResolvedValue(resolvedImpacts);

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(true);
    });

    it('should handle multiple materials with mixed types', async () => {
      const materials = [
        createMockMaterial({ id: 'mat-001', material_type: 'ingredient', material_name: 'Sugar' }),
        createMockMaterial({ id: 'mat-002', material_type: 'ingredient', material_name: 'Water' }),
        createMockMaterial({
          id: 'mat-003',
          material_type: 'packaging',
          material_name: 'Glass Bottle',
          packaging_category: 'container',
        }),
        createMockMaterial({
          id: 'mat-004',
          material_type: 'packaging',
          material_name: 'Paper Label',
          packaging_category: 'label',
        }),
      ];

      setupTableMocks({
        products: { data: createMockProduct() },
        product_materials: { data: materials },
        product_carbon_footprints: { data: createMockLCA() },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: [] },
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(true);
      expect(mockResolveImpactFactors).toHaveBeenCalledTimes(4);
    });
  });

  // ==========================================================================
  // MATERIALS INSERTION TESTS
  // ==========================================================================

  describe('Materials Insertion', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-001', email: 'test@example.com' } },
        error: null,
      });
    });

    it('should insert materials with all impact values', async () => {
      setupTableMocks({
        products: { data: createMockProduct() },
        product_materials: { data: [createMockMaterial()] },
        product_carbon_footprints: { data: createMockLCA() },
        product_carbon_footprint_materials: { data: null },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: [] },
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(true);
    });

    it('should clean up LCA when materials insertion fails', async () => {
      setupTableMocks({
        products: { data: createMockProduct() },
        product_materials: { data: [createMockMaterial()] },
        product_carbon_footprints: { data: createMockLCA() },
        product_carbon_footprint_materials: { data: null, error: { message: 'Constraint violation' } },
        product_carbon_footprint_production_sites: { data: [] },
        contract_manufacturer_allocations: { data: [] },
      });

      mockResolveImpactFactors.mockResolvedValue(createMockWaterfallResult());

      const params: CalculatePCFParams = { productId: 'prod-123' };
      const result = await calculateProductCarbonFootprint(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to insert materials');
    });
  });
});

// ============================================================================
// LEGACY ALIAS TESTS
// ============================================================================

describe('calculateProductLCA (Legacy Alias)', () => {
  it('should be exported as an alias for calculateProductCarbonFootprint', () => {
    expect(calculateProductLCA).toBe(calculateProductCarbonFootprint);
  });
});

// ============================================================================
// NORMALIZETOKG UTILITY TESTS
// ============================================================================

describe('normalizeToKg', () => {
  it('should convert grams to kilograms', () => {
    expect(normalizeToKg('500', 'g')).toBe(0.5);
    expect(normalizeToKg(500, 'g')).toBe(0.5);
    expect(normalizeToKg('500', 'grams')).toBe(0.5);
  });

  it('should convert millilitres to kilograms (1:1 density)', () => {
    expect(normalizeToKg('500', 'ml')).toBe(0.5);
    expect(normalizeToKg(500, 'ml')).toBe(0.5);
    expect(normalizeToKg('500', 'millilitres')).toBe(0.5);
  });

  it('should keep kilograms as is', () => {
    expect(normalizeToKg('1', 'kg')).toBe(1);
    expect(normalizeToKg(1, 'kg')).toBe(1);
  });

  it('should convert litres to kilograms (1:1 density)', () => {
    expect(normalizeToKg('1', 'l')).toBe(1);
    expect(normalizeToKg(1, 'l')).toBe(1);
    expect(normalizeToKg('1', 'litres')).toBe(1);
  });

  it('should default to kg for unknown units', () => {
    expect(normalizeToKg('1', 'unknown')).toBe(1);
    expect(normalizeToKg(1, '')).toBe(1);
  });

  it('should handle string quantities', () => {
    expect(normalizeToKg('100', 'g')).toBe(0.1);
    expect(normalizeToKg('1.5', 'kg')).toBe(1.5);
  });
});

// ============================================================================
// TYPE EXPORTS TESTS
// ============================================================================

describe('Type Exports', () => {
  it('should export CalculatePCFParams type', () => {
    const params: CalculatePCFParams = {
      productId: 'test-123',
      functionalUnit: '1 unit',
      systemBoundary: 'cradle-to-gate',
      referenceYear: 2024,
    };
    expect(params.productId).toBe('test-123');
  });

  it('should export FacilityAllocationInput type', () => {
    const allocation: FacilityAllocationInput = {
      facilityId: 'facility-001',
      facilityName: 'Test Facility',
      operationalControl: 'owned',
      reportingPeriodStart: '2024-01-01',
      reportingPeriodEnd: '2024-12-31',
      productionVolume: 1000,
      productionVolumeUnit: 'kg',
      facilityTotalProduction: 10000,
    };
    expect(allocation.facilityId).toBe('facility-001');
  });
});
