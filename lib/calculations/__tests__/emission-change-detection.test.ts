import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectEmissionChanges,
  type EmissionChangeDetection,
} from '../emission-change-detection';

// ============================================================================
// MOCK SETUP
// ============================================================================

/**
 * Create a mock Supabase client for testing.
 * Supports flexible query building with chainable methods.
 *
 * mockResponses is keyed by table name. Each value should be
 * { data: ..., error: ... }. For tables queried multiple times
 * (e.g. utility_data_entries for two different years), pass an array
 * of responses that will be consumed in order.
 */
const createMockSupabase = (mockResponses: Record<string, any> = {}) => {
  // Track call counts per table so sequential queries return different data
  const callCounts: Record<string, number> = {};

  const createQueryBuilder = (tableName: string) => {
    const queryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => {
        const responses = mockResponses[tableName];
        if (Array.isArray(responses)) {
          const idx = (callCounts[tableName] || 0);
          callCounts[tableName] = idx + 1;
          return Promise.resolve(responses[idx] || { data: null, error: null });
        }
        return Promise.resolve(responses || { data: null, error: null });
      }),
    };

    // Thenable pattern for queries that return arrays
    queryBuilder.then = (resolve: Function) => {
      const responses = mockResponses[tableName];
      let response;
      if (Array.isArray(responses)) {
        const idx = (callCounts[tableName] || 0);
        callCounts[tableName] = idx + 1;
        response = responses[idx] || { data: [], error: null };
      } else {
        response = responses || { data: [], error: null };
      }
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
// TESTS
// ============================================================================

describe('detectEmissionChanges', () => {
  const ORG_ID = 'org-test-123';
  const CURRENT_YEAR = 2025;
  const PREVIOUS_YEAR = 2024;

  // --------------------------------------------------------------------------
  // Fuel type disappearing between years
  // --------------------------------------------------------------------------
  describe('fuel type disappearing between years', () => {
    it('should detect when a utility type existed last year but not this year', async () => {
      const mockSupabase = createMockSupabase({
        facilities: { data: [{ id: 'fac-1' }], error: null },
        // First call = current year (empty), second call = previous year (has kerosene)
        utility_data_entries: [
          { data: [], error: null },
          {
            data: [
              { utility_type: 'kerosene', quantity: 5000, unit: 'litres' },
            ],
            error: null,
          },
        ],
        corporate_reports: [
          { data: null, error: null },
          { data: null, error: null },
        ],
      });

      const result = await detectEmissionChanges(
        mockSupabase as any,
        ORG_ID,
        CURRENT_YEAR,
        PREVIOUS_YEAR
      );

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('kerosene');
      expect(result[0].magnitude_pct).toBe(-100);
      expect(result[0].currentValue).toBe(0);
      expect(result[0].previousValue).toBe(5000);
      expect(result[0].scope).toBe('scope1');
      expect(result[0].description).toContain('dropped from');
      expect(result[0].description).toContain('to 0');
    });
  });

  // --------------------------------------------------------------------------
  // Fuel type appearing
  // --------------------------------------------------------------------------
  describe('fuel type appearing', () => {
    it('should detect when a new utility type appears this year', async () => {
      const mockSupabase = createMockSupabase({
        facilities: { data: [{ id: 'fac-1' }], error: null },
        // First call = current year (has diesel), second call = previous year (empty)
        utility_data_entries: [
          {
            data: [
              { utility_type: 'diesel_stationary', quantity: 2000, unit: 'litres' },
            ],
            error: null,
          },
          { data: [], error: null },
        ],
        corporate_reports: [
          { data: null, error: null },
          { data: null, error: null },
        ],
      });

      const result = await detectEmissionChanges(
        mockSupabase as any,
        ORG_ID,
        CURRENT_YEAR,
        PREVIOUS_YEAR
      );

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('diesel_stationary');
      expect(result[0].magnitude_pct).toBe(100);
      expect(result[0].currentValue).toBe(2000);
      expect(result[0].previousValue).toBe(0);
      expect(result[0].scope).toBe('scope1');
      expect(result[0].description).toContain('New');
      expect(result[0].description).toContain('detected');
    });
  });

  // --------------------------------------------------------------------------
  // Significant quantity change (>20%)
  // --------------------------------------------------------------------------
  describe('significant quantity change', () => {
    it('should detect a decrease greater than 20%', async () => {
      const mockSupabase = createMockSupabase({
        facilities: { data: [{ id: 'fac-1' }], error: null },
        utility_data_entries: [
          {
            data: [
              { utility_type: 'electricity_grid', quantity: 70000, unit: 'kWh' },
            ],
            error: null,
          },
          {
            data: [
              { utility_type: 'electricity_grid', quantity: 100000, unit: 'kWh' },
            ],
            error: null,
          },
        ],
        corporate_reports: [
          { data: null, error: null },
          { data: null, error: null },
        ],
      });

      const result = await detectEmissionChanges(
        mockSupabase as any,
        ORG_ID,
        CURRENT_YEAR,
        PREVIOUS_YEAR
      );

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('electricity_grid');
      expect(result[0].scope).toBe('scope2');
      expect(result[0].magnitude_pct).toBe(-30);
      expect(result[0].currentValue).toBe(70000);
      expect(result[0].previousValue).toBe(100000);
      expect(result[0].description).toContain('decreased');
      expect(result[0].description).toContain('30%');
    });

    it('should detect an increase greater than 20%', async () => {
      const mockSupabase = createMockSupabase({
        facilities: { data: [{ id: 'fac-1' }], error: null },
        utility_data_entries: [
          {
            data: [
              { utility_type: 'natural_gas', quantity: 150000, unit: 'kWh' },
            ],
            error: null,
          },
          {
            data: [
              { utility_type: 'natural_gas', quantity: 100000, unit: 'kWh' },
            ],
            error: null,
          },
        ],
        corporate_reports: [
          { data: null, error: null },
          { data: null, error: null },
        ],
      });

      const result = await detectEmissionChanges(
        mockSupabase as any,
        ORG_ID,
        CURRENT_YEAR,
        PREVIOUS_YEAR
      );

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('natural_gas');
      expect(result[0].magnitude_pct).toBe(50);
      expect(result[0].description).toContain('increased');
      expect(result[0].description).toContain('50%');
    });
  });

  // --------------------------------------------------------------------------
  // Small change (<20%) filtered out
  // --------------------------------------------------------------------------
  describe('small change filtered out', () => {
    it('should not flag changes below the 20% threshold', async () => {
      const mockSupabase = createMockSupabase({
        facilities: { data: [{ id: 'fac-1' }], error: null },
        utility_data_entries: [
          {
            data: [
              { utility_type: 'electricity_grid', quantity: 95000, unit: 'kWh' },
            ],
            error: null,
          },
          {
            data: [
              { utility_type: 'electricity_grid', quantity: 100000, unit: 'kWh' },
            ],
            error: null,
          },
        ],
        corporate_reports: [
          { data: null, error: null },
          { data: null, error: null },
        ],
      });

      const result = await detectEmissionChanges(
        mockSupabase as any,
        ORG_ID,
        CURRENT_YEAR,
        PREVIOUS_YEAR
      );

      expect(result).toHaveLength(0);
    });

    it('should not flag a change of exactly 20%', async () => {
      const mockSupabase = createMockSupabase({
        facilities: { data: [{ id: 'fac-1' }], error: null },
        utility_data_entries: [
          {
            data: [
              { utility_type: 'lpg', quantity: 80, unit: 'litres' },
            ],
            error: null,
          },
          {
            data: [
              { utility_type: 'lpg', quantity: 100, unit: 'litres' },
            ],
            error: null,
          },
        ],
        corporate_reports: [
          { data: null, error: null },
          { data: null, error: null },
        ],
      });

      const result = await detectEmissionChanges(
        mockSupabase as any,
        ORG_ID,
        CURRENT_YEAR,
        PREVIOUS_YEAR
      );

      expect(result).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Empty data (no utility entries)
  // --------------------------------------------------------------------------
  describe('empty data', () => {
    it('should return empty array when no facilities exist', async () => {
      const mockSupabase = createMockSupabase({
        facilities: { data: [], error: null },
        corporate_reports: [
          { data: null, error: null },
          { data: null, error: null },
        ],
      });

      const result = await detectEmissionChanges(
        mockSupabase as any,
        ORG_ID,
        CURRENT_YEAR,
        PREVIOUS_YEAR
      );

      expect(result).toHaveLength(0);
    });

    it('should return empty array when both years have no utility data', async () => {
      const mockSupabase = createMockSupabase({
        facilities: { data: [{ id: 'fac-1' }], error: null },
        utility_data_entries: [
          { data: [], error: null },
          { data: [], error: null },
        ],
        corporate_reports: [
          { data: null, error: null },
          { data: null, error: null },
        ],
      });

      const result = await detectEmissionChanges(
        mockSupabase as any,
        ORG_ID,
        CURRENT_YEAR,
        PREVIOUS_YEAR
      );

      expect(result).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Corporate overheads comparison
  // --------------------------------------------------------------------------
  describe('corporate overheads', () => {
    it('should detect overhead category changes above 20%', async () => {
      const mockSupabase = createMockSupabase({
        facilities: { data: [], error: null },
        corporate_reports: [
          { data: { id: 'report-2025' }, error: null },
          { data: { id: 'report-2024' }, error: null },
        ],
        corporate_overheads: [
          {
            data: [
              { category: 'business_travel', computed_co2e: 3000 },
            ],
            error: null,
          },
          {
            data: [
              { category: 'business_travel', computed_co2e: 10000 },
            ],
            error: null,
          },
        ],
      });

      const result = await detectEmissionChanges(
        mockSupabase as any,
        ORG_ID,
        CURRENT_YEAR,
        PREVIOUS_YEAR
      );

      expect(result).toHaveLength(1);
      expect(result[0].scope).toBe('scope3');
      expect(result[0].category).toBe('business_travel');
      expect(result[0].magnitude_pct).toBe(-70);
      expect(result[0].unit).toBe('kgCO2e');
    });
  });

  // --------------------------------------------------------------------------
  // Sorting by absolute magnitude
  // --------------------------------------------------------------------------
  describe('sorting', () => {
    it('should sort results by absolute magnitude, largest first', async () => {
      const mockSupabase = createMockSupabase({
        facilities: { data: [{ id: 'fac-1' }], error: null },
        utility_data_entries: [
          {
            data: [
              { utility_type: 'electricity_grid', quantity: 60000, unit: 'kWh' },
              { utility_type: 'natural_gas', quantity: 200000, unit: 'kWh' },
            ],
            error: null,
          },
          {
            data: [
              { utility_type: 'electricity_grid', quantity: 100000, unit: 'kWh' },
              { utility_type: 'natural_gas', quantity: 150000, unit: 'kWh' },
            ],
            error: null,
          },
        ],
        corporate_reports: [
          { data: null, error: null },
          { data: null, error: null },
        ],
      });

      const result = await detectEmissionChanges(
        mockSupabase as any,
        ORG_ID,
        CURRENT_YEAR,
        PREVIOUS_YEAR
      );

      expect(result).toHaveLength(2);
      // Electricity decreased 40%, natural gas increased ~33%
      // 40 > 33 so electricity should come first
      expect(Math.abs(result[0].magnitude_pct)).toBeGreaterThanOrEqual(
        Math.abs(result[1].magnitude_pct)
      );
    });
  });
});
