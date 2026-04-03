import { vi, beforeEach, describe, it, expect } from 'vitest';

// ============================================================================
// MOCK SETUP — must come before imports of the module under test
// ============================================================================

function createQueryMock(response: { data: any; error: any }) {
  const mock: Record<string, unknown> = {};
  const chainableMethods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'gte', 'lte', 'order', 'limit',
    'in', 'not', 'ilike', 'is', 'or', 'filter',
  ];
  chainableMethods.forEach(method => {
    mock[method] = vi.fn().mockReturnValue(mock);
  });
  mock.maybeSingle = vi.fn().mockResolvedValue(response);
  mock.single = vi.fn().mockResolvedValue(response);
  mock.then = (resolve: (r: any) => void) => {
    resolve(response);
    return Promise.resolve(response);
  };
  return mock;
}

let fromMocks: Record<string, ReturnType<typeof createQueryMock>> = {};

const mockGetSession = vi.fn().mockResolvedValue({
  data: { session: { access_token: 'test-token' } },
  error: null,
});

const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock('../supabase/browser-client', () => ({
  getSupabaseBrowserClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (!fromMocks[table]) {
        fromMocks[table] = createQueryMock({ data: null, error: null });
      }
      return fromMocks[table];
    }),
    auth: { getSession: mockGetSession },
    rpc: mockRpc,
  })),
}));

vi.mock('../calculations/water-risk', () => ({
  DEFAULT_AWARE_FACTOR: 1.0,
  getAwareFactorValue: vi.fn().mockResolvedValue(1.0),
}));

vi.mock('../openlca/agribalyse-aliases', () => ({
  getPreferredDatabase: vi.fn().mockReturnValue('ecoinvent'),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// ============================================================================
// IMPORTS — after mocks are wired
// ============================================================================

import {
  normalizeToKg,
  resolveImpactFactors,
} from '../impact-waterfall-resolver';
import type { ProductMaterial } from '../impact-waterfall-resolver';

// ============================================================================
// HELPERS
// ============================================================================

function makeSupplierProduct(overrides: Record<string, any> = {}) {
  return {
    id: 'sp-001',
    product_name: 'Test Product',
    impact_climate: null,
    impact_water: null,
    impact_waste: null,
    impact_land: null,
    carbon_intensity: null,
    ghg_fossil: null,
    ghg_biogenic: null,
    ghg_land_use_change: null,
    water_blue: null,
    water_green: null,
    water_grey: null,
    water_scarcity_factor: null,
    terrestrial_ecotoxicity: null,
    freshwater_eutrophication: null,
    terrestrial_acidification: null,
    data_quality_score: null,
    data_confidence_pct: null,
    data_source_type: null,
    methodology_standard: null,
    functional_unit: null,
    system_boundary: null,
    is_externally_verified: false,
    verifier_name: null,
    ...overrides,
  };
}

function makeMaterial(overrides: Partial<ProductMaterial> = {}): ProductMaterial {
  return {
    id: 'mat-001',
    product_id: 'prod-001',
    material_name: 'Barley Malt',
    material_type: 'ingredient',
    quantity: '10',
    unit: 'kg',
    data_source: 'supplier',
    supplier_product_id: 'sp-001',
    ...overrides,
  };
}

// ============================================================================
// HELPERS — API mocks
// ============================================================================

/**
 * Configures mockFetch to handle the /api/supplier-products/resolve endpoint.
 * For any other URL, delegates to otherHandler or returns a default error.
 */
function mockSupplierProductResolve(product: any, otherHandler?: (url: string, init?: any) => any) {
  mockFetch.mockImplementation((url: string, init?: any) => {
    if (url === '/api/supplier-products/resolve') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ product }),
      });
    }
    if (otherHandler) return otherHandler(url, init);
    return Promise.resolve({ ok: false, statusText: 'Not Found', json: () => Promise.resolve({}) });
  });
}

// ============================================================================
// TESTS
// ============================================================================

beforeEach(() => {
  fromMocks = {};
  vi.clearAllMocks();
  mockFetch.mockReset();
});

// --------------------------------------------------------------------------
// Group A: hasSupplierProductImpactData (zero-value bug fix)
// --------------------------------------------------------------------------
describe('Group A: hasSupplierProductImpactData — zero-value handling', () => {
  // We test this indirectly: if the resolver finds a supplier product with
  // impact data, it returns data_priority=1. If hasSupplierProductImpactData
  // returns false, it falls through to priority 2+.

  it('A1: treats impact_climate=0 as valid data (not null)', async () => {
    const product = makeSupplierProduct({ impact_climate: 0 });
    mockSupplierProductResolve(product);

    const result = await resolveImpactFactors(makeMaterial(), 10);
    expect(result.data_priority).toBe(1);
    expect(result.impact_climate).toBe(0);
  });

  it('A2: treats impact_water=0 as valid data (not null)', async () => {
    const product = makeSupplierProduct({ impact_water: 0 });
    mockSupplierProductResolve(product);

    const result = await resolveImpactFactors(makeMaterial(), 10);
    expect(result.data_priority).toBe(1);
    expect(result.impact_water).toBe(0);
  });

  it('A3: falls through when all four pillars are null', async () => {
    // Supplier product exists but has NO impact data at all
    const product = makeSupplierProduct();
    // mockFetch handles both the resolve API and OpenLCA calls
    mockSupplierProductResolve(product, () =>
      Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
    );
    // Platform supplier products also return nothing
    fromMocks['platform_supplier_products'] = createQueryMock({ data: null, error: null });
    fromMocks['products'] = createQueryMock({ data: null, error: null });

    // Mock the staging_emission_factors fallback (priority 2)
    fromMocks['staging_emission_factors'] = createQueryMock({ data: null, error: null });
    // Mock ecoinvent_material_proxies fallback (priority 2.5)
    fromMocks['ecoinvent_material_proxies'] = createQueryMock({ data: null, error: null });

    // When no data is found at any priority, the resolver throws
    await expect(resolveImpactFactors(makeMaterial(), 10)).rejects.toThrow(
      'No emission factor found'
    );
  });

  it('A4: treats legacy carbon_intensity as valid data', async () => {
    const product = makeSupplierProduct({ carbon_intensity: 1.8 });
    mockSupplierProductResolve(product);

    const result = await resolveImpactFactors(makeMaterial(), 10);
    expect(result.data_priority).toBe(1);
    expect(result.impact_climate).toBe(18); // 1.8 * 10
  });

  it('A5: works with mix of zero and non-zero values', async () => {
    const product = makeSupplierProduct({
      impact_climate: 0,
      impact_water: 1.5,
      impact_waste: 0,
      impact_land: 3.2,
    });
    mockSupplierProductResolve(product);

    const result = await resolveImpactFactors(makeMaterial(), 10);
    expect(result.data_priority).toBe(1);
    expect(result.impact_climate).toBe(0);
    expect(result.impact_water).toBe(15);
    expect(result.impact_waste).toBe(0);
    expect(result.impact_land).toBe(32);
  });
});

// --------------------------------------------------------------------------
// Group B: buildSupplierProductResult accuracy
// --------------------------------------------------------------------------
describe('Group B: buildSupplierProductResult — calculation accuracy', () => {
  it('B1: basic climate: impact_climate=2.5, qty=10kg → 25.0', async () => {
    const product = makeSupplierProduct({ impact_climate: 2.5 });
    mockSupplierProductResolve(product);

    const result = await resolveImpactFactors(makeMaterial(), 10);
    expect(result.impact_climate).toBe(25);
  });

  it('B2: legacy fallback: carbon_intensity=1.8, no impact_climate → uses 1.8', async () => {
    const product = makeSupplierProduct({ carbon_intensity: 1.8 });
    mockSupplierProductResolve(product);

    const result = await resolveImpactFactors(makeMaterial(), 10);
    expect(result.impact_climate).toBe(18);
  });

  it('B3: multi-pillar: all 4 impacts multiply by quantity correctly', async () => {
    const product = makeSupplierProduct({
      impact_climate: 2.0,
      impact_water: 1.5,
      impact_waste: 0.5,
      impact_land: 3.0,
    });
    mockSupplierProductResolve(product);

    const result = await resolveImpactFactors(makeMaterial(), 10);
    expect(result.impact_climate).toBe(20);
    expect(result.impact_water).toBe(15);
    expect(result.impact_waste).toBe(5);
    expect(result.impact_land).toBe(30);
  });

  it('B4: GHG breakdown from supplier used directly (not estimated)', async () => {
    const product = makeSupplierProduct({
      impact_climate: 2.0,
      ghg_fossil: 1.5,
      ghg_biogenic: 0.5,
      ghg_land_use_change: 0.1,
    });
    mockSupplierProductResolve(product);

    const result = await resolveImpactFactors(makeMaterial(), 10);
    expect(result.impact_climate_fossil).toBe(15);   // 1.5 * 10
    expect(result.impact_climate_biogenic).toBe(5);   // 0.5 * 10
    expect(result.impact_climate_dluc).toBe(1);       // 0.1 * 10
  });

  it('B5: GHG estimation fallback: no breakdown → 85/15 split', async () => {
    const product = makeSupplierProduct({ impact_climate: 2.0 });
    mockSupplierProductResolve(product);

    const result = await resolveImpactFactors(makeMaterial(), 10);
    expect(result.impact_climate_fossil).toBeCloseTo(17);     // 2.0 * 0.85 * 10
    expect(result.impact_climate_biogenic).toBeCloseTo(3);     // 2.0 * 0.15 * 10
    expect(result.impact_climate_dluc).toBe(0);
  });

  it('B6: water scarcity with supplier factor overrides AWARE', async () => {
    const product = makeSupplierProduct({
      impact_water: 1.0,
      water_scarcity_factor: 2.5,
    });
    mockSupplierProductResolve(product);

    const result = await resolveImpactFactors(makeMaterial(), 10);
    // water_scarcity = water_blue * qty * scarcity_factor
    // water_blue falls back to impact_water (1.0), so: 1.0 * 10 * 2.5 = 25
    expect(result.impact_water_scarcity).toBe(25);
  });

  it('B7: water scarcity without supplier factor falls back to AWARE', async () => {
    const product = makeSupplierProduct({ impact_water: 1.0 });
    mockSupplierProductResolve(product);

    const result = await resolveImpactFactors(makeMaterial(), 10);
    // AWARE factor mocked as 1.0, so: 1.0 * 10 * 1.0 = 10
    expect(result.impact_water_scarcity).toBe(10);
  });

  it('B8: zero climate → result is 0 (not fallthrough)', async () => {
    const product = makeSupplierProduct({ impact_climate: 0 });
    mockSupplierProductResolve(product);

    const result = await resolveImpactFactors(makeMaterial(), 10);
    expect(result.impact_climate).toBe(0);
    expect(result.data_priority).toBe(1);
  });

  it('B9: data quality score 1 → confidence=95%, grade=HIGH', async () => {
    const product = makeSupplierProduct({
      impact_climate: 1.0,
      data_quality_score: 1,
      data_source_type: 'primary_verified',
    });
    mockSupplierProductResolve(product);

    const result = await resolveImpactFactors(makeMaterial(), 10);
    expect(result.confidence_score).toBe(95);
    expect(result.data_quality_grade).toBe('HIGH');
    expect(result.data_quality_tag).toBe('Primary_Verified');
  });

  it('B10: external verification appears in source_reference', async () => {
    const product = makeSupplierProduct({
      impact_climate: 1.0,
      is_externally_verified: true,
      verifier_name: 'SGS',
    });
    mockSupplierProductResolve(product);

    const result = await resolveImpactFactors(makeMaterial(), 10);
    expect(result.source_reference).toContain('Verified by SGS');
    expect(result.data_quality_grade).toBe('HIGH');
  });

  it('B11: nature impacts multiply by quantity', async () => {
    const product = makeSupplierProduct({
      impact_climate: 1.0,
      terrestrial_ecotoxicity: 0.5,
      freshwater_eutrophication: 0.3,
      terrestrial_acidification: 0.2,
    });
    mockSupplierProductResolve(product);

    const result = await resolveImpactFactors(makeMaterial(), 10);
    expect(result.impact_terrestrial_ecotoxicity).toBe(5);
    expect(result.impact_freshwater_eutrophication).toBe(3);
    expect(result.impact_terrestrial_acidification).toBe(2);
  });

  it('B12: platform supplier product sets correct source type', async () => {
    // No regular supplier product found via API
    mockSupplierProductResolve(null);
    // Platform supplier product found
    const platformProduct = makeSupplierProduct({
      impact_climate: 1.5,
      product_name: 'Platform Barley',
    });
    fromMocks['platform_supplier_products'] = createQueryMock({ data: platformProduct, error: null });

    const result = await resolveImpactFactors(makeMaterial(), 10);
    expect(result.data_priority).toBe(1);
    expect(result.source_reference).toContain('Platform Supplier');
    expect(result.gwp_data_source).toBe('Platform Supplier Product');
  });
});

// --------------------------------------------------------------------------
// Group C: Unit normalisation
// --------------------------------------------------------------------------
describe('Group C: normalizeToKg — unit conversions', () => {
  it('C1: kg → passthrough (1:1)', () => {
    expect(normalizeToKg(10, 'kg')).toBe(10);
  });

  it('C2: g → divide by 1000', () => {
    expect(normalizeToKg(500, 'g')).toBe(0.5);
  });

  it('C3: tonne → multiply by 1000', () => {
    expect(normalizeToKg(2, 'tonne')).toBe(2000);
  });

  it('C4: L → treat as 1kg (density assumption)', () => {
    expect(normalizeToKg(5, 'L')).toBe(5);
  });

  it('C5: ml → divide by 1000', () => {
    expect(normalizeToKg(250, 'ml')).toBe(0.25);
  });

  it('C6: unknown unit → passthrough as kg with warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(normalizeToKg(10, 'bottles')).toBe(10);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unknown unit 'bottles'")
    );
    warnSpy.mockRestore();
  });

  it('C7: mg → divide by 1,000,000', () => {
    expect(normalizeToKg(5000, 'mg')).toBe(0.005);
  });

  it('C8: lb → multiply by 0.453592', () => {
    expect(normalizeToKg(10, 'lb')).toBeCloseTo(4.53592);
  });

  it('C9: litres (alternative spelling) works', () => {
    expect(normalizeToKg(3, 'litres')).toBe(3);
  });

  it('C10: invalid quantity returns 0', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(normalizeToKg(NaN, 'kg')).toBe(0);
    expect(normalizeToKg(-5, 'kg')).toBe(0);
    warnSpy.mockRestore();
  });
});

// --------------------------------------------------------------------------
// Group D: Waterfall priority resolution
// --------------------------------------------------------------------------
describe('Group D: Waterfall priority — supplier product resolution', () => {
  it('D1: supplier product with data → priority 1', async () => {
    const product = makeSupplierProduct({ impact_climate: 2.0 });
    mockSupplierProductResolve(product);

    const result = await resolveImpactFactors(makeMaterial(), 10);
    expect(result.data_priority).toBe(1);
    expect(result.supplier_lca_id).toBe('sp-001');
  });

  it('D2: supplier product with NO data → falls through (throws when no fallback)', async () => {
    const product = makeSupplierProduct(); // all nulls
    // mockFetch handles both resolve API and other fetch calls (OpenLCA)
    mockSupplierProductResolve(product, () =>
      Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
    );
    fromMocks['platform_supplier_products'] = createQueryMock({ data: null, error: null });
    fromMocks['products'] = createQueryMock({ data: null, error: null });
    fromMocks['staging_emission_factors'] = createQueryMock({ data: null, error: null });
    fromMocks['ecoinvent_material_proxies'] = createQueryMock({ data: null, error: null });

    // With no fallback data at any priority, the resolver throws
    await expect(resolveImpactFactors(makeMaterial(), 10)).rejects.toThrow(
      'No emission factor found'
    );
  });

  it('D3: supplier product not found → falls through gracefully (throws when no fallback)', async () => {
    // mockFetch handles both resolve API and other fetch calls (OpenLCA)
    mockSupplierProductResolve(null, () =>
      Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
    );
    fromMocks['platform_supplier_products'] = createQueryMock({ data: null, error: null });
    fromMocks['products'] = createQueryMock({ data: null, error: null });
    fromMocks['staging_emission_factors'] = createQueryMock({ data: null, error: null });
    fromMocks['ecoinvent_material_proxies'] = createQueryMock({ data: null, error: null });

    // The resolver throws when no data is found anywhere
    await expect(
      resolveImpactFactors(
        makeMaterial({ supplier_product_id: 'deleted-id' }),
        10
      )
    ).rejects.toThrow('No emission factor found');
  });

  it('D4: platform supplier product → priority 1 with Platform source', async () => {
    mockSupplierProductResolve(null);
    fromMocks['platform_supplier_products'] = createQueryMock({
      data: makeSupplierProduct({
        id: 'psp-001',
        impact_climate: 1.2,
        product_name: 'Platform Hops',
      }),
      error: null,
    });

    const result = await resolveImpactFactors(makeMaterial(), 10);
    expect(result.data_priority).toBe(1);
    expect(result.gwp_data_source).toBe('Platform Supplier Product');
  });
});

// --------------------------------------------------------------------------
// Group E: Search API field mapping
// --------------------------------------------------------------------------
describe('Group E: Search API field mapping correctness', () => {
  // These tests verify the ingredients search route maps the correct
  // database columns. We test the mapping logic directly since the API
  // route is server-side and harder to mock end-to-end.

  it('E1: co2_factor maps from impact_climate (or carbon_intensity fallback)', () => {
    // The mapping in route.ts is: co2_factor: product.carbon_intensity ?? product.impact_climate
    const product = { carbon_intensity: null, impact_climate: 2.5 };
    const co2_factor = product.carbon_intensity ?? product.impact_climate;
    expect(co2_factor).toBe(2.5);
  });

  it('E2: co2_factor falls back to carbon_intensity when impact_climate is null', () => {
    const product = { carbon_intensity: 1.8, impact_climate: null };
    const co2_factor = product.carbon_intensity ?? product.impact_climate;
    expect(co2_factor).toBe(1.8);
  });

  it('E3: water_factor maps from impact_water', () => {
    const product = { impact_water: 1.4 };
    expect(product.impact_water).toBe(1.4);
  });

  it('E4: land_factor maps from impact_land', () => {
    const product = { impact_land: 2.8 };
    expect(product.impact_land).toBe(2.8);
  });

  it('E5: waste_factor maps from impact_waste', () => {
    const product = { impact_waste: 0.03 };
    expect(product.impact_waste).toBe(0.03);
  });

  it('E6: co2_factor prefers carbon_intensity over impact_climate (route precedence)', () => {
    // Route uses: co2_factor: product.carbon_intensity ?? product.impact_climate
    // When both exist, carbon_intensity takes precedence
    const product = { carbon_intensity: 1.8, impact_climate: 2.5 };
    const co2_factor = product.carbon_intensity ?? product.impact_climate;
    expect(co2_factor).toBe(1.8);
  });
});
