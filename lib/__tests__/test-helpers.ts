/**
 * Shared Test Helpers
 *
 * Common mock factories and utilities used across LCA test suites.
 * Eliminates duplication of Supabase query builder mocks, data factories,
 * and assertion helpers.
 */

import { vi } from 'vitest';

// ============================================================================
// SUPABASE MOCK INFRASTRUCTURE
// ============================================================================

interface MockResponse {
  data: unknown;
  error: unknown;
}

/**
 * Creates a fluent Supabase query builder mock.
 * All chainable methods (select, eq, etc.) return `this`.
 * Terminal methods (single, maybeSingle, then) resolve with the given response.
 */
export function createQueryMock(response: MockResponse) {
  const mock: Record<string, unknown> = {};

  const chainableMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'ilike', 'like', 'lte', 'gte', 'gt', 'lt',
    'in', 'is', 'not', 'or', 'filter', 'match', 'contains',
    'order', 'limit', 'range', 'single', 'maybeSingle',
  ];

  chainableMethods.forEach(method => {
    mock[method] = vi.fn().mockReturnValue(mock);
  });

  // Override terminal methods to resolve
  mock.single = vi.fn().mockResolvedValue(response);
  mock.maybeSingle = vi.fn().mockResolvedValue(response);

  // Make the mock itself thenable (for queries without .single())
  mock.then = (resolve: (r: typeof response) => void) => {
    resolve(response);
    return Promise.resolve(response);
  };

  return mock;
}

/**
 * Creates a mock Supabase client with common methods.
 * Use `client.from.mockImplementation(...)` to customise per-table behaviour.
 */
export function createMockSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-001', email: 'test@example.com' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue(createQueryMock({ data: null, error: null })),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

// ============================================================================
// DATA FACTORIES
// ============================================================================

/**
 * Create a mock product record with sensible defaults.
 */
export function createMockProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-001',
    organization_id: 'org-001',
    name: 'Test Beer',
    product_type: 'beer_cider',
    unit_size_value: 330,
    unit_size_unit: 'ml',
    functional_unit: '1 × 330ml can',
    sku: 'TEST-BEER-330',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Create a mock ingredient material.
 * Represents a raw material input (e.g. malt, hops, water).
 */
export function createMockIngredient(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mat-ingredient-001',
    material_name: 'Pale Malt',
    material_type: 'ingredient',
    category_type: 'MANUFACTURING_MATERIAL',
    quantity: 0.5,
    unit: 'kg',
    impact_climate: 0.450,
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
    ...overrides,
  };
}

/**
 * Create a mock packaging material.
 */
export function createMockPackaging(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mat-packaging-001',
    material_name: 'Aluminium Can 330ml',
    material_type: 'packaging',
    category_type: 'MANUFACTURING_MATERIAL',
    packaging_category: 'aluminium',
    quantity: 0.015,
    unit: 'kg',
    impact_climate: 0.225,
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
    ...overrides,
  };
}

/**
 * Create a mock PCF (product carbon footprint) record.
 */
export function createMockPCF(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pcf-001',
    product_id: 'prod-001',
    organization_id: 'org-001',
    system_boundary: 'cradle-to-gate',
    status: 'in_progress',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Create a mock facility emissions data object (pre-computed by calculator).
 */
export function createMockFacilityEmissions(overrides: Record<string, unknown> = {}) {
  return {
    facilityId: 'facility-001',
    facilityName: 'Test Brewery',
    isContractManufacturer: false,
    allocatedEmissions: 500, // 500 kg CO2e total
    scope1Emissions: 200,
    scope2Emissions: 300,
    allocatedWater: 10000, // 10,000 litres
    allocatedWaste: 50, // 50 kg
    attributionRatio: 0.10,
    productVolume: 10000, // 10,000 units
    ...overrides,
  };
}

/**
 * Create a mock facility allocation input (for calculator tests).
 */
export function createMockFacilityAllocation(overrides: Record<string, unknown> = {}) {
  return {
    facilityId: 'facility-001',
    productionVolume: 10000,
    shareOfProduction: 100,
    allocationMethod: 'physical',
    ...overrides,
  };
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert that a number is approximately equal to an expected value.
 * Shorthand for common floating-point comparisons in LCA tests.
 */
export function expectApprox(actual: number, expected: number, precision = 3) {
  expect(actual).toBeCloseTo(expected, precision);
}

/**
 * Assert that all pathway percentages in a breakdown sum to ~100%.
 */
export function expectPathwaysSumTo100(pathways: Record<string, number>, tolerance = 0.5) {
  const sum = Object.values(pathways).reduce((s, v) => s + v, 0);
  expect(Math.abs(sum - 100)).toBeLessThanOrEqual(tolerance);
}
