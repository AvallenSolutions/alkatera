import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateScope3Cat4,
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
// CATEGORY 4: UPSTREAM TRANSPORTATION TESTS
// ============================================================================

describe('calculateScope3Cat4 - Upstream Transportation', () => {
  describe('Primary Data (Material Transport)', () => {
    it('should calculate emissions from material transport data with HGV', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: {
          data: [
            {
              id: 'mat-1',
              material_name: 'Barley',
              quantity: 1000, // 1000 kg
              unit: 'kg',
              transport_mode: 'truck',
              distance_km: 500,
              product_carbon_footprints: {
                organization_id: 'org-123',
                status: 'completed',
              },
            },
          ],
          error: null,
        },
        corporate_overheads: { data: [], error: null },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      // 1000kg = 1 tonne, 500km, HGV factor = 0.10516
      // Expected: 1 * 500 * 0.10516 = 52.58 kgCO2e
      expect(result.totalKgCO2e).toBeCloseTo(52.58, 2);
      expect(result.dataQuality).toBe('primary');
      expect(result.breakdown).toHaveLength(1);
      expect(result.breakdown[0].mode).toBe('road_hgv');
      expect(result.breakdown[0].weightTonnes).toBe(1);
      expect(result.breakdown[0].distanceKm).toBe(500);
    });

    it('should calculate emissions from rail transport', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: {
          data: [
            {
              id: 'mat-1',
              material_name: 'Hops',
              quantity: 500, // 500 kg
              unit: 'kg',
              transport_mode: 'rail',
              distance_km: 1000,
              product_carbon_footprints: {
                organization_id: 'org-123',
                status: 'completed',
              },
            },
          ],
          error: null,
        },
        corporate_overheads: { data: [], error: null },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      // 500kg = 0.5 tonnes, 1000km, rail factor = 0.02768
      // Expected: 0.5 * 1000 * 0.02768 = 13.84 kgCO2e
      expect(result.totalKgCO2e).toBeCloseTo(13.84, 2);
      expect(result.breakdown[0].mode).toBe('rail_freight');
    });

    it('should calculate emissions from sea container transport', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: {
          data: [
            {
              id: 'mat-1',
              material_name: 'Imported Grain',
              quantity: 10, // 10 tonnes
              unit: 'tonnes',
              transport_mode: 'ship',
              distance_km: 5000,
              product_carbon_footprints: {
                organization_id: 'org-123',
                status: 'completed',
              },
            },
          ],
          error: null,
        },
        corporate_overheads: { data: [], error: null },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      // 10 tonnes, 5000km, sea_container factor = 0.01601
      // Expected: 10 * 5000 * 0.01601 = 800.5 kgCO2e
      expect(result.totalKgCO2e).toBeCloseTo(800.5, 1);
      expect(result.breakdown[0].mode).toBe('sea_container');
      expect(result.breakdown[0].weightTonnes).toBe(10);
    });

    it('should calculate emissions from air freight', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: {
          data: [
            {
              id: 'mat-1',
              material_name: 'Specialty Yeast',
              quantity: 50, // 50 kg
              unit: 'kg',
              transport_mode: 'air',
              distance_km: 2000,
              product_carbon_footprints: {
                organization_id: 'org-123',
                status: 'completed',
              },
            },
          ],
          error: null,
        },
        corporate_overheads: { data: [], error: null },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      // 50kg = 0.05 tonnes, 2000km, air_freight factor = 0.98495
      // Expected: 0.05 * 2000 * 0.98495 = 98.495 kgCO2e
      expect(result.totalKgCO2e).toBeCloseTo(98.495, 2);
      expect(result.breakdown[0].mode).toBe('air_freight');
    });

    it('should aggregate multiple material transports', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: {
          data: [
            {
              id: 'mat-1',
              material_name: 'Barley',
              quantity: 1000, // 1 tonne
              unit: 'kg',
              transport_mode: 'truck',
              distance_km: 200,
              product_carbon_footprints: {
                organization_id: 'org-123',
                status: 'completed',
              },
            },
            {
              id: 'mat-2',
              material_name: 'Hops',
              quantity: 500, // 0.5 tonnes
              unit: 'kg',
              transport_mode: 'rail',
              distance_km: 800,
              product_carbon_footprints: {
                organization_id: 'org-123',
                status: 'completed',
              },
            },
          ],
          error: null,
        },
        corporate_overheads: { data: [], error: null },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      // Barley: 1 * 200 * 0.10516 = 21.032 kgCO2e
      // Hops: 0.5 * 800 * 0.02768 = 11.072 kgCO2e
      // Total: 32.104 kgCO2e
      expect(result.totalKgCO2e).toBeCloseTo(32.104, 2);
      expect(result.breakdown).toHaveLength(2);
    });

    it('should handle unit conversion for tonnes vs kg', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: {
          data: [
            {
              id: 'mat-1',
              material_name: 'Bulk Grain',
              quantity: 5, // 5 tonnes (unit specified)
              unit: 't',
              transport_mode: 'truck',
              distance_km: 100,
              product_carbon_footprints: {
                organization_id: 'org-123',
                status: 'completed',
              },
            },
          ],
          error: null,
        },
        corporate_overheads: { data: [], error: null },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      // 5 tonnes, 100km, HGV factor = 0.10516
      // Expected: 5 * 100 * 0.10516 = 52.58 kgCO2e
      expect(result.totalKgCO2e).toBeCloseTo(52.58, 2);
      expect(result.breakdown[0].weightTonnes).toBe(5);
    });
  });

  describe('Spend-Based Fallback', () => {
    it('should use spend-based estimation when no transport data exists', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: { data: [], error: null },
        corporate_overheads: {
          data: [
            {
              computed_co2e: 500,
              amount: 10000,
              material_type: 'logistics',
            },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBe(500);
      expect(result.dataQuality).toBe('spend_based');
      expect(result.notes).toContain('Using spend-based estimation - consider adding transport distances for accuracy');
    });

    it('should aggregate multiple spend-based entries', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: { data: [], error: null },
        corporate_overheads: {
          data: [
            { computed_co2e: 300, amount: 5000, material_type: 'inbound_freight' },
            { computed_co2e: 200, amount: 3000, material_type: 'supplier_transport' },
          ],
          error: null,
        },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBe(500);
      expect(result.dataQuality).toBe('spend_based');
    });
  });

  describe('Transport Mode Normalization', () => {
    it('should normalize various truck aliases to road_hgv', async () => {
      const modeVariants = ['truck', 'lorry', 'hgv', 'road'];

      for (const mode of modeVariants) {
        const mockSupabase = createMockSupabase({
          product_carbon_footprint_materials: {
            data: [
              {
                id: 'mat-1',
                material_name: 'Test Material',
                quantity: 1000,
                unit: 'kg',
                transport_mode: mode,
                distance_km: 100,
                product_carbon_footprints: {
                  organization_id: 'org-123',
                  status: 'completed',
                },
              },
            ],
            error: null,
          },
          corporate_overheads: { data: [], error: null },
        });

        const result = await calculateScope3Cat4(
          mockSupabase as any,
          'org-123',
          '2024-01-01',
          '2024-12-31'
        );

        expect(result.breakdown[0].mode).toBe('road_hgv');
      }
    });

    it('should normalize rail aliases correctly', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: {
          data: [
            {
              id: 'mat-1',
              material_name: 'Test Material',
              quantity: 1000,
              unit: 'kg',
              transport_mode: 'train',
              distance_km: 100,
              product_carbon_footprints: {
                organization_id: 'org-123',
                status: 'completed',
              },
            },
          ],
          error: null,
        },
        corporate_overheads: { data: [], error: null },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.breakdown[0].mode).toBe('rail_freight');
    });

    it('should skip materials with unknown transport mode', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: {
          data: [
            {
              id: 'mat-1',
              material_name: 'Test Material',
              quantity: 1000,
              unit: 'kg',
              transport_mode: 'teleportation', // Unknown mode
              distance_km: 100,
              product_carbon_footprints: {
                organization_id: 'org-123',
                status: 'completed',
              },
            },
          ],
          error: null,
        },
        corporate_overheads: { data: [], error: null },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero distance', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: {
          data: [
            {
              id: 'mat-1',
              material_name: 'Local Material',
              quantity: 1000,
              unit: 'kg',
              transport_mode: 'truck',
              distance_km: 0,
              product_carbon_footprints: {
                organization_id: 'org-123',
                status: 'completed',
              },
            },
          ],
          error: null,
        },
        corporate_overheads: { data: [], error: null },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });

    it('should handle null transport_mode', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: {
          data: [
            {
              id: 'mat-1',
              material_name: 'Material Without Mode',
              quantity: 1000,
              unit: 'kg',
              transport_mode: null,
              distance_km: 100,
              product_carbon_footprints: {
                organization_id: 'org-123',
                status: 'completed',
              },
            },
          ],
          error: null,
        },
        corporate_overheads: { data: [], error: null },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: {
          data: null,
          error: { message: 'Database connection error' },
        },
        corporate_overheads: { data: [], error: null },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBe(0);
      expect(result.notes).toContain('Error fetching material transport data');
    });

    it('should add note when no data available', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: { data: [], error: null },
        corporate_overheads: { data: [], error: null },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.totalKgCO2e).toBe(0);
      expect(result.notes).toContain(
        'No upstream transport data available. Add transport distances to materials or logistics spend data.'
      );
    });

    it('should handle null quantity gracefully', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: {
          data: [
            {
              id: 'mat-1',
              material_name: 'Incomplete Material',
              quantity: null,
              unit: 'kg',
              transport_mode: 'truck',
              distance_km: 100,
              product_carbon_footprints: {
                organization_id: 'org-123',
                status: 'completed',
              },
            },
          ],
          error: null,
        },
        corporate_overheads: { data: [], error: null },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      // Should handle null quantity as 0
      expect(result.totalKgCO2e).toBe(0);
    });
  });
});

// ============================================================================
// CATEGORY 9: DOWNSTREAM TRANSPORTATION TESTS
// ============================================================================

describe('calculateScope3Cat9 - Downstream Transportation', () => {
  describe('Corporate Overheads Data', () => {
    it('should calculate from downstream_logistics overhead data', async () => {
      const mockSupabase = createMockSupabase({
        corporate_overheads: {
          data: [
            {
              computed_co2e: 1500,
              amount: 25000,
              material_type: 'distribution',
              notes: 'Third-party logistics',
            },
          ],
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

      expect(result.totalKgCO2e).toBe(1500);
      expect(result.dataQuality).toBe('secondary');
      expect(result.breakdown).toHaveLength(1);
    });

    it('should aggregate multiple distribution entries', async () => {
      const mockSupabase = createMockSupabase({
        corporate_overheads: {
          data: [
            { computed_co2e: 800, amount: 15000, material_type: 'domestic_distribution' },
            { computed_co2e: 1200, amount: 20000, material_type: 'retail_delivery' },
          ],
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

      expect(result.totalKgCO2e).toBe(2000);
      expect(result.breakdown).toHaveLength(2);
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

    it('should prefer overhead data over estimation', async () => {
      const mockSupabase = createMockSupabase({
        corporate_overheads: {
          data: [{ computed_co2e: 2000, amount: 30000 }],
          error: null,
        },
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

      // Should use overhead data, not production estimate
      expect(result.totalKgCO2e).toBe(2000);
      expect(result.dataQuality).toBe('secondary');
    });
  });
});

// ============================================================================
// CATEGORY 11: USE OF SOLD PRODUCTS TESTS
// ============================================================================

describe('calculateScope3Cat11 - Use of Sold Products', () => {
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

    expect(result).toHaveProperty('cat4_upstream_transport');
    expect(result).toHaveProperty('cat9_downstream_transport');
    expect(result).toHaveProperty('cat11_use_phase');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('notes');

    expect(result.total).toBe(
      result.cat4_upstream_transport +
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

    // Check that notes are properly prefixed
    const cat4Notes = result.notes.filter(n => n.startsWith('[Cat 4]'));
    const cat9Notes = result.notes.filter(n => n.startsWith('[Cat 9]'));
    const cat11Notes = result.notes.filter(n => n.startsWith('[Cat 11]'));

    expect(cat4Notes.length).toBeGreaterThan(0);
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

    expect(result.cat4_upstream_transport).toBe(0);
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
  describe('Category 4 Data Quality', () => {
    it('should return primary quality when material transport data exists', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: {
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
        },
        corporate_overheads: { data: [], error: null },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.dataQuality).toBe('primary');
    });

    it('should return spend_based quality when using overhead data', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: { data: [], error: null },
        corporate_overheads: {
          data: [{ computed_co2e: 500, amount: 10000 }],
          error: null,
        },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.dataQuality).toBe('spend_based');
    });

    it('should return secondary quality by default', async () => {
      const mockSupabase = createMockSupabase({
        product_carbon_footprint_materials: { data: [], error: null },
        corporate_overheads: { data: [], error: null },
      });

      const result = await calculateScope3Cat4(
        mockSupabase as any,
        'org-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(result.dataQuality).toBe('secondary');
    });
  });

  describe('Category 9 Data Quality', () => {
    it('should return secondary quality when using overhead data', async () => {
      const mockSupabase = createMockSupabase({
        corporate_overheads: {
          data: [{ computed_co2e: 1000, amount: 20000 }],
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

      expect(result.dataQuality).toBe('secondary');
    });

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
  it('should return correct TransportEmission structure', async () => {
    const mockSupabase = createMockSupabase({
      product_carbon_footprint_materials: {
        data: [
          {
            id: 'mat-1',
            material_name: 'Test Material',
            quantity: 1000,
            unit: 'kg',
            transport_mode: 'truck',
            distance_km: 500,
            product_carbon_footprints: {
              organization_id: 'org-123',
              status: 'completed',
            },
          },
        ],
        error: null,
      },
      corporate_overheads: { data: [], error: null },
    });

    const result = await calculateScope3Cat4(
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
