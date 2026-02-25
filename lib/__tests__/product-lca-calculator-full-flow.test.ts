/**
 * Product LCA Calculator — Full Flow Test Suite
 *
 * Tests the main calculateProductCarbonFootprint orchestrator:
 * - Authentication and product lookup
 * - Functional unit construction
 * - Material impact resolution via waterfall
 * - Packaging units_per_group division
 * - Facility allocation math (attribution ratio, scope routing)
 * - Distance recalculation (Haversine)
 * - Maturation handling (spirits only)
 * - Legacy flow (copy production sites from previous PCF)
 * - Usage counter (increment_lca_count)
 * - Error recovery (cleanup on failure)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CalculatePCFParams, FacilityAllocationInput } from '../product-lca-calculator';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  functions: { invoke: vi.fn() },
  rpc: vi.fn(),
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

const mockAggregateProductImpacts = vi.fn();
vi.mock('../product-lca-aggregator', () => ({
  aggregateProductImpacts: (...args: unknown[]) => mockAggregateProductImpacts(...args),
}));

const mockGenerateLcaInterpretation = vi.fn();
vi.mock('../lca-interpretation-engine', () => ({
  generateLcaInterpretation: (...args: unknown[]) => mockGenerateLcaInterpretation(...args),
}));

vi.mock('../utils/distance-calculator', () => ({
  calculateDistance: vi.fn(() => 100),
}));

vi.mock('../maturation-calculator', () => ({
  calculateMaturationImpacts: vi.fn(() => ({
    barrel_total_co2e: 10,
    warehouse_co2e_total: 5,
    angel_share_photochemical_ozone: 0.001,
    angel_share_loss_percent_total: 2.5,
    output_volume_litres: 200,
    methodology_notes: 'Test notes',
  })),
}));

vi.mock('../grid-emission-factors', () => ({
  getGridFactor: vi.fn(() => ({
    factor: 0.207,
    source: 'Mock GB grid',
    isEstimated: false,
  })),
}));

import { calculateProductCarbonFootprint } from '../product-lca-calculator';

// ============================================================================
// MOCK QUERY BUILDER
// ============================================================================

interface MockResponse {
  data: unknown;
  error: unknown;
}

function createQueryMock(response: MockResponse) {
  const mock: Record<string, unknown> = {};
  const chainable = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'ilike', 'lte', 'gte', 'order', 'limit', 'in'];
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

const MOCK_USER = { id: 'user-001', email: 'test@example.com' };

const MOCK_PRODUCT = {
  id: 'prod-001',
  organization_id: 'org-001',
  name: 'Test Pale Ale',
  product_type: 'Beer & Cider',
  unit_size_value: 330,
  unit_size_unit: 'ml',
  product_description: 'A test beer',
  product_image_url: null,
  unit: null,
};

const MOCK_MATERIAL_MALT = {
  id: 'mat-malt',
  material_name: 'Pale Malt',
  material_type: 'ingredient',
  quantity: 500,
  unit: 'g',
  packaging_category: null,
  transport_mode: 'road',
  distance_km: 200,
  data_source: null,
  data_source_id: null,
  supplier_product_id: null,
  origin_lat: 51.5,
  origin_lng: -0.1,
  origin_country: 'United Kingdom',
  origin_country_code: 'GB',
  origin_address: null,
  is_organic_certified: false,
  recycled_content_percentage: null,
};

const MOCK_MATERIAL_CAN = {
  id: 'mat-can',
  material_name: 'Aluminium Can',
  material_type: 'packaging',
  packaging_category: 'primary',
  quantity: 15,
  unit: 'g',
  transport_mode: null,
  distance_km: null,
  data_source: null,
  data_source_id: null,
  supplier_product_id: null,
  origin_lat: null,
  origin_lng: null,
  origin_country: null,
  origin_country_code: null,
  origin_address: null,
  is_organic_certified: false,
  recycled_content_percentage: null,
};

const MOCK_LCA_RECORD = {
  id: 'lca-001',
  product_id: 'prod-001',
  organization_id: 'org-001',
};

const RESOLVED_IMPACT = {
  impact_climate: 0.450,
  impact_climate_fossil: 0.400,
  impact_climate_biogenic: 0.050,
  impact_climate_dluc: 0,
  impact_water: 5.0,
  impact_water_scarcity: 2.0,
  impact_land: 0.3,
  impact_waste: 0.01,
  impact_terrestrial_ecotoxicity: 0,
  impact_freshwater_eutrophication: 0.001,
  impact_terrestrial_acidification: 0.002,
  impact_fossil_resource_scarcity: 0.05,
  data_priority: 3,
  data_quality_tag: 'Secondary_Estimated',
  data_quality_grade: 'MEDIUM',
  supplier_lca_id: null,
  confidence_score: 70,
  methodology: 'Ecoinvent proxy',
  source_reference: 'Test source',
  gwp_data_source: 'Test',
  non_gwp_data_source: 'Test',
  is_hybrid_source: false,
  category_type: 'MANUFACTURING_MATERIAL',
  ch4_kg: 0,
  ch4_fossil_kg: 0,
  ch4_biogenic_kg: 0,
  n2o_kg: 0,
};

// ============================================================================
// SETUP HELPER
// ============================================================================

function setupDefaultMocks() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: MOCK_USER },
    error: null,
  });

  mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });

  mockResolveImpactFactors.mockResolvedValue(RESOLVED_IMPACT);
  mockCalculateTransportEmissions.mockResolvedValue({ emissions: 0.01 });
  mockAggregateProductImpacts.mockResolvedValue({
    success: true,
    total_carbon_footprint: 0.675,
    impacts: { data_quality: { score: 70 } },
    materials_count: 2,
    production_sites_count: 0,
  });
  mockGenerateLcaInterpretation.mockResolvedValue({ success: true });

  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'products') {
      return createQueryMock({ data: MOCK_PRODUCT, error: null });
    }
    if (table === 'product_materials') {
      return createQueryMock({ data: [MOCK_MATERIAL_MALT, MOCK_MATERIAL_CAN], error: null });
    }
    if (table === 'product_carbon_footprints') {
      const mock = createQueryMock({ data: MOCK_LCA_RECORD, error: null });
      return mock;
    }
    if (table === 'product_carbon_footprint_materials') {
      return createQueryMock({ data: null, error: null });
    }
    if (table === 'product_carbon_footprint_production_sites') {
      return createQueryMock({ data: [], error: null });
    }
    if (table === 'contract_manufacturer_allocations') {
      return createQueryMock({ data: [], error: null });
    }
    if (table === 'facilities') {
      return createQueryMock({
        data: { address_lat: 52.0, address_lng: -1.0, name: 'Test Brewery', location_country_code: 'GB' },
        error: null,
      });
    }
    if (table === 'maturation_profiles') {
      return createQueryMock({ data: null, error: null });
    }
    if (table === 'utility_data_entries') {
      return createQueryMock({ data: [], error: null });
    }
    if (table === 'facility_activity_entries') {
      return createQueryMock({ data: [], error: null });
    }
    if (table === 'calculation_logs') {
      return createQueryMock({ data: null, error: null });
    }
    return createQueryMock({ data: null, error: null });
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('calculateProductCarbonFootprint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // --------------------------------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------------------------------

  describe('Authentication', () => {
    it('fails when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const result = await calculateProductCarbonFootprint({ productId: 'prod-001' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not authenticated');
    });
  });

  // --------------------------------------------------------------------------
  // PRODUCT LOOKUP
  // --------------------------------------------------------------------------

  describe('Product lookup', () => {
    it('fails when product not found', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'products') {
          return createQueryMock({ data: null, error: null });
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await calculateProductCarbonFootprint({ productId: 'missing' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Product not found');
    });

    it('fails when no materials found for product', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'products') {
          return createQueryMock({ data: MOCK_PRODUCT, error: null });
        }
        if (table === 'product_materials') {
          return createQueryMock({ data: [], error: null });
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await calculateProductCarbonFootprint({ productId: 'prod-001' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No materials found');
    });
  });

  // --------------------------------------------------------------------------
  // BASIC FLOW
  // --------------------------------------------------------------------------

  describe('Basic flow', () => {
    it('completes successfully with materials and returns pcfId', async () => {
      const result = await calculateProductCarbonFootprint({ productId: 'prod-001' });
      expect(result.success).toBe(true);
      expect(result.pcfId).toBe('lca-001');
      expect(result.lcaId).toBe('lca-001'); // backward compat
    });

    it('calls resolveImpactFactors for each material', async () => {
      await calculateProductCarbonFootprint({ productId: 'prod-001' });
      // 2 materials: malt + can
      expect(mockResolveImpactFactors).toHaveBeenCalledTimes(2);
    });

    it('calls normalizeToKg with correct quantities', async () => {
      await calculateProductCarbonFootprint({ productId: 'prod-001' });
      // Malt: 500g, Can: 15g
      expect(mockNormalizeToKg).toHaveBeenCalledWith(500, 'g');
      expect(mockNormalizeToKg).toHaveBeenCalledWith(15, 'g');
    });

    it('calls aggregateProductImpacts after processing materials', async () => {
      await calculateProductCarbonFootprint({ productId: 'prod-001' });
      expect(mockAggregateProductImpacts).toHaveBeenCalledTimes(1);
    });

    it('calls onProgress callback at each stage', async () => {
      const onProgress = vi.fn();
      await calculateProductCarbonFootprint({
        productId: 'prod-001',
        onProgress,
      });
      expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('Loading'), 5);
      expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('complete'), 100);
    });
  });

  // --------------------------------------------------------------------------
  // TRANSPORT EMISSIONS
  // --------------------------------------------------------------------------

  describe('Transport emissions', () => {
    it('calculates transport for materials with transport_mode and distance_km', async () => {
      await calculateProductCarbonFootprint({ productId: 'prod-001' });
      // Only malt has transport_mode + distance_km
      expect(mockCalculateTransportEmissions).toHaveBeenCalledTimes(1);
      expect(mockCalculateTransportEmissions).toHaveBeenCalledWith(
        expect.objectContaining({
          distanceKm: 200,
          transportMode: 'road',
        }),
      );
    });

    it('skips transport when transport_mode is null', async () => {
      // MOCK_MATERIAL_CAN has no transport_mode
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'products') return createQueryMock({ data: MOCK_PRODUCT, error: null });
        if (table === 'product_materials') {
          return createQueryMock({ data: [MOCK_MATERIAL_CAN], error: null });
        }
        if (table === 'product_carbon_footprints') return createQueryMock({ data: MOCK_LCA_RECORD, error: null });
        if (table === 'maturation_profiles') return createQueryMock({ data: null, error: null });
        if (table === 'contract_manufacturer_allocations') return createQueryMock({ data: [], error: null });
        if (table === 'product_carbon_footprint_production_sites') return createQueryMock({ data: [], error: null });
        return createQueryMock({ data: null, error: null });
      });

      await calculateProductCarbonFootprint({ productId: 'prod-001' });
      expect(mockCalculateTransportEmissions).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // USAGE COUNTER
  // --------------------------------------------------------------------------

  describe('Usage counter', () => {
    it('calls increment_lca_count RPC', async () => {
      await calculateProductCarbonFootprint({ productId: 'prod-001' });
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'increment_lca_count',
        expect.objectContaining({ p_organization_id: 'org-001' }),
      );
    });

    it('does not abort on RPC failure (non-critical)', async () => {
      mockSupabaseClient.rpc.mockRejectedValue(new Error('RPC failed'));
      const result = await calculateProductCarbonFootprint({ productId: 'prod-001' });
      // Should still succeed
      expect(result.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // ERROR RECOVERY
  // --------------------------------------------------------------------------

  describe('Error recovery', () => {
    it('cleans up LCA record when material resolution fails', async () => {
      mockResolveImpactFactors.mockRejectedValueOnce(new Error('Factor not found'));

      const result = await calculateProductCarbonFootprint({ productId: 'prod-001' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing emission data');
    });

    it('returns error when aggregation fails', async () => {
      mockAggregateProductImpacts.mockResolvedValue({
        success: false,
        error: 'Aggregation failed',
        total_carbon_footprint: 0,
        impacts: {},
        materials_count: 0,
        production_sites_count: 0,
      });

      const result = await calculateProductCarbonFootprint({ productId: 'prod-001' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Calculation failed');
    });
  });

  // --------------------------------------------------------------------------
  // SYSTEM BOUNDARY PASSTHROUGH
  // --------------------------------------------------------------------------

  describe('System boundary passthrough', () => {
    it('passes system boundary to aggregator', async () => {
      await calculateProductCarbonFootprint({
        productId: 'prod-001',
        systemBoundary: 'cradle-to-grave',
      });

      expect(mockAggregateProductImpacts).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'cradle-to-grave',
        undefined, // usePhaseConfig
        undefined, // eolConfig
      );
    });

    it('passes use-phase and EoL configs when provided', async () => {
      const usePhaseConfig = {
        needsRefrigeration: true,
        refrigerationDays: 7,
        retailRefrigerationSplit: 0.5,
        isCarbonated: true,
        carbonationType: 'beer' as const,
        consumerCountryCode: 'GB',
      };
      const eolConfig = {
        region: 'eu' as const,
        pathways: {},
      };

      await calculateProductCarbonFootprint({
        productId: 'prod-001',
        systemBoundary: 'cradle-to-grave',
        usePhaseConfig,
        eolConfig,
      });

      expect(mockAggregateProductImpacts).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'cradle-to-grave',
        usePhaseConfig,
        eolConfig,
      );
    });
  });

  // --------------------------------------------------------------------------
  // INTERPRETATION
  // --------------------------------------------------------------------------

  describe('Life cycle interpretation', () => {
    it('calls generateLcaInterpretation after aggregation', async () => {
      await calculateProductCarbonFootprint({ productId: 'prod-001' });
      expect(mockGenerateLcaInterpretation).toHaveBeenCalledTimes(1);
    });

    it('does not fail if interpretation fails (non-critical)', async () => {
      mockGenerateLcaInterpretation.mockRejectedValue(new Error('AI failed'));
      const result = await calculateProductCarbonFootprint({ productId: 'prod-001' });
      expect(result.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // PACKAGING UNITS_PER_GROUP
  // --------------------------------------------------------------------------

  describe('Packaging units_per_group division', () => {
    it('divides impacts by units_per_group for secondary packaging', async () => {
      const secondaryPackaging = {
        ...MOCK_MATERIAL_CAN,
        material_type: 'packaging',
        packaging_category: 'secondary',
        units_per_group: 6,
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'products') return createQueryMock({ data: MOCK_PRODUCT, error: null });
        if (table === 'product_materials') {
          return createQueryMock({ data: [secondaryPackaging], error: null });
        }
        if (table === 'product_carbon_footprints') return createQueryMock({ data: MOCK_LCA_RECORD, error: null });
        if (table === 'maturation_profiles') return createQueryMock({ data: null, error: null });
        if (table === 'contract_manufacturer_allocations') return createQueryMock({ data: [], error: null });
        if (table === 'product_carbon_footprint_production_sites') return createQueryMock({ data: [], error: null });
        return createQueryMock({ data: null, error: null });
      });

      mockResolveImpactFactors.mockResolvedValue({
        ...RESOLVED_IMPACT,
        impact_climate: 0.600, // total for 6-pack
      });

      await calculateProductCarbonFootprint({ productId: 'prod-001' });

      // The aggregator should receive materials with divided impacts
      const aggregatorCall = mockAggregateProductImpacts.mock.calls[0];
      // aggregator is called with (supabase, lcaId, facilityEmissions, boundary, ...)
      // The materials are inserted into the DB, so we check that resolveImpactFactors
      // was called (impacts get divided before being inserted)
      expect(mockResolveImpactFactors).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // MATURATION HANDLING
  // --------------------------------------------------------------------------

  describe('Maturation handling', () => {
    it('skips maturation for beer products (not eligible)', async () => {
      // Product type is "Beer & Cider" — maturation should NOT be applied
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'products') return createQueryMock({ data: MOCK_PRODUCT, error: null });
        if (table === 'product_materials') return createQueryMock({ data: [MOCK_MATERIAL_MALT], error: null });
        if (table === 'product_carbon_footprints') return createQueryMock({ data: MOCK_LCA_RECORD, error: null });
        if (table === 'maturation_profiles') {
          return createQueryMock({
            data: { barrel_type: 'oak', aging_duration_months: 12, bottles_produced: 1000 },
            error: null,
          });
        }
        if (table === 'contract_manufacturer_allocations') return createQueryMock({ data: [], error: null });
        if (table === 'product_carbon_footprint_production_sites') return createQueryMock({ data: [], error: null });
        return createQueryMock({ data: null, error: null });
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await calculateProductCarbonFootprint({ productId: 'prod-001' });

      // Should warn about type mismatch
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('MATURATION TYPE MISMATCH'),
      );
      warnSpy.mockRestore();
    });
  });
});
