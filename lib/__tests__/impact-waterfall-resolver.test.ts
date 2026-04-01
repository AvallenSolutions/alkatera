import { vi, beforeEach } from 'vitest';

// ============================================================================
// MOCK SETUP — must come before imports of the module under test
// ============================================================================

/**
 * Creates a fluent chainable mock that mimics Supabase's query builder pattern.
 * Every chained method returns the same mock object, and terminal methods
 * (maybeSingle, single) resolve to the provided response.
 */
function createQueryMock(response: { data: any; error: any }) {
  const mock: Record<string, unknown> = {};
  const chainableMethods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'gte', 'lte', 'order', 'limit',
    'in', 'not', 'ilike', 'is',
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

/**
 * Creates a mock that returns null on the first maybeSingle() call (local ID check)
 * and returns actual data on subsequent calls (name-based lookup).
 * This simulates a table where the ID doesn't match but a name-based search does.
 */
function createSequenceQueryMock(firstResponse: { data: any; error: any }, laterResponse: { data: any; error: any }) {
  const mock: Record<string, unknown> = {};
  const chainableMethods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'gte', 'lte', 'order', 'limit',
    'in', 'not', 'ilike', 'is',
  ];
  chainableMethods.forEach(method => {
    mock[method] = vi.fn().mockReturnValue(mock);
  });
  let callCount = 0;
  mock.maybeSingle = vi.fn().mockImplementation(() => {
    callCount++;
    return Promise.resolve(callCount === 1 ? firstResponse : laterResponse);
  });
  mock.single = vi.fn().mockResolvedValue(laterResponse);
  mock.then = (resolve: (r: any) => void) => {
    resolve(laterResponse);
    return Promise.resolve(laterResponse);
  };
  return mock;
}

// Track all from() calls so individual tests can configure per-table behaviour
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
        // Default: return no data for any unconfigured table
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

// Mock fetch for OpenLCA API calls
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// ============================================================================
// IMPORTS — after mocks are wired
// ============================================================================

import {
  normalizeToKg,
  resolveImpactFactors,
  validateMaterialsBeforeCalculation,
} from '@/lib/impact-waterfall-resolver';
import type { ProductMaterial, FallbackEvent } from '@/lib/impact-waterfall-resolver';

// ============================================================================
// FACTORY HELPERS
// ============================================================================

function createMaterial(overrides: Partial<ProductMaterial> = {}): ProductMaterial {
  return {
    id: 'mat-001',
    product_id: 'prod-001',
    material_name: 'Glass bottle',
    material_type: 'packaging',
    quantity: 0.5,
    unit: 'kg',
    ...overrides,
  };
}

function createSupplierMaterial(overrides: Partial<ProductMaterial> = {}): ProductMaterial {
  return createMaterial({
    data_source: 'supplier',
    supplier_product_id: 'sp-001',
    ...overrides,
  });
}

function createOpenLCAMaterial(overrides: Partial<ProductMaterial> = {}): ProductMaterial {
  return createMaterial({
    data_source: 'openlca',
    data_source_id: 'olca-uuid-001',
    ...overrides,
  });
}

/** Configures a Supabase table mock to return specific data. */
function mockTable(table: string, data: any, error: any = null) {
  fromMocks[table] = createQueryMock({ data, error });
}

// ============================================================================
// TESTS
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  fromMocks = {};
  mockFetch.mockReset();

  // Suppress console noise
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ────────────────────────────────────────────────────────────────────────────
// 1. normalizeToKg
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeToKg', () => {

  describe('mass unit conversions', () => {
    it('returns kg unchanged', () => {
      expect(normalizeToKg(5, 'kg')).toBe(5);
    });

    it('handles "kilogram" and "kilograms" aliases', () => {
      expect(normalizeToKg(3, 'kilogram')).toBe(3);
      expect(normalizeToKg(3, 'kilograms')).toBe(3);
    });

    it('converts grams to kg (/1000)', () => {
      expect(normalizeToKg(500, 'g')).toBeCloseTo(0.5);
    });

    it('handles "gram" and "grams" aliases', () => {
      expect(normalizeToKg(2000, 'gram')).toBeCloseTo(2);
      expect(normalizeToKg(2000, 'grams')).toBeCloseTo(2);
    });

    it('converts milligrams to kg (/1_000_000)', () => {
      expect(normalizeToKg(1_000_000, 'mg')).toBeCloseTo(1);
      expect(normalizeToKg(500, 'milligrams')).toBeCloseTo(0.0005);
    });

    it('converts tonnes to kg (*1000)', () => {
      expect(normalizeToKg(2, 'tonne')).toBe(2000);
      expect(normalizeToKg(1, 'tonnes')).toBe(1000);
      expect(normalizeToKg(0.5, 't')).toBe(500);
    });

    it('handles "metric_ton" and "metric tons" aliases', () => {
      expect(normalizeToKg(1, 'metric_ton')).toBe(1000);
      expect(normalizeToKg(1, 'metric_tons')).toBe(1000);
      expect(normalizeToKg(1, 'metric ton')).toBe(1000);
      expect(normalizeToKg(1, 'metric tons')).toBe(1000);
    });

    it('converts pounds to kg (*0.453592)', () => {
      expect(normalizeToKg(1, 'lb')).toBeCloseTo(0.453592);
      expect(normalizeToKg(10, 'lbs')).toBeCloseTo(4.53592);
      expect(normalizeToKg(1, 'pound')).toBeCloseTo(0.453592);
      expect(normalizeToKg(1, 'pounds')).toBeCloseTo(0.453592);
    });

    it('converts ounces to kg (*0.0283495)', () => {
      expect(normalizeToKg(1, 'oz')).toBeCloseTo(0.0283495);
      expect(normalizeToKg(16, 'ounce')).toBeCloseTo(0.453592, 4);
      expect(normalizeToKg(1, 'ounces')).toBeCloseTo(0.0283495);
    });
  });

  describe('volume unit conversions (density ~ 1 kg/L)', () => {
    it('converts ml to kg (/1000)', () => {
      expect(normalizeToKg(750, 'ml')).toBeCloseTo(0.75);
    });

    it('handles millilitre aliases', () => {
      expect(normalizeToKg(1000, 'millilitre')).toBeCloseTo(1);
      expect(normalizeToKg(1000, 'millilitres')).toBeCloseTo(1);
      expect(normalizeToKg(1000, 'milliliter')).toBeCloseTo(1);
      expect(normalizeToKg(1000, 'milliliters')).toBeCloseTo(1);
    });

    it('converts litres to kg (identity)', () => {
      expect(normalizeToKg(2, 'l')).toBe(2);
    });

    it('handles litre aliases', () => {
      expect(normalizeToKg(5, 'litre')).toBe(5);
      expect(normalizeToKg(5, 'litres')).toBe(5);
      expect(normalizeToKg(5, 'liter')).toBe(5);
      expect(normalizeToKg(5, 'liters')).toBe(5);
    });
  });

  describe('unknown and null units', () => {
    it('defaults unknown unit to kg passthrough', () => {
      expect(normalizeToKg(7, 'bushels')).toBe(7);
    });

    it('treats null/empty unit as kg', () => {
      // The code does: (unit || 'kg').toLowerCase()
      expect(normalizeToKg(3, '')).toBe(3);
    });

    it('logs a warning for unknown units', () => {
      normalizeToKg(1, 'parsecs');
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("Unknown unit 'parsecs'")
      );
    });
  });

  describe('edge cases', () => {
    it('returns 0 for zero quantity', () => {
      expect(normalizeToKg(0, 'kg')).toBe(0);
    });

    it('returns 0 for negative quantity', () => {
      expect(normalizeToKg(-5, 'kg')).toBe(0);
    });

    it('converts string quantity to number', () => {
      expect(normalizeToKg('12.5', 'kg')).toBe(12.5);
    });

    it('returns 0 for non-numeric string', () => {
      expect(normalizeToKg('abc', 'kg')).toBe(0);
    });

    it('handles unit with mixed case and whitespace', () => {
      expect(normalizeToKg(1, '  KG  ')).toBe(1);
      expect(normalizeToKg(1000, ' G ')).toBeCloseTo(1);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. validateMaterialsBeforeCalculation
// ────────────────────────────────────────────────────────────────────────────

describe('validateMaterialsBeforeCalculation', () => {

  it('returns empty arrays for empty input', async () => {
    const result = await validateMaterialsBeforeCalculation([], 'org-001');
    expect(result.valid).toBe(true);
    expect(result.missingData).toEqual([]);
    expect(result.validMaterials).toEqual([]);
  });

  it('places materials with assigned supplier factors into validMaterials', async () => {
    const material = createSupplierMaterial({ material_name: 'Eco Glass' });

    // Mock supplier_products to return impact data
    mockTable('supplier_products', {
      id: 'sp-001',
      product_name: 'Eco Glass',
      impact_climate: 1.5,
      impact_water: 0.2,
      impact_waste: 0.01,
      impact_land: 0.05,
    });

    const result = await validateMaterialsBeforeCalculation([material], 'org-001');

    expect(result.valid).toBe(true);
    expect(result.validMaterials).toHaveLength(1);
    expect(result.validMaterials[0].material.material_name).toBe('Eco Glass');
    expect(result.missingData).toHaveLength(0);
  });

  it('places materials with assigned openlca factors into validMaterials when staging resolves', async () => {
    const material = createOpenLCAMaterial({ material_name: 'Barley malt' });

    // OpenLCA API call will fail (no session), but staging_emission_factors resolves
    mockTable('staging_emission_factors', {
      id: 'sef-001',
      name: 'Barley malt',
      co2_factor: 2.1,
      water_factor: 0.5,
      land_factor: 0.3,
      waste_factor: 0.02,
      source: 'Ecoinvent 3.12',
    });

    // ecoinvent_material_proxies won't find anything
    mockTable('ecoinvent_material_proxies', null);

    const result = await validateMaterialsBeforeCalculation([material], 'org-001');

    expect(result.valid).toBe(true);
    expect(result.validMaterials).toHaveLength(1);
    expect(result.missingData).toHaveLength(0);
  });

  it('places materials without factors into missingData', async () => {
    const material = createMaterial({ material_name: 'Unobtainium' });

    // All table lookups return nothing
    mockTable('staging_emission_factors', null);
    mockTable('ecoinvent_material_proxies', null);

    const result = await validateMaterialsBeforeCalculation([material], 'org-001');

    expect(result.valid).toBe(false);
    expect(result.missingData).toHaveLength(1);
    expect(result.missingData[0].material.material_name).toBe('Unobtainium');
    expect(result.missingData[0].error).toContain('No emission factor found');
    expect(result.validMaterials).toHaveLength(0);
  });

  it('correctly splits a mixed list of resolvable and unresolvable materials', async () => {
    const resolvable = createSupplierMaterial({
      id: 'mat-ok',
      material_name: 'Good Glass',
    });
    const unresolvable = createMaterial({
      id: 'mat-bad',
      material_name: 'Mystery Material',
    });

    // supplier_products returns data for the first material
    mockTable('supplier_products', {
      id: 'sp-001',
      product_name: 'Good Glass',
      impact_climate: 1.0,
      impact_water: 0.1,
      impact_waste: 0.01,
      impact_land: 0.02,
    });
    // staging/ecoinvent return nothing for the second
    mockTable('staging_emission_factors', null);
    mockTable('ecoinvent_material_proxies', null);

    const result = await validateMaterialsBeforeCalculation(
      [resolvable, unresolvable],
      'org-001'
    );

    expect(result.valid).toBe(false);
    expect(result.validMaterials).toHaveLength(1);
    expect(result.validMaterials[0].material.id).toBe('mat-ok');
    expect(result.missingData).toHaveLength(1);
    expect(result.missingData[0].material.id).toBe('mat-bad');
  });

  it('calls onProgress callback for each material', async () => {
    const materials = [
      createMaterial({ id: 'a', material_name: 'Alpha', cached_co2_factor: 1.0 }),
      createMaterial({ id: 'b', material_name: 'Beta', cached_co2_factor: 2.0 }),
    ];

    // Let them resolve via cached factor
    mockTable('staging_emission_factors', null);
    mockTable('ecoinvent_material_proxies', null);

    const onProgress = vi.fn();

    await validateMaterialsBeforeCalculation(materials, 'org-001', onProgress);

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledWith(1, 2, 'Alpha');
    expect(onProgress).toHaveBeenCalledWith(2, 2, 'Beta');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. resolveImpactFactors — waterfall resolution order
// ────────────────────────────────────────────────────────────────────────────

describe('resolveImpactFactors', () => {

  describe('self-grown materials', () => {
    it('returns zero impacts for self-grown ingredients', async () => {
      const material = createMaterial({
        material_name: 'Pinot Noir grapes',
        is_self_grown: true,
      });

      const result = await resolveImpactFactors(material, 100, 'org-001');

      expect(result.impact_climate).toBe(0);
      expect(result.impact_water).toBe(0);
      expect(result.impact_land).toBe(0);
      expect(result.data_priority).toBe(1);
      expect(result.gwp_data_source).toBe('viticulture_primary');
    });
  });

  describe('Priority 1: Supplier data source', () => {

    it('resolves from supplier_products (Priority 1a)', async () => {
      const material = createSupplierMaterial({ material_name: 'Organic Cork' });

      mockTable('supplier_products', {
        id: 'sp-001',
        product_name: 'Organic Cork',
        impact_climate: 0.8,
        impact_water: 0.3,
        impact_waste: 0.05,
        impact_land: 0.1,
      });

      const result = await resolveImpactFactors(material, 2, 'org-001');

      expect(result.impact_climate).toBeCloseTo(1.6); // 0.8 * 2
      expect(result.impact_water).toBeCloseTo(0.6);   // 0.3 * 2
      expect(result.data_priority).toBe(1);
      expect(result.source_reference).toContain('Supplier Product');
      expect(result.is_hybrid_source).toBe(false);
      expect(result.resolved_factor_id).toBe('sp-001');
    });

    it('falls through to platform_supplier_products (Priority 1b) when 1a has no data', async () => {
      const material = createSupplierMaterial({ material_name: 'Platform Cork' });

      // supplier_products returns no impact data
      mockTable('supplier_products', {
        id: 'sp-001',
        product_name: 'Platform Cork',
        impact_climate: null,
        impact_water: null,
        impact_waste: null,
        impact_land: null,
      });

      mockTable('platform_supplier_products', {
        id: 'psp-001',
        product_name: 'Platform Cork',
        impact_climate: 1.2,
        impact_water: 0.4,
        impact_waste: 0.02,
        impact_land: 0.15,
      });

      const result = await resolveImpactFactors(material, 1, 'org-001');

      expect(result.impact_climate).toBeCloseTo(1.2);
      expect(result.data_priority).toBe(1);
      expect(result.source_reference).toContain('Platform Supplier');
    });

    it('falls through to product LCA (Priority 1c) when 1a and 1b fail', async () => {
      const material = createSupplierMaterial({ material_name: 'LCA Cork' });

      // supplier_products: no data
      mockTable('supplier_products', null);
      // platform_supplier_products: no data
      mockTable('platform_supplier_products', null);
      // products table returns the linked product
      mockTable('products', { id: 'sp-001', organization_id: 'org-001' });
      // product_carbon_footprints table returns a completed LCA
      mockTable('product_carbon_footprints', {
        id: 'pcf-001',
        aggregated_impacts: {
          climate_change_gwp100: 3.5,
          water_consumption: 0.8,
          land_use: 0.2,
          waste: 0.05,
        },
      });

      const result = await resolveImpactFactors(material, 1, 'org-001');

      expect(result.impact_climate).toBeCloseTo(3.5);
      expect(result.data_priority).toBe(1);
      expect(result.data_quality_tag).toBe('Primary_Verified');
      expect(result.confidence_score).toBe(95);
      expect(result.supplier_lca_id).toBe('pcf-001');
    });

    it('tracks fallback event when all supplier lookups fail', async () => {
      const material = createSupplierMaterial({
        material_name: 'No-data Cork',
        cached_co2_factor: 0.5, // So it doesn't throw
      });

      // All supplier tables return nothing
      mockTable('supplier_products', null);
      mockTable('platform_supplier_products', null);
      mockTable('products', null);
      mockTable('staging_emission_factors', null);
      mockTable('ecoinvent_material_proxies', null);

      const fallbackEvents: FallbackEvent[] = [];
      const result = await resolveImpactFactors(material, 1, 'org-001', fallbackEvents);

      expect(fallbackEvents.length).toBeGreaterThanOrEqual(1);
      expect(fallbackEvents[0].attempted_priority).toContain('Supplier');
      // Should resolve via cached factor
      expect(result.gwp_data_source).toBe('Cached');
    });
  });

  describe('Priority 2.5: OpenLCA live calculation', () => {

    it('resolves from OpenLCA API when session and data_source_id are present', async () => {
      const material = createOpenLCAMaterial({ material_name: 'Glass bottle production' });

      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          processName: 'glass production',
          geography: 'RER',
          database: 'ecoinvent',
          impacts: {
            impact_climate: 0.9,
            impact_climate_fossil: 0.75,
            impact_climate_biogenic: 0.1,
            impact_water: 0.05,
            impact_land: 0.02,
          },
        }),
      });

      const result = await resolveImpactFactors(material, 1, 'org-001');

      expect(result.impact_climate).toBeCloseTo(0.9);
      expect(result.data_priority).toBe(2);
      expect(result.data_quality_grade).toBe('HIGH');
      expect(result.confidence_score).toBe(85);
      expect(result.gwp_data_source).toBe('OpenLCA/ecoinvent');
      expect(result.resolved_factor_id).toBe('olca-uuid-001');
    });

    it('falls through to staging factors when OpenLCA API returns error', async () => {
      const material = createOpenLCAMaterial({ material_name: 'Barley malt' });

      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      });

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Server unavailable' }),
      });

      // Staging factor fallback — sequence mock: first call (local ID check) returns null,
      // subsequent calls (name-based lookup) return data
      fromMocks['staging_emission_factors'] = createSequenceQueryMock(
        { data: null, error: null },
        { data: {
          id: 'sef-001',
          name: 'Barley malt',
          co2_factor: 2.1,
          water_factor: 0.5,
          land_factor: 0.3,
          waste_factor: 0.02,
          source: 'DEFRA 2025',
        }, error: null }
      );
      mockTable('ecoinvent_material_proxies', null);

      const fallbackEvents: FallbackEvent[] = [];
      const result = await resolveImpactFactors(material, 1, 'org-001', fallbackEvents);

      expect(result.impact_climate).toBeCloseTo(2.1);
      expect(result.data_priority).toBe(3);
      expect(fallbackEvents.some(e => e.attempted_priority.includes('OpenLCA'))).toBe(true);
    });

    it('falls through when OpenLCA fetch throws (e.g. timeout)', async () => {
      const material = createOpenLCAMaterial({ material_name: 'Wheat flour' });

      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      });

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      // Staging fallback — sequence mock: first call (local ID check) returns null,
      // subsequent calls (name-based lookup) return data
      fromMocks['staging_emission_factors'] = createSequenceQueryMock(
        { data: null, error: null },
        { data: {
          id: 'sef-002',
          name: 'Wheat flour',
          co2_factor: 0.7,
          source: 'Ecoinvent 3.12',
        }, error: null }
      );
      mockTable('ecoinvent_material_proxies', null);

      const fallbackEvents: FallbackEvent[] = [];
      const result = await resolveImpactFactors(material, 1, 'org-001', fallbackEvents);

      expect(result.data_priority).toBe(3);
      expect(fallbackEvents).toHaveLength(1);
      expect(fallbackEvents[0].fallback_reason).toContain('timeout');
    });
  });

  describe('Priority 3: Ecoinvent proxy fallback (name-based lookup)', () => {

    it('resolves from ecoinvent_material_proxies by name when direct ID fails', async () => {
      const material = createOpenLCAMaterial({
        material_name: 'Aluminium can',
        matched_source_name: 'aluminium alloy production',
      });

      // No session for OpenLCA
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      // Direct ID lookup returns nothing useful
      // But name-based lookup in ecoinvent_material_proxies returns a match
      mockTable('ecoinvent_material_proxies', {
        id: 'emp-001',
        material_name: 'aluminium alloy production, primary',
        geography: 'GLO',
        impact_climate: 8.5,
        impact_climate_fossil: 7.5,
        impact_climate_biogenic: 0.5,
        impact_water: 1.2,
        impact_land_use: 0.3,
        ecoinvent_version: '3.12',
      });

      // Staging also returns nothing
      mockTable('staging_emission_factors', null);

      const result = await resolveImpactFactors(material, 1, 'org-001');

      expect(result.impact_climate).toBeCloseTo(8.5);
      expect(result.data_priority).toBe(3);
      expect(result.source_reference).toContain('Ecoinvent 3.12');
      expect(result.source_reference).toContain('aluminium alloy production');
    });

    it('resolves from ecoinvent_material_proxies by process name when material name fails', async () => {
      const material = createOpenLCAMaterial({
        material_name: 'Custom aluminium widget',
        matched_source_name: 'aluminium alloy, AlMg3',
      });

      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      // Set up the mock so that:
      // - Direct ID lookup fails
      // - Name search (ilike material_name) returns null first two times (material_name + matched_source_name)
      // - Process name search (ilike ecoinvent_process_name) returns a match
      // We need a more sophisticated mock here since the same table is queried multiple times
      const ecoinventMock = createQueryMock({ data: null, error: null });
      // The process name search will eventually find something
      let ecoinventCallCount = 0;
      (ecoinventMock.maybeSingle as ReturnType<typeof vi.fn>).mockImplementation(() => {
        ecoinventCallCount++;
        // The later calls (process name search) return data
        if (ecoinventCallCount >= 3) {
          return Promise.resolve({
            data: {
              id: 'emp-002',
              material_name: 'aluminium alloy, AlMg3',
              ecoinvent_process_name: 'aluminium alloy production, AlMg3',
              geography: 'RER',
              impact_climate: 6.2,
              impact_water: 0.8,
              ecoinvent_version: '3.12',
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });
      fromMocks['ecoinvent_material_proxies'] = ecoinventMock;
      mockTable('staging_emission_factors', null);

      const result = await resolveImpactFactors(material, 1, 'org-001');

      expect(result.impact_climate).toBeCloseTo(6.2);
      expect(result.data_priority).toBe(3);
    });
  });

  describe('Priority 3: Staging emission factors', () => {

    it('resolves from staging_emission_factors by direct ID', async () => {
      const material = createMaterial({
        material_name: 'Corrugated cardboard',
        data_source: 'staging',
        data_source_id: 'sef-100',
      });

      mockTable('staging_emission_factors', {
        id: 'sef-100',
        name: 'Corrugated cardboard box',
        co2_factor: 0.9,
        water_factor: 0.4,
        land_factor: 0.1,
        waste_factor: 0.03,
        co2_fossil_factor: 0.8,
        co2_biogenic_factor: 0.1,
        source: 'DEFRA 2025',
        gwp_methodology: 'IPCC AR6',
      });
      mockTable('ecoinvent_material_proxies', null);

      const result = await resolveImpactFactors(material, 10, 'org-001');

      expect(result.impact_climate).toBeCloseTo(9.0);   // 0.9 * 10
      expect(result.impact_climate_fossil).toBeCloseTo(8.0);  // 0.8 * 10
      expect(result.impact_climate_biogenic).toBeCloseTo(1.0); // 0.1 * 10
      expect(result.impact_water).toBeCloseTo(4.0);
      expect(result.data_priority).toBe(3);
      expect(result.data_quality_tag).toBe('Secondary_Modelled'); // has fossil/biogenic split
    });

    it('estimates fossil/biogenic split when factors are absent (85%/15%)', async () => {
      const material = createMaterial({
        material_name: 'Generic plastic',
        data_source: 'staging',
        data_source_id: 'sef-200',
      });

      mockTable('staging_emission_factors', {
        id: 'sef-200',
        name: 'Generic plastic',
        co2_factor: 4.0,
        // No co2_fossil_factor or co2_biogenic_factor
        source: 'Internal',
      });
      mockTable('ecoinvent_material_proxies', null);

      const result = await resolveImpactFactors(material, 1, 'org-001');

      expect(result.impact_climate).toBeCloseTo(4.0);
      expect(result.impact_climate_fossil).toBeCloseTo(3.4);  // 4.0 * 0.85
      expect(result.impact_climate_biogenic).toBeCloseTo(0.6); // 4.0 * 0.15
      expect(result.data_quality_tag).toBe('Secondary_Estimated'); // no split = estimated
    });
  });

  describe('DEFRA hybrid path (energy/transport/commuting categories)', () => {

    it('resolves DEFRA+Ecoinvent hybrid for energy materials', async () => {
      const material = createMaterial({
        material_name: 'Natural gas combustion',
        material_type: 'ingredient',
        category_type: 'SCOPE_1_2_ENERGY',
      });

      mockTable('defra_ecoinvent_impact_mappings', {
        defra_factor_name: 'Natural gas combustion',
        ecoinvent_proxy_category: 'natural_gas',
        ecoinvent_proxy_id: 'emp-gas',
      });

      mockTable('staging_emission_factors', {
        id: 'sef-gas',
        name: 'Natural gas combustion',
        co2_factor: 2.0,
      });

      mockTable('ecoinvent_material_proxies', {
        id: 'emp-gas',
        material_category: 'natural_gas',
        impact_climate: 2.5,
        impact_water: 0.01,
        impact_land: 0.001,
      });

      const result = await resolveImpactFactors(material, 5, 'org-001');

      expect(result.data_priority).toBe(2);
      expect(result.is_hybrid_source).toBe(true);
      expect(result.gwp_data_source).toBe('DEFRA 2025');
      expect(result.non_gwp_data_source).toBe('Ecoinvent 3.12');
      expect(result.impact_climate).toBeCloseTo(10); // 2.0 * 5 (from DEFRA)
    });
  });

  describe('Last resort: Cached CO2 factor', () => {

    it('uses cached_co2_factor when all other lookups fail', async () => {
      const material = createMaterial({
        material_name: 'Rare Material',
        cached_co2_factor: 3.5,
        matched_source_name: 'Rare Material EF',
      });

      // All tables return nothing
      mockTable('staging_emission_factors', null);
      mockTable('ecoinvent_material_proxies', null);

      const result = await resolveImpactFactors(material, 2, 'org-001');

      expect(result.impact_climate).toBeCloseTo(7.0); // 3.5 * 2
      expect(result.impact_climate_fossil).toBeCloseTo(5.95); // 7.0 * 0.85
      expect(result.impact_climate_biogenic).toBeCloseTo(1.05); // 7.0 * 0.15
      expect(result.data_priority).toBe(3);
      expect(result.data_quality_grade).toBe('LOW');
      expect(result.confidence_score).toBe(30);
      expect(result.gwp_data_source).toBe('Cached');
      expect(result.source_reference).toContain('Cached factor');
    });

    it('does not use cached_co2_factor if it is zero', async () => {
      const material = createMaterial({
        material_name: 'Zero Cached Material',
        cached_co2_factor: 0,
      });

      mockTable('staging_emission_factors', null);
      mockTable('ecoinvent_material_proxies', null);

      await expect(
        resolveImpactFactors(material, 1, 'org-001')
      ).rejects.toThrow('No emission factor found');
    });

    it('does not use cached_co2_factor if it is null', async () => {
      const material = createMaterial({
        material_name: 'Null Cached Material',
        cached_co2_factor: null,
      });

      mockTable('staging_emission_factors', null);
      mockTable('ecoinvent_material_proxies', null);

      await expect(
        resolveImpactFactors(material, 1, 'org-001')
      ).rejects.toThrow('No emission factor found');
    });
  });

  describe('Complete miss', () => {

    it('throws an error when no factor is found anywhere', async () => {
      const material = createMaterial({ material_name: 'Unobtainium' });

      mockTable('staging_emission_factors', null);
      mockTable('ecoinvent_material_proxies', null);

      await expect(
        resolveImpactFactors(material, 1, 'org-001')
      ).rejects.toThrow('No emission factor found for material: Unobtainium');
    });

    it('logs the factor miss via RPC', async () => {
      const material = createMaterial({
        material_name: 'Unknown Material',
        product_id: 'prod-123',
      });

      mockTable('staging_emission_factors', null);
      mockTable('ecoinvent_material_proxies', null);

      await resolveImpactFactors(material, 1, 'org-001').catch(() => {});

      // Give the fire-and-forget RPC time to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRpc).toHaveBeenCalledWith(
        'log_emission_factor_request',
        expect.objectContaining({
          p_material_name: 'Unknown Material',
          p_context: 'calculation_failure',
        })
      );
    });
  });

  describe('edge cases', () => {

    it('handles zero quantity correctly', async () => {
      const material = createSupplierMaterial({ material_name: 'Zero Glass' });

      mockTable('supplier_products', {
        id: 'sp-001',
        product_name: 'Zero Glass',
        impact_climate: 1.5,
        impact_water: 0.2,
        impact_waste: 0.01,
        impact_land: 0.05,
      });

      const result = await resolveImpactFactors(material, 0, 'org-001');

      expect(result.impact_climate).toBe(0);
      expect(result.impact_water).toBe(0);
    });

    it('handles material with null/undefined optional fields', async () => {
      const material = createMaterial({
        material_name: 'Basic Material',
        matched_source_name: undefined,
        origin_country: undefined,
        packaging_category: undefined,
        data_source: undefined,
        data_source_id: undefined,
        supplier_product_id: undefined,
        cached_co2_factor: 1.0, // Needs at least one fallback
      });

      mockTable('staging_emission_factors', null);
      mockTable('ecoinvent_material_proxies', null);

      const result = await resolveImpactFactors(material, 1, 'org-001');

      // Should resolve via cached factor without crashing
      expect(result.impact_climate).toBeCloseTo(1.0);
      expect(result.gwp_data_source).toBe('Cached');
    });

    it('correctly detects MANUFACTURING_MATERIAL category by default', async () => {
      const material = createMaterial({
        material_name: 'Glass bottle',
        cached_co2_factor: 1.0,
      });

      mockTable('staging_emission_factors', null);
      mockTable('ecoinvent_material_proxies', null);

      const result = await resolveImpactFactors(material, 1, 'org-001');

      expect(result.category_type).toBe('MANUFACTURING_MATERIAL');
    });

    it('auto-detects SCOPE_1_2_ENERGY from material name', async () => {
      const material = createMaterial({
        material_name: 'Electricity grid mix UK',
        cached_co2_factor: 0.25,
      });

      mockTable('staging_emission_factors', null);
      mockTable('ecoinvent_material_proxies', null);
      mockTable('defra_ecoinvent_impact_mappings', null);

      const result = await resolveImpactFactors(material, 100, 'org-001');

      expect(result.category_type).toBe('SCOPE_1_2_ENERGY');
    });

    it('auto-detects SCOPE_3_TRANSPORT from material name', async () => {
      const material = createMaterial({
        material_name: 'HGV freight transport',
        cached_co2_factor: 0.1,
      });

      mockTable('staging_emission_factors', null);
      mockTable('ecoinvent_material_proxies', null);
      mockTable('defra_ecoinvent_impact_mappings', null);

      const result = await resolveImpactFactors(material, 1, 'org-001');

      expect(result.category_type).toBe('SCOPE_3_TRANSPORT');
    });

    it('does not attempt OpenLCA when organizationId is missing', async () => {
      const material = createOpenLCAMaterial({ material_name: 'Some ingredient' });

      // Staging will resolve it
      mockTable('staging_emission_factors', {
        id: 'sef-010',
        name: 'Some ingredient',
        co2_factor: 1.5,
        source: 'Internal',
      });
      mockTable('ecoinvent_material_proxies', null);

      const result = await resolveImpactFactors(material, 1);

      // Should not have called fetch (no OpenLCA attempt)
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.data_priority).toBe(3);
    });

    it('propagates fallbackEvents array across resolution attempts', async () => {
      const material = createSupplierMaterial({
        material_name: 'Fallback Tracker',
        cached_co2_factor: 0.5,
      });

      // All supplier tables fail
      mockTable('supplier_products', null);
      mockTable('platform_supplier_products', null);
      mockTable('products', null);
      mockTable('staging_emission_factors', null);
      mockTable('ecoinvent_material_proxies', null);

      const events: FallbackEvent[] = [];
      await resolveImpactFactors(material, 1, 'org-001', events);

      expect(events.length).toBeGreaterThanOrEqual(1);
      // Verify the fallback event structure
      const event = events[0];
      expect(event).toHaveProperty('material_name', 'Fallback Tracker');
      expect(event).toHaveProperty('material_id', 'mat-001');
      expect(event).toHaveProperty('attempted_priority');
      expect(event).toHaveProperty('fallback_reason');
    });
  });
});
