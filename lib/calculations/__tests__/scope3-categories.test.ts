import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateScope3Cat9,
  calculateScope3Cat11,
  getScope3Summary,
  TRANSPORT_EMISSION_FACTORS,
  USE_PHASE_EMISSION_FACTORS,
} from '../scope3-categories';

// ============================================================================
// MOCK SETUP
// ============================================================================

/**
 * Create a mock Supabase client for testing
 * Supports flexible query building with chainable methods
 */
const createMockSupabase = (mockResponses: Record<string, any> = {}) => {
  const createQueryBuilder = (tableName: string) => {
    const queryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => {
        return Promise.resolve(mockResponses[tableName] || { data: null, error: null });
      }),
    };

    // For queries that return arrays (thenable pattern)
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
// CATEGORY 4: UPSTREAM TRANSPORTATION — no calculator to test
// ============================================================================
// calculateScope3Cat4 was removed: inbound transport is inside Cat 1 (the
// per-unit LCA scope 3 multiplied by units produced) and paid logistics
// overheads (upstream_transport / upstream_logistics) are counted once by
// the overhead loop in corporate-emissions.ts. The old Method 1 summed
// per-functional-unit quantities as annual tonnage (dimensionally wrong),
// and its spend-based fallback double-counted overheads also picked up by
// the corporate overhead loop.

// ============================================================================
// CATEGORY 9: DOWNSTREAM TRANSPORTATION TESTS
// ============================================================================

describe('calculateScope3Cat9 - Downstream Transportation', () => {
  describe('No overhead double-counting', () => {
    it('does NOT read downstream_logistics overheads (counted by the corporate overhead loop)', async () => {
      // Reading corporate_overheads here double-counted every entry: the
      // overhead loop in corporate-emissions.ts already sums them into
      // breakdown.downstream_logistics.
      const mockSupabase = createMockSupabase({
        corporate_overheads: {
          data: [{ computed_co2e: 1500, amount: 25000, material_type: 'distribution' }],
          error: null,
        },
        production_logs: { data: [], error: null },
      });

      const result = await calculateScope3Cat9(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBe(0);
      const tablesQueried = (mockSupabase.from as any).mock.calls.map((c: any[]) => c[0]);
      expect(tablesQueried).not.toContain('corporate_overheads');
    });

    it('excludes products whose latest LCA already includes distribution', async () => {
      // Distribution for wide-boundary products is inside the per-unit LCA
      // scope 3 that Cat 1 multiplies by units — estimating it again here
      // double-counts.
      const mockSupabase = createMockSupabase({
        product_carbon_footprints: {
          data: [
            { product_id: 'prod-wide', system_boundary: 'cradle-to-grave', updated_at: '2024-06-01' },
          ],
          error: null,
        },
        production_logs: {
          data: [
            {
              product_id: 'prod-wide',
              units_produced: 10000,
              products: { unit_size_value: 500, unit_size_unit: 'ml' },
            },
            {
              product_id: 'prod-gate',
              units_produced: 10000,
              products: { unit_size_value: 500, unit_size_unit: 'ml' },
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat9(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      // Only prod-gate counts: 10000 × 0.5L × 1.1 / 1000 = 5.5t × 300km × factor
      const expected = 5.5 * 300 * TRANSPORT_EMISSION_FACTORS.road_hgv.factor;
      expect(result.totalKgCO2e).toBeCloseTo(expected, 2);
      expect(result.notes.some(n => n.includes('excluded'))).toBe(true);
    });
  });

  describe('Estimation from Production Volumes', () => {
    it('should estimate based on production volume when no overhead data', async () => {
      const mockSupabase = createMockSupabase({
        corporate_overheads: { data: [], error: null },
        production_logs: {
          data: [
            {
              units_produced: 10000,
              products: {
                unit_size_value: 500,
                unit_size_unit: 'ml',
              },
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat9(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      // 10000 units * 0.5L * 1.1kg/L = 5500kg = 5.5 tonnes
      // 5.5 tonnes * 300km * 0.10516 = 173.514 kgCO2e
      expect(result.totalKgCO2e).toBeCloseTo(173.514, 1);
      expect(result.dataQuality).toBe('estimated');
      expect(result.breakdown[0].distanceKm).toBe(300); // Industry average
      expect(result.notes[0]).toContain('Estimated based on');
    });

    it('should handle products with litre units', async () => {
      const mockSupabase = createMockSupabase({
        corporate_overheads: { data: [], error: null },
        production_logs: {
          data: [
            {
              units_produced: 1000,
              products: {
                unit_size_value: 0.75,
                unit_size_unit: 'L', // Full litre units
              },
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat9(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      // 1000 units * 0.75L * 1.1kg/L = 825kg = 0.825 tonnes
      // 0.825 * 300 * 0.10516 = 26.03 kgCO2e
      expect(result.totalKgCO2e).toBeCloseTo(26.03, 1);
    });

    it('should aggregate multiple production logs', async () => {
      const mockSupabase = createMockSupabase({
        corporate_overheads: { data: [], error: null },
        production_logs: {
          data: [
            {
              units_produced: 5000,
              products: { unit_size_value: 330, unit_size_unit: 'ml' },
            },
            {
              units_produced: 3000,
              products: { unit_size_value: 500, unit_size_unit: 'ml' },
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat9(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      // Product 1: 5000 * 0.33L * 1.1 = 1815kg = 1.815t
      // Product 2: 3000 * 0.5L * 1.1 = 1650kg = 1.65t
      // Total: 3.465 tonnes * 300km * 0.10516 = 109.31 kgCO2e
      expect(result.totalKgCO2e).toBeCloseTo(109.31, 0);
    });
  });

  describe('Edge Cases', () => {
    it('should return 0 when no production logs and no overheads', async () => {
      const mockSupabase = createMockSupabase({
        corporate_overheads: { data: [], error: null },
        production_logs: { data: [], error: null },
      });

      const result = await calculateScope3Cat9(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBe(0);
      expect(result.notes).toContain(
        'No downstream distribution data available. Add logistics data or production volumes.'
      );
    });

    it('should handle zero units produced', async () => {
      const mockSupabase = createMockSupabase({
        corporate_overheads: { data: [], error: null },
        production_logs: {
          data: [
            {
              units_produced: 0,
              products: { unit_size_value: 500, unit_size_unit: 'ml' },
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat9(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBe(0);
    });

    it('should handle null computed_co2e in overheads', async () => {
      const mockSupabase = createMockSupabase({
        corporate_overheads: {
          data: [{ computed_co2e: null, amount: 5000 }],
          error: null,
        },
        production_logs: { data: [], error: null },
      });

      const result = await calculateScope3Cat9(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBe(0);
    });

    it('should use default unit size when not specified', async () => {
      const mockSupabase = createMockSupabase({
        corporate_overheads: { data: [], error: null },
        production_logs: {
          data: [
            {
              units_produced: 1000,
              products: {
                unit_size_value: null, // Missing
                unit_size_unit: null,
              },
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat9(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      // Defaults to 0.5L when unit_size_value is null
      // 1000 * 0.5L * 1.1 = 550kg = 0.55 tonnes
      // 0.55 * 300 * 0.10516 = 17.35 kgCO2e
      expect(result.totalKgCO2e).toBeCloseTo(17.35, 1);
    });

  });
});

// ============================================================================
// CATEGORY 11: USE OF SOLD PRODUCTS TESTS
// ============================================================================

describe('calculateScope3Cat11 - Use of Sold Products', () => {
  it('excludes products whose latest LCA already includes the use phase', async () => {
    // Use-phase (refrigeration/carbonation) for wide-boundary products is
    // inside the per-unit LCA scope 3 that Cat 1 multiplies by units —
    // estimating it again here double-counts.
    const mockSupabase = createMockSupabase({
      product_carbon_footprints: {
        data: [
          { product_id: 'prod-1', system_boundary: 'cradle-to-consumer', updated_at: '2024-06-01' },
        ],
        error: null,
      },
      products: {
        data: [
          {
            id: 'prod-1',
            name: 'Wide Boundary Beer',
            product_category: 'beer',
            unit_size_value: 330,
            unit_size_unit: 'ml',
            production_logs: [{ units_produced: 10000, date: '2024-06-15' }],
          },
        ],
        error: null,
      },
    });

    const result = await calculateScope3Cat11(
      mockSupabase as any,
      'org-123',
      '2024-01-01',
      '2024-12-31'
    );

    expect(result.totalKgCO2e).toBe(0);
    expect(result.notes.some(n => n.includes('excluded'))).toBe(true);
  });

  describe('Refrigerated Products', () => {
    it('should calculate refrigeration emissions for beer', async () => {
      const mockSupabase = createMockSupabase({
        products: {
          data: [
            {
              id: 'prod-1',
              name: 'Craft Lager',
              product_category: 'beer',
              unit_size_value: 330,
              unit_size_unit: 'ml',
              functional_unit: 'bottle',
              production_logs: [
                { units_produced: 10000, date: '2024-06-15' },
              ],
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat11(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBeGreaterThan(0);
      expect(result.breakdown).toHaveLength(1);
      expect(result.breakdown[0].productName).toBe('Craft Lager');
      expect(result.breakdown[0].useCategory).toBe('refrigeration');
      expect(result.breakdown[0].assumptionsUsed).toContain('50% retail + 50% domestic refrigeration, 1 week storage');
    });

    it('should calculate refrigeration emissions for wine', async () => {
      const mockSupabase = createMockSupabase({
        products: {
          data: [
            {
              id: 'prod-1',
              name: 'White Wine',
              product_category: 'wine',
              unit_size_value: 750,
              unit_size_unit: 'ml',
              functional_unit: 'bottle',
              production_logs: [
                { units_produced: 5000, date: '2024-06-15' },
              ],
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat11(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBeGreaterThan(0);
      expect(result.breakdown[0].useCategory).toBe('refrigeration');
    });

    it('should calculate refrigeration for cider', async () => {
      const mockSupabase = createMockSupabase({
        products: {
          data: [
            {
              id: 'prod-1',
              name: 'Apple Cider',
              product_category: 'cider',
              unit_size_value: 500,
              unit_size_unit: 'ml',
              functional_unit: 'can',
              production_logs: [
                { units_produced: 8000, date: '2024-06-15' },
              ],
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat11(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBeGreaterThan(0);
      // Cider is both refrigerated AND carbonated
      expect(result.breakdown[0].assumptionsUsed).toContain('CO2 release from carbonation');
    });
  });

  describe('Carbonated Products', () => {
    it('should calculate carbonation emissions for beer', async () => {
      const mockSupabase = createMockSupabase({
        products: {
          data: [
            {
              id: 'prod-1',
              name: 'IPA',
              product_category: 'beer',
              unit_size_value: 330,
              unit_size_unit: 'ml',
              functional_unit: 'can',
              production_logs: [
                { units_produced: 10000, date: '2024-06-15' },
              ],
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat11(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      // Beer includes both refrigeration and carbonation
      expect(result.breakdown[0].assumptionsUsed).toContain('CO2 release from carbonation');
      expect(result.assumptions).toContain('IPCC: Direct CO2 release from dissolved gas');
    });

    it('should calculate carbonation emissions for sparkling wine', async () => {
      const mockSupabase = createMockSupabase({
        products: {
          data: [
            {
              id: 'prod-1',
              name: 'Prosecco',
              product_category: 'sparkling',
              unit_size_value: 750,
              unit_size_unit: 'ml',
              functional_unit: 'bottle',
              production_logs: [
                { units_produced: 2000, date: '2024-06-15' },
              ],
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat11(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBeGreaterThan(0);
      expect(result.breakdown[0].assumptionsUsed).toContain('CO2 release from carbonation');
    });

    it('should calculate carbonation for soft drinks', async () => {
      const mockSupabase = createMockSupabase({
        products: {
          data: [
            {
              id: 'prod-1',
              name: 'Cola',
              product_category: 'soft_drink',
              unit_size_value: 500,
              unit_size_unit: 'ml',
              functional_unit: 'bottle',
              production_logs: [
                { units_produced: 20000, date: '2024-06-15' },
              ],
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat11(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBeGreaterThan(0);
      // Soft drinks: only carbonation, not refrigeration (unless category includes refrigerated items)
      expect(result.breakdown[0].assumptionsUsed).toContain('CO2 release from carbonation');
    });
  });

  describe('Products Without Use Phase Emissions', () => {
    it('should return 0 for products without refrigeration or carbonation', async () => {
      const mockSupabase = createMockSupabase({
        products: {
          data: [
            {
              id: 'prod-1',
              name: 'Still Water',
              product_category: 'water',
              unit_size_value: 500,
              unit_size_unit: 'ml',
              functional_unit: 'bottle',
              production_logs: [
                { units_produced: 50000, date: '2024-06-15' },
              ],
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat11(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });
  });

  describe('Multiple Products', () => {
    it('should calculate emissions for multiple product types', async () => {
      const mockSupabase = createMockSupabase({
        products: {
          data: [
            {
              id: 'prod-1',
              name: 'Lager',
              product_category: 'beer',
              unit_size_value: 330,
              unit_size_unit: 'ml',
              functional_unit: 'can',
              production_logs: [
                { units_produced: 10000, date: '2024-06-15' },
              ],
            },
            {
              id: 'prod-2',
              name: 'Sparkling Wine',
              product_category: 'sparkling',
              unit_size_value: 750,
              unit_size_unit: 'ml',
              functional_unit: 'bottle',
              production_logs: [
                { units_produced: 2000, date: '2024-06-15' },
              ],
            },
            {
              id: 'prod-3',
              name: 'Juice',
              product_category: 'juice',
              unit_size_value: 1000,
              unit_size_unit: 'ml',
              functional_unit: 'carton',
              production_logs: [
                { units_produced: 5000, date: '2024-06-15' },
              ],
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat11(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.breakdown).toHaveLength(3);
      expect(result.notes[0]).toContain('Use phase calculated for 3 products');
    });
  });

  describe('Date Filtering', () => {
    it('should only include production logs within date range', async () => {
      const mockSupabase = createMockSupabase({
        products: {
          data: [
            {
              id: 'prod-1',
              name: 'Beer',
              product_category: 'beer',
              unit_size_value: 330,
              unit_size_unit: 'ml',
              functional_unit: 'can',
              production_logs: [
                { units_produced: 5000, date: '2023-12-15' }, // Outside range
                { units_produced: 10000, date: '2024-06-15' }, // Inside range
                { units_produced: 3000, date: '2025-01-15' }, // Outside range
              ],
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat11(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      // Only the middle production log should be counted
      // 10000 units * 0.33L = 3300L for calculations
      expect(result.breakdown).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle no products', async () => {
      const mockSupabase = createMockSupabase({
        products: { data: [], error: null },
      });

      const result = await calculateScope3Cat11(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBe(0);
      expect(result.notes).toContain('No products found for use phase calculation.');
    });

    it('should handle products with no production logs', async () => {
      const mockSupabase = createMockSupabase({
        products: {
          data: [
            {
              id: 'prod-1',
              name: 'New Beer',
              product_category: 'beer',
              unit_size_value: 330,
              unit_size_unit: 'ml',
              functional_unit: 'can',
              production_logs: [],
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat11(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });

    it('should handle null production_logs', async () => {
      const mockSupabase = createMockSupabase({
        products: {
          data: [
            {
              id: 'prod-1',
              name: 'Beer',
              product_category: 'beer',
              unit_size_value: 330,
              unit_size_unit: 'ml',
              functional_unit: 'can',
              production_logs: null,
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat11(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBe(0);
    });

    it('should handle null product_category', async () => {
      const mockSupabase = createMockSupabase({
        products: {
          data: [
            {
              id: 'prod-1',
              name: 'Unknown Product',
              product_category: null,
              unit_size_value: 500,
              unit_size_unit: 'ml',
              functional_unit: 'bottle',
              production_logs: [
                { units_produced: 10000, date: '2024-06-15' },
              ],
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat11(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      // No category = no use phase emissions (not refrigerated or carbonated)
      expect(result.totalKgCO2e).toBe(0);
    });

    it('should handle ml to litre conversion correctly', async () => {
      const mockSupabase = createMockSupabase({
        products: {
          data: [
            {
              id: 'prod-1',
              name: 'Small Beer',
              product_category: 'beer',
              unit_size_value: 250, // 250ml
              unit_size_unit: 'ml',
              functional_unit: 'can',
              production_logs: [
                { units_produced: 10000, date: '2024-06-15' },
              ],
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat11(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      // 10000 * 0.25L = 2500L total
      // Refrigeration: 2500 * 0.5 * 0.0092 + 2500 * 0.5 * 0.0048 = 17.5 kgCO2e
      // Carbonation: 10000 * 0.0025 * (0.25/0.33) = 18.94 kgCO2e
      expect(result.totalKgCO2e).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// GET SCOPE 3 SUMMARY TESTS
// ============================================================================

describe('getScope3Summary', () => {
  it('should aggregate all category totals', async () => {
    // Create a mock that returns different data for each query
    const createComprehensiveMock = () => {
      const createQueryBuilder = (tableName: string): any => {
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(async () => {
            return { data: null, error: null };
          }),
        };

        builder.then = (resolve: Function) => {
          let response = { data: [], error: null };

          if (tableName === 'product_carbon_footprint_materials') {
            response = {
              data: [
                {
                  id: 'mat-1',
                  material_name: 'Barley',
                  quantity: 1000,
                  unit: 'kg',
                  transport_mode: 'truck',
                  distance_km: 200,
                  product_carbon_footprints: {
                    organization_id: 'org-123',
                    status: 'completed',
                  },
                },
              ],
              error: null,
            };
          } else if (tableName === 'corporate_overheads') {
            response = {
              data: [
                { computed_co2e: 500, amount: 10000, material_type: 'distribution' },
              ],
              error: null,
            };
          } else if (tableName === 'production_logs') {
            response = { data: [], error: null };
          } else if (tableName === 'products') {
            response = {
              data: [
                {
                  id: 'prod-1',
                  name: 'Beer',
                  product_category: 'beer',
                  unit_size_value: 330,
                  unit_size_unit: 'ml',
                  functional_unit: 'can',
                  production_logs: [
                    { units_produced: 10000, date: '2024-06-15' },
                  ],
                },
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

    const mockSupabase = createComprehensiveMock();

    const result = await getScope3Summary(
      mockSupabase as any,
      'org-123',
      '2024-01-01',
      '2024-12-31'
    );

    expect(result).toHaveProperty('cat9_downstream_transport');
    expect(result).toHaveProperty('cat11_use_phase');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('notes');

    expect(result.total).toBe(
      result.cat9_downstream_transport +
      result.cat11_use_phase
    );
  });

  it('should prefix notes with category labels', async () => {
    const mockSupabase = createMockSupabase({
      product_carbon_footprint_materials: { data: [], error: null },
      corporate_overheads: { data: [], error: null },
      production_logs: { data: [], error: null },
      products: { data: [], error: null },
    });

    const result = await getScope3Summary(
      mockSupabase as any,
      'org-123',
      '2024-01-01',
      '2024-12-31'
    );

    // Check that notes are properly prefixed (Cat 4 has no calculator)
    const cat9Notes = result.notes.filter(n => n.startsWith('[Cat 9]'));
    const cat11Notes = result.notes.filter(n => n.startsWith('[Cat 11]'));

    expect(cat9Notes.length).toBeGreaterThan(0);
    expect(cat11Notes.length).toBeGreaterThan(0);
  });

  it('should return 0 totals when no data available', async () => {
    const mockSupabase = createMockSupabase({
      product_carbon_footprint_materials: { data: [], error: null },
      corporate_overheads: { data: [], error: null },
      production_logs: { data: [], error: null },
      products: { data: [], error: null },
    });

    const result = await getScope3Summary(
      mockSupabase as any,
      'org-123',
      '2024-01-01',
      '2024-12-31'
    );

    expect(result.cat9_downstream_transport).toBe(0);
    expect(result.cat11_use_phase).toBe(0);
    expect(result.total).toBe(0);
  });
});

// ============================================================================
// EMISSION FACTORS TESTS
// ============================================================================

describe('Emission Factors', () => {
  describe('Transport Emission Factors', () => {
    it('should have all required transport modes', () => {
      const requiredModes = [
        'road_hgv',
        'road_lgv',
        'road_van',
        'rail_freight',
        'sea_container',
        'sea_bulk',
        'air_freight',
        'air_freight_long',
        'pipeline',
      ];

      requiredModes.forEach(mode => {
        expect(TRANSPORT_EMISSION_FACTORS).toHaveProperty(mode);
        expect(TRANSPORT_EMISSION_FACTORS[mode as keyof typeof TRANSPORT_EMISSION_FACTORS]).toHaveProperty('factor');
        expect(TRANSPORT_EMISSION_FACTORS[mode as keyof typeof TRANSPORT_EMISSION_FACTORS]).toHaveProperty('source');
      });
    });

    it('should have DEFRA 2024 sources', () => {
      Object.values(TRANSPORT_EMISSION_FACTORS).forEach(factorData => {
        expect(factorData.source).toContain('DEFRA 2024');
      });
    });

    it('should have air transport higher than sea transport', () => {
      expect(TRANSPORT_EMISSION_FACTORS.air_freight.factor).toBeGreaterThan(
        TRANSPORT_EMISSION_FACTORS.sea_container.factor
      );
    });

    it('should have rail lower than road', () => {
      expect(TRANSPORT_EMISSION_FACTORS.rail_freight.factor).toBeLessThan(
        TRANSPORT_EMISSION_FACTORS.road_hgv.factor
      );
    });
  });

  describe('Use Phase Emission Factors', () => {
    it('should have electricity grid factor', () => {
      expect(USE_PHASE_EMISSION_FACTORS.electricity_kwh.factor).toBeCloseTo(0.207, 3);
    });

    it('should have refrigeration factors', () => {
      expect(USE_PHASE_EMISSION_FACTORS.refrigeration_per_litre.domestic_fridge).toBeGreaterThan(0);
      expect(USE_PHASE_EMISSION_FACTORS.refrigeration_per_litre.retail_display).toBeGreaterThan(0);
      // Retail should be higher than domestic
      expect(USE_PHASE_EMISSION_FACTORS.refrigeration_per_litre.retail_display).toBeGreaterThan(
        USE_PHASE_EMISSION_FACTORS.refrigeration_per_litre.domestic_fridge
      );
    });

    it('should have carbonation release factors', () => {
      expect(USE_PHASE_EMISSION_FACTORS.carbonation_release.sparkling_wine).toBeGreaterThan(0);
      expect(USE_PHASE_EMISSION_FACTORS.carbonation_release.beer).toBeGreaterThan(0);
      expect(USE_PHASE_EMISSION_FACTORS.carbonation_release.soft_drink).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// DATA QUALITY NOTES TESTS
// ============================================================================

describe('Data Quality Notes', () => {
  describe('Category 9 Data Quality', () => {
    it('should return estimated quality when using production-based estimation', async () => {
      const mockSupabase = createMockSupabase({
        corporate_overheads: { data: [], error: null },
        production_logs: {
          data: [
            {
              units_produced: 10000,
              products: { unit_size_value: 500, unit_size_unit: 'ml' },
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat9(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.dataQuality).toBe('estimated');
    });
  });

  describe('Category 11 Assumptions', () => {
    it('should include refrigeration source in assumptions', async () => {
      const mockSupabase = createMockSupabase({
        products: {
          data: [
            {
              id: 'prod-1',
              name: 'Beer',
              product_category: 'beer',
              unit_size_value: 330,
              unit_size_unit: 'ml',
              production_logs: [
                { units_produced: 10000, date: '2024-06-15' },
              ],
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat11(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.assumptions).toContain(
        'Estimated from typical refrigerator energy consumption'
      );
    });

    it('should include carbonation source in assumptions', async () => {
      const mockSupabase = createMockSupabase({
        products: {
          data: [
            {
              id: 'prod-1',
              name: 'Sparkling Wine',
              product_category: 'sparkling',
              unit_size_value: 750,
              unit_size_unit: 'ml',
              production_logs: [
                { units_produced: 5000, date: '2024-06-15' },
              ],
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat11(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.assumptions).toContain(
        'IPCC: Direct CO2 release from dissolved gas'
      );
    });
  });
});

// ============================================================================
// TRANSPORT BREAKDOWN STRUCTURE TESTS
// ============================================================================

describe('Transport Emission Structure', () => {
  it('should return correct TransportEmission structure (Cat 9 estimate)', async () => {
    const mockSupabase = createMockSupabase({
      production_logs: {
        data: [
          {
            product_id: 'prod-1',
            units_produced: 10000,
            products: { unit_size_value: 500, unit_size_unit: 'ml' },
          },
        ],
        error: null,
      },
    });

    const result = await calculateScope3Cat9(
      mockSupabase as any,
      'org-123',
      '2024-01-01',
      '2024-12-31'
    );

    expect(result.breakdown).toHaveLength(1);
    const emission = result.breakdown[0];

    expect(emission).toHaveProperty('mode');
    expect(emission).toHaveProperty('distanceKm');
    expect(emission).toHaveProperty('weightTonnes');
    expect(emission).toHaveProperty('emissionFactor');
    expect(emission).toHaveProperty('emissionsKgCO2e');
    expect(emission).toHaveProperty('source');

    expect(typeof emission.mode).toBe('string');
    expect(typeof emission.distanceKm).toBe('number');
    expect(typeof emission.weightTonnes).toBe('number');
    expect(typeof emission.emissionFactor).toBe('number');
    expect(typeof emission.emissionsKgCO2e).toBe('number');
    expect(typeof emission.source).toBe('string');
  });
});

// ============================================================================
// USE PHASE BREAKDOWN STRUCTURE TESTS
// ============================================================================

describe('Use Phase Emission Structure', () => {
  it('should return correct UsePhaseEmission structure', async () => {
    const mockSupabase = createMockSupabase({
      products: {
        data: [
          {
            id: 'prod-1',
            name: 'Test Beer',
            product_category: 'beer',
            unit_size_value: 330,
            unit_size_unit: 'ml',
            functional_unit: 'can',
            production_logs: [
              { units_produced: 10000, date: '2024-06-15' },
            ],
          },
        ],
        error: null,
      },
    });

    const result = await calculateScope3Cat11(
      mockSupabase as any,
      'org-123',
      '2024-01-01',
      '2024-12-31'
    );

    expect(result.breakdown).toHaveLength(1);
    const emission = result.breakdown[0];

    expect(emission).toHaveProperty('productId');
    expect(emission).toHaveProperty('productName');
    expect(emission).toHaveProperty('useCategory');
    expect(emission).toHaveProperty('energyKwh');
    expect(emission).toHaveProperty('emissionFactor');
    expect(emission).toHaveProperty('emissionsKgCO2e');
    expect(emission).toHaveProperty('assumptionsUsed');

    expect(typeof emission.productId).toBe('string');
    expect(typeof emission.productName).toBe('string');
    expect(typeof emission.useCategory).toBe('string');
    expect(typeof emission.energyKwh).toBe('number');
    expect(typeof emission.emissionFactor).toBe('number');
    expect(typeof emission.emissionsKgCO2e).toBe('number');
    expect(Array.isArray(emission.assumptionsUsed)).toBe(true);
  });
});
