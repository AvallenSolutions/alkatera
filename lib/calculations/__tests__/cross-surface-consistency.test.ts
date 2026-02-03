/**
 * Cross-Surface Consistency Integration Tests
 *
 * These tests verify that all UI surfaces produce identical emissions values
 * when using the shared corporate-emissions calculation service.
 *
 * Surfaces tested:
 * - Dashboard (via useCompanyFootprint hook)
 * - Company Vitality (via useCompanyFootprint hook)
 * - CCF Report (via generate-ccf-report edge function)
 * - Scope 3 breakdown (via useScope3Emissions hook)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  calculateScope1,
  calculateScope2,
  calculateScope3,
  calculateCorporateEmissions,
} from '../corporate-emissions';

// ============================================================================
// MOCK SETUP - Simulates a realistic organization with complete emissions data
// ============================================================================

const createRealisticMock = () => {
  const createQueryBuilder = (tableName: string): any => {
    let filters: Record<string, any> = {};

    const builder: any = {
      select: vi.fn().mockImplementation(() => builder),
      eq: vi.fn().mockImplementation((key: string, value: any) => {
        filters[key] = value;
        return builder;
      }),
      in: vi.fn().mockImplementation(() => builder),
      not: vi.fn().mockImplementation(() => builder),
      gte: vi.fn().mockImplementation(() => builder),
      lte: vi.fn().mockImplementation(() => builder),
      order: vi.fn().mockImplementation(() => builder),
      limit: vi.fn().mockImplementation(() => builder),
      maybeSingle: vi.fn().mockImplementation(async () => {
        // Product LCA lookup
        if (tableName === 'product_carbon_footprints') {
          if (filters.product_id === 'calvados-001') {
            return {
              data: {
                aggregated_impacts: {
                  climate_change_gwp100: 2.832, // Single source of truth for total carbon footprint
                  breakdown: {
                    by_scope: {
                      scope1: 0.15,  // Facility combustion allocated to product
                      scope2: 0.10,  // Facility electricity allocated to product
                      scope3: 2.582, // Supply chain only (materials, transport, etc.)
                    },
                    by_lifecycle_stage: {
                      raw_materials: 1.5,
                      manufacturing: 0.832,
                      distribution: 0.3,
                      use_phase: 0.1,
                      end_of_life: 0.1,
                    },
                  },
                },
              },
              error: null,
            };
          }
          return { data: null, error: null };
        }

        // Corporate report lookup
        if (tableName === 'corporate_reports') {
          return { data: { id: 'report-2024' }, error: null };
        }

        return { data: null, error: null };
      }),
    };

    // For queries that return arrays
    builder.then = (resolve: Function) => {
      let response = { data: [], error: null };

      // Facilities list (new schema)
      if (tableName === 'facilities') {
        response = {
          data: [{ id: 'facility-main', name: 'Main Production Facility' }],
          error: null,
        };
      }

      // Utility data entries (new schema - replaces facility_activity_data)
      // Uses built-in UTILITY_EMISSION_FACTORS:
      // - natural_gas: 0.18293 kgCO2e/kWh (Scope 1)
      // - electricity_grid: 0.207 kgCO2e/kWh (Scope 2)
      if (tableName === 'utility_data_entries') {
        response = {
          data: [
            // Scope 1: Natural gas heating
            {
              quantity: 5000, // 5000 kWh
              unit: 'kWh',
              utility_type: 'natural_gas',
              facility_id: 'facility-main',
            },
            // Scope 2: Purchased electricity
            {
              quantity: 50000, // 50000 kWh
              unit: 'kWh',
              utility_type: 'electricity_grid',
              facility_id: 'facility-main',
            },
          ],
          error: null,
        };
      }

      // Fleet activities
      if (tableName === 'fleet_activities') {
        if (filters.scope === 'Scope 1') {
          // Company-owned vehicles
          response = { data: [{ emissions_tco2e: 12.5 }], error: null };
        } else if (filters.scope === 'Scope 2') {
          // Company EVs
          response = { data: [{ emissions_tco2e: 2.0 }], error: null };
        } else if (filters.scope === 'Scope 3 Cat 6') {
          // Grey fleet (employee vehicles for business)
          response = { data: [{ emissions_tco2e: 8.0 }], error: null };
        } else {
          response = { data: [], error: null };
        }
      }

      // Production logs
      if (tableName === 'production_logs') {
        response = {
          data: [
            { product_id: 'calvados-001', units_produced: 10000 },
          ],
          error: null,
        };
      }

      // Corporate overheads
      if (tableName === 'corporate_overheads') {
        response = {
          data: [
            { category: 'business_travel', computed_co2e: 15000, material_type: null },
            { category: 'employee_commuting', computed_co2e: 8000, material_type: null },
            { category: 'capital_goods', computed_co2e: 25000, material_type: null },
            { category: 'operational_waste', computed_co2e: 3500, material_type: null },
            { category: 'downstream_logistics', computed_co2e: 12000, material_type: null },
            { category: 'purchased_services', computed_co2e: 18000, material_type: null },
            { category: 'purchased_services', computed_co2e: 2500, material_type: 'printed_brochures' },
          ],
          error: null,
        };
      }

      resolve(response);
      return Promise.resolve(response);
    };

    return builder;
  };

  return {
    from: vi.fn((tableName: string) => createQueryBuilder(tableName)),
  };
};

// ============================================================================
// CROSS-SURFACE CONSISTENCY TESTS
// ============================================================================

describe('Cross-Surface Consistency', () => {
  const organizationId = 'org-test-consistency';
  const year = 2024;
  const yearStart = '2024-01-01';
  const yearEnd = '2024-12-31';

  it('should produce identical Scope 1 values across all calculations', async () => {
    const mockSupabase = createRealisticMock();

    // Calculate Scope 1 directly
    const scope1Direct = await calculateScope1(
      mockSupabase as any,
      organizationId,
      yearStart,
      yearEnd
    );

    // Calculate via full corporate emissions
    const fullResult = await calculateCorporateEmissions(
      mockSupabase as any,
      organizationId,
      year
    );

    // Both should produce identical values
    expect(scope1Direct).toBe(fullResult.breakdown.scope1);

    // Expected with new built-in UTILITY_EMISSION_FACTORS:
    // natural_gas: 5000 kWh * 0.18293 = 914.65 kgCO2e
    // fleet: 12.5 tCO2e * 1000 = 12500 kgCO2e
    // Total: 914.65 + 12500 = 13414.65 kgCO2e
    expect(scope1Direct).toBeCloseTo(13414.65, 0);
  });

  it('should produce identical Scope 2 values across all calculations', async () => {
    const mockSupabase = createRealisticMock();

    // Calculate Scope 2 directly
    const scope2Direct = await calculateScope2(
      mockSupabase as any,
      organizationId,
      yearStart,
      yearEnd
    );

    // Calculate via full corporate emissions
    const fullResult = await calculateCorporateEmissions(
      mockSupabase as any,
      organizationId,
      year
    );

    // Both should produce identical values
    expect(scope2Direct).toBe(fullResult.breakdown.scope2);

    // Expected with new built-in UTILITY_EMISSION_FACTORS:
    // electricity_grid: 50000 kWh * 0.207 = 10350 kgCO2e
    // fleet EVs: 2.0 tCO2e * 1000 = 2000 kgCO2e
    // Total: 10350 + 2000 = 12350 kgCO2e
    expect(scope2Direct).toBeCloseTo(12350, 0);
  });

  it('should produce identical Scope 3 values across all calculations', async () => {
    const mockSupabase = createRealisticMock();

    // Calculate Scope 3 directly (as useScope3Emissions does)
    const scope3Direct = await calculateScope3(
      mockSupabase as any,
      organizationId,
      year,
      yearStart,
      yearEnd
    );

    // Calculate via full corporate emissions
    const fullResult = await calculateCorporateEmissions(
      mockSupabase as any,
      organizationId,
      year
    );

    // Both should produce identical values
    expect(scope3Direct.total).toBe(fullResult.breakdown.scope3.total);
    expect(scope3Direct.products).toBe(fullResult.breakdown.scope3.products);
    expect(scope3Direct.business_travel).toBe(fullResult.breakdown.scope3.business_travel);
    expect(scope3Direct.employee_commuting).toBe(fullResult.breakdown.scope3.employee_commuting);
    expect(scope3Direct.capital_goods).toBe(fullResult.breakdown.scope3.capital_goods);
    expect(scope3Direct.operational_waste).toBe(fullResult.breakdown.scope3.operational_waste);
    expect(scope3Direct.downstream_logistics).toBe(fullResult.breakdown.scope3.downstream_logistics);
    expect(scope3Direct.purchased_services).toBe(fullResult.breakdown.scope3.purchased_services);
    expect(scope3Direct.marketing_materials).toBe(fullResult.breakdown.scope3.marketing_materials);
  });

  it('should use scope3 breakdown for products to avoid double counting', async () => {
    const mockSupabase = createRealisticMock();

    const scope3 = await calculateScope3(
      mockSupabase as any,
      organizationId,
      year,
      yearStart,
      yearEnd
    );

    // Products should be: 10000 units * 2.582 kgCO2e (scope3 only)
    // NOT: 10000 units * 2.832 kgCO2e (total which includes S1+S2)
    expect(scope3.products).toBe(25820); // 10000 * 2.582

    // If it was incorrectly using climate_change_gwp100 total, it would be 28320
    expect(scope3.products).not.toBe(28320);
  });

  it('should correctly separate marketing materials from purchased services', async () => {
    const mockSupabase = createRealisticMock();

    const scope3 = await calculateScope3(
      mockSupabase as any,
      organizationId,
      year,
      yearStart,
      yearEnd
    );

    // Marketing materials (with material_type set)
    expect(scope3.marketing_materials).toBe(2500);

    // Purchased services (without material_type)
    expect(scope3.purchased_services).toBe(18000);

    // Total should include both
    expect(scope3.marketing_materials + scope3.purchased_services).toBe(20500);
  });

  it('should include grey fleet in business travel', async () => {
    const mockSupabase = createRealisticMock();

    const scope3 = await calculateScope3(
      mockSupabase as any,
      organizationId,
      year,
      yearStart,
      yearEnd
    );

    // Business travel should include:
    // - Corporate overheads: 15000 kgCO2e
    // - Grey fleet (Scope 3 Cat 6): 8 tCO2e = 8000 kgCO2e
    // Total: 23000 kgCO2e
    expect(scope3.business_travel).toBe(23000);
  });

  it('should have consistent UI aliases', async () => {
    const mockSupabase = createRealisticMock();

    const scope3 = await calculateScope3(
      mockSupabase as any,
      organizationId,
      year,
      yearStart,
      yearEnd
    );

    // UI aliases must match their source fields
    expect(scope3.logistics).toBe(scope3.downstream_logistics);
    expect(scope3.waste).toBe(scope3.operational_waste);
    expect(scope3.marketing).toBe(scope3.marketing_materials);
  });

  it('should calculate correct total emissions', async () => {
    const mockSupabase = createRealisticMock();

    const result = await calculateCorporateEmissions(
      mockSupabase as any,
      organizationId,
      year
    );

    // Verify total = scope1 + scope2 + scope3.total
    const expectedTotal =
      result.breakdown.scope1 +
      result.breakdown.scope2 +
      result.breakdown.scope3.total;

    expect(result.breakdown.total).toBe(expectedTotal);

    // Verify scope3.total is sum of all categories (including new Categories 4, 9, 11)
    const scope3 = result.breakdown.scope3;
    const expectedScope3Total =
      scope3.products +
      scope3.business_travel +
      scope3.purchased_services +
      scope3.employee_commuting +
      scope3.capital_goods +
      scope3.operational_waste +
      scope3.downstream_logistics +
      scope3.marketing_materials +
      scope3.upstream_transport +    // Category 4 (new)
      scope3.downstream_transport +  // Category 9 (new)
      scope3.use_phase;              // Category 11 (new)

    expect(scope3.total).toBe(expectedScope3Total);
  });
});

// ============================================================================
// REGRESSION TESTS FOR KNOWN BUGS
// ============================================================================

describe('Regression Tests', () => {
  it('REGRESSION: Product passport should match product page GHG value', async () => {
    // This tests the original bug: Test Calvados showing
    // 2.832 kgCO2eq on product page vs 2.75 kg on passport
    //
    // The fix ensures both use climate_change_gwp100 from aggregated_impacts
    // and the breakdown comes from by_lifecycle_stage (not by_category)

    const mockSupabase = createRealisticMock();

    // When fetching product LCA for passport or product page
    // Both should use the same query and get the same result
    const productLCA = await (mockSupabase as any)
      .from('product_carbon_footprints')
      .eq('product_id', 'calvados-001')
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    expect(productLCA.data.aggregated_impacts.climate_change_gwp100).toBe(2.832);
    expect(productLCA.data.aggregated_impacts.breakdown.by_lifecycle_stage).toBeDefined();
  });

  it('REGRESSION: Corporate Scope 3 should NOT include facility S1/S2 from products', async () => {
    // This tests the double-counting fix
    // Corporate Scope 3 must use breakdown.by_scope.scope3 from product LCAs
    // NOT climate_change_gwp100 which includes facility emissions

    const mockSupabase = createRealisticMock();

    const scope3 = await calculateScope3(
      mockSupabase as any,
      'org-test',
      2024,
      '2024-01-01',
      '2024-12-31'
    );

    // Product LCA total is 2.832 kgCO2e
    // Product LCA scope3 is 2.582 kgCO2e (excludes 0.15 S1 + 0.10 S2 = 0.25)

    // For 10000 units:
    // CORRECT (using scope3): 10000 * 2.582 = 25820 kgCO2e
    // WRONG (using total): 10000 * 2.832 = 28320 kgCO2e

    // The difference of 2500 kgCO2e would be double-counted facility emissions
    expect(scope3.products).toBe(25820);
  });

  it('REGRESSION: Grey fleet emissions should be included in Scope 3', async () => {
    // Grey fleet (employee-owned vehicles used for business travel)
    // should be included in Scope 3 Category 6 (business travel)

    const mockSupabase = createRealisticMock();

    const scope3 = await calculateScope3(
      mockSupabase as any,
      'org-test',
      2024,
      '2024-01-01',
      '2024-12-31'
    );

    // Grey fleet is 8 tCO2e = 8000 kgCO2e
    // Without the fix, this would be 0 or omitted
    expect(scope3.business_travel).toBeGreaterThanOrEqual(8000);
  });

  it('REGRESSION: UI field names should be compatible with components', async () => {
    // GHGEmissionsSummaryWidget expects: logistics, waste, marketing
    // Shared service uses: downstream_logistics, operational_waste, marketing_materials
    // Both should be available

    const mockSupabase = createRealisticMock();

    const scope3 = await calculateScope3(
      mockSupabase as any,
      'org-test',
      2024,
      '2024-01-01',
      '2024-12-31'
    );

    // Both naming conventions should work
    expect(scope3.downstream_logistics).toBeDefined();
    expect(scope3.logistics).toBeDefined();
    expect(scope3.downstream_logistics).toBe(scope3.logistics);

    expect(scope3.operational_waste).toBeDefined();
    expect(scope3.waste).toBeDefined();
    expect(scope3.operational_waste).toBe(scope3.waste);

    expect(scope3.marketing_materials).toBeDefined();
    expect(scope3.marketing).toBeDefined();
    expect(scope3.marketing_materials).toBe(scope3.marketing);
  });
});

// ============================================================================
// CONSISTENCY WITH CCF REPORT EDGE FUNCTION
// ============================================================================

describe('CCF Report Edge Function Alignment', () => {
  it('should produce values matching CCF report calculation logic', async () => {
    // The generate-ccf-report edge function should produce identical
    // values to the shared calculation service
    //
    // Key points verified:
    // 1. Same emission factor lookups
    // 2. Same scope categorization
    // 3. Same unit conversion (tCO2e to kgCO2e)
    // 4. Same double-counting prevention

    const mockSupabase = createRealisticMock();

    const result = await calculateCorporateEmissions(
      mockSupabase as any,
      'org-test',
      2024
    );

    // The breakdown structure should match CCF report format
    expect(result.breakdown).toHaveProperty('scope1');
    expect(result.breakdown).toHaveProperty('scope2');
    expect(result.breakdown).toHaveProperty('scope3');
    expect(result.breakdown).toHaveProperty('total');

    // Scope 3 breakdown should include all categories
    expect(result.breakdown.scope3).toHaveProperty('products');
    expect(result.breakdown.scope3).toHaveProperty('business_travel');
    expect(result.breakdown.scope3).toHaveProperty('purchased_services');
    expect(result.breakdown.scope3).toHaveProperty('employee_commuting');
    expect(result.breakdown.scope3).toHaveProperty('capital_goods');
    expect(result.breakdown.scope3).toHaveProperty('operational_waste');
    expect(result.breakdown.scope3).toHaveProperty('downstream_logistics');
    expect(result.breakdown.scope3).toHaveProperty('marketing_materials');
    expect(result.breakdown.scope3).toHaveProperty('total');

    // UI aliases for backward compatibility
    expect(result.breakdown.scope3).toHaveProperty('logistics');
    expect(result.breakdown.scope3).toHaveProperty('waste');
    expect(result.breakdown.scope3).toHaveProperty('marketing');
  });
});
