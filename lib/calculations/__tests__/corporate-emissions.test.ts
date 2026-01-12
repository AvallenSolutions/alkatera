import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateScope1,
  calculateScope2,
  calculateScope3,
  calculateCorporateEmissions,
  Scope3Breakdown,
  CorporateEmissionsResult,
} from '../corporate-emissions';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Create mock Supabase client
const createMockSupabase = (mockResponses: Record<string, any> = {}) => {
  const createQueryBuilder = (tableName: string) => {
    const queryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => {
        return Promise.resolve(mockResponses[tableName] || { data: null, error: null });
      }),
    };

    // For queries that return arrays
    queryBuilder.then = (resolve: Function) => {
      const response = mockResponses[tableName] || { data: [], error: null };
      resolve(response);
      return Promise.resolve(response);
    };

    return queryBuilder;
  };

  return {
    from: vi.fn((tableName: string) => createQueryBuilder(tableName)),
  };
};

// ============================================================================
// SCOPE 1 TESTS
// ============================================================================

describe('calculateScope1', () => {
  it('should return 0 when no facility or fleet data exists', async () => {
    const mockSupabase = createMockSupabase({
      facility_activity_data: { data: [], error: null },
      fleet_activities: { data: [], error: null },
    });

    const result = await calculateScope1(
      mockSupabase as any,
      'org-123',
      '2024-01-01',
      '2024-12-31'
    );

    expect(result).toBe(0);
  });

  it('should calculate Scope 1 from facility data with emission factors', async () => {
    const mockSupabase = createMockSupabase({
      facility_activity_data: {
        data: [
          {
            quantity: 100,
            scope_1_2_emission_sources: {
              scope: 'Scope 1',
              emission_factor_id: 'factor-1',
            },
          },
        ],
        error: null,
      },
      emissions_factors: { data: { value: '2.5' }, error: null },
      fleet_activities: { data: [], error: null },
    });

    const result = await calculateScope1(
      mockSupabase as any,
      'org-123',
      '2024-01-01',
      '2024-12-31'
    );

    // 100 quantity * 2.5 factor = 250 kgCO2e
    expect(result).toBe(250);
  });

  it('should add fleet Scope 1 emissions (converted from tonnes to kg)', async () => {
    const mockSupabase = createMockSupabase({
      facility_activity_data: { data: [], error: null },
      fleet_activities: {
        data: [{ emissions_tco2e: 5 }], // 5 tonnes
        error: null,
      },
    });

    const result = await calculateScope1(
      mockSupabase as any,
      'org-123',
      '2024-01-01',
      '2024-12-31'
    );

    // 5 tonnes * 1000 = 5000 kgCO2e
    expect(result).toBe(5000);
  });

  it('should filter out Scope 2 facility emissions', async () => {
    const mockSupabase = createMockSupabase({
      facility_activity_data: {
        data: [
          {
            quantity: 100,
            scope_1_2_emission_sources: {
              scope: 'Scope 2', // Should be filtered out
              emission_factor_id: 'factor-1',
            },
          },
        ],
        error: null,
      },
      fleet_activities: { data: [], error: null },
    });

    const result = await calculateScope1(
      mockSupabase as any,
      'org-123',
      '2024-01-01',
      '2024-12-31'
    );

    expect(result).toBe(0);
  });
});

// ============================================================================
// SCOPE 2 TESTS
// ============================================================================

describe('calculateScope2', () => {
  it('should return 0 when no facility or fleet data exists', async () => {
    const mockSupabase = createMockSupabase({
      facility_activity_data: { data: [], error: null },
      fleet_activities: { data: [], error: null },
    });

    const result = await calculateScope2(
      mockSupabase as any,
      'org-123',
      '2024-01-01',
      '2024-12-31'
    );

    expect(result).toBe(0);
  });

  it('should calculate Scope 2 from purchased electricity', async () => {
    const mockSupabase = createMockSupabase({
      facility_activity_data: {
        data: [
          {
            quantity: 1000, // 1000 kWh
            scope_1_2_emission_sources: {
              scope: 'Scope 2',
              emission_factor_id: 'elec-factor',
            },
          },
        ],
        error: null,
      },
      emissions_factors: { data: { value: '0.5' }, error: null },
      fleet_activities: { data: [], error: null },
    });

    const result = await calculateScope2(
      mockSupabase as any,
      'org-123',
      '2024-01-01',
      '2024-12-31'
    );

    // 1000 kWh * 0.5 factor = 500 kgCO2e
    expect(result).toBe(500);
  });

  it('should add fleet Scope 2 emissions (EV charging)', async () => {
    const mockSupabase = createMockSupabase({
      facility_activity_data: { data: [], error: null },
      fleet_activities: {
        data: [{ emissions_tco2e: 2 }], // 2 tonnes from EV charging
        error: null,
      },
    });

    const result = await calculateScope2(
      mockSupabase as any,
      'org-123',
      '2024-01-01',
      '2024-12-31'
    );

    // 2 tonnes * 1000 = 2000 kgCO2e
    expect(result).toBe(2000);
  });
});

// ============================================================================
// SCOPE 3 TESTS
// ============================================================================

describe('calculateScope3', () => {
  it('should return empty breakdown when no data exists', async () => {
    const mockSupabase = createMockSupabase({
      production_logs: { data: [], error: null },
      corporate_reports: { data: null, error: null },
      fleet_activities: { data: [], error: null },
    });

    const result = await calculateScope3(
      mockSupabase as any,
      'org-123',
      2024,
      '2024-01-01',
      '2024-12-31'
    );

    expect(result.total).toBe(0);
    expect(result.products).toBe(0);
    expect(result.business_travel).toBe(0);
    expect(result.purchased_services).toBe(0);
  });

  it('should use breakdown.by_scope.scope3 to avoid double counting', async () => {
    // This test verifies the critical fix: using scope3 breakdown
    // instead of total_ghg_emissions which would include facility S1+S2
    const mockSupabase = createMockSupabase({
      production_logs: {
        data: [{ product_id: 'prod-1', units_produced: 100 }],
        error: null,
      },
      product_lcas: {
        data: {
          aggregated_impacts: {
            total_ghg_emissions: 10, // 10 kgCO2e total (includes S1+S2)
            breakdown: {
              by_scope: {
                scope1: 1,
                scope2: 2,
                scope3: 7, // Only 7 kgCO2e is actual Scope 3
              },
            },
          },
        },
        error: null,
      },
      corporate_reports: { data: null, error: null },
      fleet_activities: { data: [], error: null },
    });

    const result = await calculateScope3(
      mockSupabase as any,
      'org-123',
      2024,
      '2024-01-01',
      '2024-12-31'
    );

    // Should use scope3 (7) not total (10) to avoid double counting
    // 100 units * 7 kgCO2e per unit = 700 kgCO2e
    expect(result.products).toBe(700);
    expect(result.total).toBe(700);
  });

  it('should properly categorize corporate overheads', async () => {
    const mockSupabase = createMockSupabase({
      production_logs: { data: [], error: null },
      corporate_reports: { data: { id: 'report-1' }, error: null },
      corporate_overheads: {
        data: [
          { category: 'business_travel', computed_co2e: 1000 },
          { category: 'employee_commuting', computed_co2e: 500 },
          { category: 'capital_goods', computed_co2e: 2000 },
          { category: 'operational_waste', computed_co2e: 300 },
          { category: 'downstream_logistics', computed_co2e: 400 },
          { category: 'purchased_services', computed_co2e: 800, material_type: null },
          { category: 'purchased_services', computed_co2e: 200, material_type: 'printed_brochures' },
        ],
        error: null,
      },
      fleet_activities: { data: [], error: null },
    });

    const result = await calculateScope3(
      mockSupabase as any,
      'org-123',
      2024,
      '2024-01-01',
      '2024-12-31'
    );

    expect(result.business_travel).toBe(1000);
    expect(result.employee_commuting).toBe(500);
    expect(result.capital_goods).toBe(2000);
    expect(result.operational_waste).toBe(300);
    expect(result.downstream_logistics).toBe(400);
    expect(result.purchased_services).toBe(800);
    expect(result.marketing_materials).toBe(200);
  });

  it('should include grey fleet (Scope 3 Cat 6) in business travel', async () => {
    const mockSupabase = createMockSupabase({
      production_logs: { data: [], error: null },
      corporate_reports: { data: null, error: null },
      fleet_activities: {
        data: [{ emissions_tco2e: 3 }], // 3 tonnes from grey fleet
        error: null,
      },
    });

    const result = await calculateScope3(
      mockSupabase as any,
      'org-123',
      2024,
      '2024-01-01',
      '2024-12-31'
    );

    // 3 tonnes * 1000 = 3000 kgCO2e added to business travel
    expect(result.business_travel).toBe(3000);
  });

  it('should populate UI-friendly aliases correctly', async () => {
    const mockSupabase = createMockSupabase({
      production_logs: { data: [], error: null },
      corporate_reports: { data: { id: 'report-1' }, error: null },
      corporate_overheads: {
        data: [
          { category: 'operational_waste', computed_co2e: 300 },
          { category: 'downstream_logistics', computed_co2e: 400 },
          { category: 'purchased_services', computed_co2e: 200, material_type: 'brochures' },
        ],
        error: null,
      },
      fleet_activities: { data: [], error: null },
    });

    const result = await calculateScope3(
      mockSupabase as any,
      'org-123',
      2024,
      '2024-01-01',
      '2024-12-31'
    );

    // Check that aliases match their source fields
    expect(result.waste).toBe(result.operational_waste);
    expect(result.logistics).toBe(result.downstream_logistics);
    expect(result.marketing).toBe(result.marketing_materials);
  });
});

// ============================================================================
// COMPLETE CALCULATION TESTS
// ============================================================================

describe('calculateCorporateEmissions', () => {
  it('should return hasData: false when no emissions data exists', async () => {
    const mockSupabase = createMockSupabase({
      facility_activity_data: { data: [], error: null },
      fleet_activities: { data: [], error: null },
      production_logs: { data: [], error: null },
      corporate_reports: { data: null, error: null },
    });

    const result = await calculateCorporateEmissions(
      mockSupabase as any,
      'org-123',
      2024
    );

    expect(result.hasData).toBe(false);
    expect(result.breakdown.total).toBe(0);
  });

  it('should correctly sum all scopes', async () => {
    // Complex mock with all three scopes having data
    // We need a more sophisticated mock that properly handles the async query chain
    const createComplexMock = () => {
      const createQueryBuilder = (tableName: string): any => {
        let filters: Record<string, any> = {};

        const builder: any = {
          select: vi.fn().mockImplementation(() => builder),
          eq: vi.fn().mockImplementation((key: string, value: any) => {
            filters[key] = value;
            return builder;
          }),
          gte: vi.fn().mockImplementation(() => builder),
          lte: vi.fn().mockImplementation(() => builder),
          order: vi.fn().mockImplementation(() => builder),
          limit: vi.fn().mockImplementation(() => builder),
          maybeSingle: vi.fn().mockImplementation(async () => {
            if (tableName === 'emissions_factors') {
              return { data: { value: '1.0' }, error: null };
            }
            if (tableName === 'product_lcas') {
              return {
                data: {
                  aggregated_impacts: {
                    breakdown: { by_scope: { scope3: 50 } },
                  },
                },
                error: null,
              };
            }
            if (tableName === 'corporate_reports') {
              return { data: null, error: null };
            }
            return { data: null, error: null };
          }),
        };

        // For queries that return arrays - implement as thenable
        builder.then = (resolve: Function) => {
          let response = { data: [], error: null };

          if (tableName === 'facility_activity_data') {
            response = {
              data: [
                {
                  quantity: 100,
                  scope_1_2_emission_sources: {
                    scope: 'Scope 1',
                    emission_factor_id: 'factor-1',
                  },
                },
                {
                  quantity: 200,
                  scope_1_2_emission_sources: {
                    scope: 'Scope 2',
                    emission_factor_id: 'factor-2',
                  },
                },
              ],
              error: null,
            };
          } else if (tableName === 'fleet_activities') {
            response = { data: [], error: null };
          } else if (tableName === 'production_logs') {
            response = {
              data: [{ product_id: 'prod-1', units_produced: 10 }],
              error: null,
            };
          } else if (tableName === 'corporate_overheads') {
            response = { data: [], error: null };
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

    const mockSupabase = createComplexMock();

    const result = await calculateCorporateEmissions(
      mockSupabase as any,
      'org-123',
      2024
    );

    expect(result.year).toBe(2024);
    expect(result.hasData).toBe(true);
    // Scope 1: 100 * 1.0 = 100
    // Scope 2: 200 * 1.0 = 200
    // Scope 3: 10 * 50 = 500
    // Total: 800
    expect(result.breakdown.scope1).toBe(100);
    expect(result.breakdown.scope2).toBe(200);
    expect(result.breakdown.scope3.products).toBe(500);
    expect(result.breakdown.total).toBe(800);
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe('Edge Cases', () => {
  describe('Zero and Empty Data', () => {
    it('should handle production logs with zero units produced', async () => {
      const mockSupabase = createMockSupabase({
        production_logs: {
          data: [{ product_id: 'prod-1', units_produced: 0 }],
          error: null,
        },
        corporate_reports: { data: null, error: null },
        fleet_activities: { data: [], error: null },
      });

      const result = await calculateScope3(
        mockSupabase as any,
        'org-123',
        2024,
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.products).toBe(0);
    });

    it('should handle negative units produced (should be skipped)', async () => {
      const mockSupabase = createMockSupabase({
        production_logs: {
          data: [{ product_id: 'prod-1', units_produced: -10 }],
          error: null,
        },
        corporate_reports: { data: null, error: null },
        fleet_activities: { data: [], error: null },
      });

      const result = await calculateScope3(
        mockSupabase as any,
        'org-123',
        2024,
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.products).toBe(0);
    });

    it('should handle null emissions_tco2e from fleet', async () => {
      const mockSupabase = createMockSupabase({
        facility_activity_data: { data: [], error: null },
        fleet_activities: {
          data: [{ emissions_tco2e: null }],
          error: null,
        },
      });

      const result = await calculateScope1(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result).toBe(0);
    });
  });

  describe('Missing LCA Data', () => {
    it('should handle products without completed LCA', async () => {
      const mockSupabase = createMockSupabase({
        production_logs: {
          data: [{ product_id: 'prod-no-lca', units_produced: 100 }],
          error: null,
        },
        product_lcas: { data: null, error: null }, // No LCA found
        corporate_reports: { data: null, error: null },
        fleet_activities: { data: [], error: null },
      });

      const result = await calculateScope3(
        mockSupabase as any,
        'org-123',
        2024,
        '2024-01-01',
        '2024-12-31'
      );

      // Product without LCA should contribute 0 to emissions
      expect(result.products).toBe(0);
    });

    it('should handle LCA with missing scope breakdown', async () => {
      const mockSupabase = createMockSupabase({
        production_logs: {
          data: [{ product_id: 'prod-1', units_produced: 100 }],
          error: null,
        },
        product_lcas: {
          data: {
            aggregated_impacts: {
              total_ghg_emissions: 10,
              // No breakdown.by_scope
            },
          },
          error: null,
        },
        corporate_reports: { data: null, error: null },
        fleet_activities: { data: [], error: null },
      });

      const result = await calculateScope3(
        mockSupabase as any,
        'org-123',
        2024,
        '2024-01-01',
        '2024-12-31'
      );

      // Should gracefully handle missing breakdown and use 0
      expect(result.products).toBe(0);
    });
  });

  describe('Missing Emission Factors', () => {
    it('should handle facility data without emission factor', async () => {
      const mockSupabase = createMockSupabase({
        facility_activity_data: {
          data: [
            {
              quantity: 100,
              scope_1_2_emission_sources: {
                scope: 'Scope 1',
                emission_factor_id: null, // No factor ID
              },
            },
          ],
          error: null,
        },
        fleet_activities: { data: [], error: null },
      });

      const result = await calculateScope1(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result).toBe(0);
    });

    it('should handle emission factor that returns null value', async () => {
      const mockSupabase = createMockSupabase({
        facility_activity_data: {
          data: [
            {
              quantity: 100,
              scope_1_2_emission_sources: {
                scope: 'Scope 1',
                emission_factor_id: 'factor-broken',
              },
            },
          ],
          error: null,
        },
        emissions_factors: { data: { value: null }, error: null },
        fleet_activities: { data: [], error: null },
      });

      const result = await calculateScope1(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result).toBe(0);
    });
  });

  describe('Partial Year Data', () => {
    it('should correctly filter data within year boundaries', async () => {
      // This test verifies the date filtering works correctly
      // The actual filtering is done by Supabase, so we're testing
      // that the correct parameters are passed
      const mockSupabase = createMockSupabase({
        facility_activity_data: { data: [], error: null },
        fleet_activities: { data: [], error: null },
      });

      await calculateScope1(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-06-30' // Partial year (first half)
      );

      // Verify the from method was called with correct table
      expect(mockSupabase.from).toHaveBeenCalledWith('facility_activity_data');
      expect(mockSupabase.from).toHaveBeenCalledWith('fleet_activities');
    });
  });
});

// ============================================================================
// NO DOUBLE COUNTING VERIFICATION
// ============================================================================

describe('Double Counting Prevention', () => {
  it('should NOT include facility emissions in Scope 3 products', async () => {
    // Scenario: A product LCA shows:
    // - total_ghg_emissions: 15 kgCO2e (includes 5 kg from owned facility)
    // - breakdown.by_scope.scope1: 2 kgCO2e (facility combustion)
    // - breakdown.by_scope.scope2: 3 kgCO2e (facility electricity)
    // - breakdown.by_scope.scope3: 10 kgCO2e (supply chain only)
    //
    // Corporate emissions should ONLY count the 10 kgCO2e as Scope 3
    // because the 5 kgCO2e facility emissions are already in corporate S1/S2

    const mockSupabase = createMockSupabase({
      production_logs: {
        data: [{ product_id: 'prod-1', units_produced: 1 }],
        error: null,
      },
      product_lcas: {
        data: {
          aggregated_impacts: {
            total_ghg_emissions: 15,
            breakdown: {
              by_scope: {
                scope1: 2,
                scope2: 3,
                scope3: 10,
              },
            },
          },
        },
        error: null,
      },
      corporate_reports: { data: null, error: null },
      fleet_activities: { data: [], error: null },
    });

    const result = await calculateScope3(
      mockSupabase as any,
      'org-123',
      2024,
      '2024-01-01',
      '2024-12-31'
    );

    // Should be 10, NOT 15
    expect(result.products).toBe(10);

    // This prevents the bug where facility emissions would be counted twice:
    // Once in corporate S1/S2 and again in S3 via product LCA
  });
});

// ============================================================================
// TYPE STRUCTURE TESTS
// ============================================================================

describe('Type Structure', () => {
  it('should return correct Scope3Breakdown structure', async () => {
    const mockSupabase = createMockSupabase({
      production_logs: { data: [], error: null },
      corporate_reports: { data: null, error: null },
      fleet_activities: { data: [], error: null },
    });

    const result = await calculateScope3(
      mockSupabase as any,
      'org-123',
      2024,
      '2024-01-01',
      '2024-12-31'
    );

    // Check all required fields exist
    expect(result).toHaveProperty('products');
    expect(result).toHaveProperty('business_travel');
    expect(result).toHaveProperty('purchased_services');
    expect(result).toHaveProperty('employee_commuting');
    expect(result).toHaveProperty('capital_goods');
    expect(result).toHaveProperty('operational_waste');
    expect(result).toHaveProperty('downstream_logistics');
    expect(result).toHaveProperty('marketing_materials');
    expect(result).toHaveProperty('total');

    // Check UI aliases exist
    expect(result).toHaveProperty('logistics');
    expect(result).toHaveProperty('waste');
    expect(result).toHaveProperty('marketing');
  });

  it('should return correct CorporateEmissionsResult structure', async () => {
    const mockSupabase = createMockSupabase({
      facility_activity_data: { data: [], error: null },
      fleet_activities: { data: [], error: null },
      production_logs: { data: [], error: null },
      corporate_reports: { data: null, error: null },
    });

    const result = await calculateCorporateEmissions(
      mockSupabase as any,
      'org-123',
      2024
    );

    expect(result).toHaveProperty('year');
    expect(result).toHaveProperty('breakdown');
    expect(result).toHaveProperty('hasData');
    expect(result.breakdown).toHaveProperty('scope1');
    expect(result.breakdown).toHaveProperty('scope2');
    expect(result.breakdown).toHaveProperty('scope3');
    expect(result.breakdown).toHaveProperty('total');
  });
});
