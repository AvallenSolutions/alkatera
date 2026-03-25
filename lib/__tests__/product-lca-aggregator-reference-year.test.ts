/**
 * Product LCA Aggregator — referenceYear Parameter Tests
 *
 * Verifies that the referenceYear parameter flows correctly through
 * aggregateProductImpacts() into data quality assessment, rather than
 * hardcoding new Date().getFullYear().
 *
 * Bug context: The aggregator was previously hardcoding the current year
 * for temporal scoring, meaning a user selecting 2024 as their reference
 * year would get incorrect temporal representativeness scores.
 */

import { vi, beforeEach } from 'vitest';
import { aggregateProductImpacts } from '@/lib/product-lca-aggregator';
import * as dataQualityModule from '@/lib/data-quality-assessment';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const TEST_PCF_ID = 'test-pcf-001';
const TEST_PRODUCT_ID = 'test-product-001';
const TEST_ORG_ID = 'test-org-001';

/**
 * A material with a 2024-era emission factor source.
 * The gwp_data_source contains "2024" so the aggregator parses dataYear = 2024.
 */
function createTestMaterial(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mat-001',
    product_carbon_footprint_id: TEST_PCF_ID,
    material_name: 'Glass Bottle',
    material_type: 'packaging',
    category_type: 'packaging_material',
    quantity: 0.35,
    unit: 'kg',
    impact_climate: 0.42,
    impact_climate_fossil: 0.40,
    impact_climate_biogenic: 0.02,
    impact_climate_dluc: 0,
    impact_transport: 0.01,
    impact_water: 0.5,
    impact_water_scarcity: 0.3,
    impact_land: 0.001,
    impact_waste: 0.05,
    impact_terrestrial_ecotoxicity: 0.001,
    impact_freshwater_eutrophication: 0.0001,
    impact_terrestrial_acidification: 0.0005,
    impact_fossil_resource_scarcity: 0.02,
    gwp_data_source: 'ecoinvent 3.12 (2024)',
    impact_source: 'secondary_modelled',
    data_quality_grade: 'MEDIUM',
    confidence_score: 65,
    uncertainty_percent: 15,
    origin_country_code: 'FR',
    recycled_content_percentage: 30,
    ...overrides,
  };
}

/**
 * A second material with a 2020-era emission factor (older data).
 */
function createOlderMaterial() {
  return createTestMaterial({
    id: 'mat-002',
    material_name: 'Cork Stopper',
    material_type: 'packaging',
    category_type: 'packaging_material',
    quantity: 0.008,
    impact_climate: 0.015,
    impact_climate_fossil: 0.012,
    impact_climate_biogenic: 0.003,
    gwp_data_source: 'AGRIBALYSE 3.1 (2020)',
    impact_source: 'secondary_modelled',
    data_quality_grade: 'MEDIUM',
    confidence_score: 55,
    uncertainty_percent: 25,
    origin_country_code: 'PT',
    recycled_content_percentage: 0,
  });
}

const TEST_PCF_RECORD = {
  product_id: TEST_PRODUCT_ID,
  organization_id: TEST_ORG_ID,
  system_boundary: 'cradle-to-gate',
};

const TEST_PRODUCT_RECORD = {
  unit_size_value: 750,
  unit_size_unit: 'ml',
  functional_unit: '1 bottle (750ml)',
};

// ============================================================================
// SUPABASE MOCK FACTORY
// ============================================================================

function createSupabaseMock(overrides: Record<string, any> = {}) {
  const defaultMaterials = [createTestMaterial()];

  const tableData: Record<string, any> = {
    product_carbon_footprint_materials: overrides.product_carbon_footprint_materials ?? defaultMaterials,
    product_carbon_footprints: overrides.product_carbon_footprints ?? [TEST_PCF_RECORD],
    products: overrides.products ?? [TEST_PRODUCT_RECORD],
  };

  const fromMock = vi.fn((table: string) => {
    const mock: Record<string, unknown> = {};

    const chainableMethods = [
      'select', 'insert', 'update', 'upsert', 'delete',
      'eq', 'neq', 'gte', 'lte', 'gt', 'lt',
      'order', 'limit', 'in', 'not', 'ilike', 'is', 'match',
    ];
    chainableMethods.forEach(method => {
      mock[method] = vi.fn().mockReturnValue(mock);
    });

    const data = tableData[table] ?? [];
    const response = { data, error: null };

    mock.maybeSingle = vi.fn().mockResolvedValue({
      data: data[0] ?? null,
      error: null,
    });
    mock.single = vi.fn().mockResolvedValue({
      data: data[0] ?? null,
      error: null,
    });
    mock.then = (resolve: (r: any) => void) => {
      resolve(response);
      return Promise.resolve(response);
    };

    return mock;
  });

  return { from: fromMock } as any;
}

// ============================================================================
// TESTS
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('aggregateProductImpacts — referenceYear parameter', () => {

  describe('function signature acceptance', () => {

    it('accepts referenceYear as the last parameter without error', async () => {
      const supabase = createSupabaseMock();

      const result = await aggregateProductImpacts(
        supabase,
        TEST_PCF_ID,
        undefined, // facilityEmissions
        undefined, // systemBoundary
        undefined, // usePhaseConfig
        undefined, // eolConfig
        undefined, // distributionConfig
        undefined, // productLossConfig
        undefined, // calculationFingerprint
        undefined, // fallbackEvents
        undefined, // materialResolutions
        2024,      // referenceYear
      );

      expect(result.success).toBe(true);
    });

    it('works without referenceYear (parameter is optional)', async () => {
      const supabase = createSupabaseMock();

      const result = await aggregateProductImpacts(
        supabase,
        TEST_PCF_ID,
      );

      expect(result.success).toBe(true);
    });
  });

  describe('referenceYear flows to data quality assessment', () => {

    it('passes referenceYear=2024 to assessMaterialDataQuality', async () => {
      const spy = vi.spyOn(dataQualityModule, 'assessMaterialDataQuality');

      const supabase = createSupabaseMock();
      await aggregateProductImpacts(
        supabase,
        TEST_PCF_ID,
        undefined, // facilityEmissions
        undefined, // systemBoundary
        undefined, // usePhaseConfig
        undefined, // eolConfig
        undefined, // distributionConfig
        undefined, // productLossConfig
        undefined, // calculationFingerprint
        undefined, // fallbackEvents
        undefined, // materialResolutions
        2024,      // referenceYear
      );

      expect(spy).toHaveBeenCalled();
      const callArg = spy.mock.calls[0][0];
      expect(callArg.referenceYear).toBe(2024);
    });

    it('passes referenceYear=2020 to assessMaterialDataQuality when specified', async () => {
      const spy = vi.spyOn(dataQualityModule, 'assessMaterialDataQuality');

      const supabase = createSupabaseMock();
      await aggregateProductImpacts(
        supabase,
        TEST_PCF_ID,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        2020,
      );

      expect(spy).toHaveBeenCalled();
      const callArg = spy.mock.calls[0][0];
      expect(callArg.referenceYear).toBe(2020);
    });

    it('uses every material with the same referenceYear value', async () => {
      const spy = vi.spyOn(dataQualityModule, 'assessMaterialDataQuality');

      const materials = [createTestMaterial(), createOlderMaterial()];
      const supabase = createSupabaseMock({
        product_carbon_footprint_materials: materials,
      });

      await aggregateProductImpacts(
        supabase,
        TEST_PCF_ID,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        2024,
      );

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[0][0].referenceYear).toBe(2024);
      expect(spy.mock.calls[1][0].referenceYear).toBe(2024);
    });
  });

  describe('referenceYear fallback behaviour', () => {

    it('falls back to current year when referenceYear is undefined', async () => {
      const spy = vi.spyOn(dataQualityModule, 'assessMaterialDataQuality');
      const currentYear = new Date().getFullYear();

      const supabase = createSupabaseMock();
      await aggregateProductImpacts(
        supabase,
        TEST_PCF_ID,
        // No other params, referenceYear defaults to undefined
      );

      expect(spy).toHaveBeenCalled();
      const callArg = spy.mock.calls[0][0];
      expect(callArg.referenceYear).toBe(currentYear);
    });

    it('does not crash when referenceYear is explicitly undefined', async () => {
      const supabase = createSupabaseMock();

      const result = await aggregateProductImpacts(
        supabase,
        TEST_PCF_ID,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        undefined, // explicit undefined
      );

      expect(result.success).toBe(true);
    });
  });

  describe('temporal scoring accuracy with referenceYear', () => {

    it('scores a 2024 material as fresh when referenceYear=2024 (diff < 3 years)', async () => {
      const spy = vi.spyOn(dataQualityModule, 'assessMaterialDataQuality');

      // Material has gwp_data_source containing "2024", so dataYear = 2024
      const supabase = createSupabaseMock();
      await aggregateProductImpacts(
        supabase,
        TEST_PCF_ID,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        2024,
      );

      expect(spy).toHaveBeenCalled();
      const result = spy.mock.results[0].value;

      // dataYear=2024, referenceYear=2024 => diff=0 => temporal score=1 (best)
      expect(result.pedigreeMatrix.temporal).toBe(1);
      expect(result.temporalRepresentativeness.referenceYear).toBe(2024);
      expect(result.temporalRepresentativeness.yearsDifference).toBe(0);
      expect(result.temporalRepresentativeness.isStale).toBe(false);
      expect(result.temporalRepresentativeness.isVeryStale).toBe(false);
    });

    it('scores a 2024 material as stale when referenceYear=2020 (diff=4 years)', async () => {
      const spy = vi.spyOn(dataQualityModule, 'assessMaterialDataQuality');

      const supabase = createSupabaseMock();
      await aggregateProductImpacts(
        supabase,
        TEST_PCF_ID,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        2020,
      );

      expect(spy).toHaveBeenCalled();
      const result = spy.mock.results[0].value;

      // dataYear=2024, referenceYear=2020 => diff=4 => temporal score=2 (3-6 years)
      expect(result.pedigreeMatrix.temporal).toBe(2);
      expect(result.temporalRepresentativeness.referenceYear).toBe(2020);
      expect(result.temporalRepresentativeness.yearsDifference).toBe(4);
      expect(result.temporalRepresentativeness.isStale).toBe(false);
    });

    it('scores a 2020 material worse when referenceYear=2024 vs referenceYear=2020', async () => {
      const spy = vi.spyOn(dataQualityModule, 'assessMaterialDataQuality');

      // Run with referenceYear=2020 (data from 2020 is fresh)
      const supabase1 = createSupabaseMock({
        product_carbon_footprint_materials: [createOlderMaterial()],
      });
      await aggregateProductImpacts(
        supabase1,
        TEST_PCF_ID,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        2020,
      );

      const resultWithRef2020 = spy.mock.results[0].value;
      spy.mockClear();

      // Run with referenceYear=2024 (data from 2020 is 4 years old)
      const supabase2 = createSupabaseMock({
        product_carbon_footprint_materials: [createOlderMaterial()],
      });
      await aggregateProductImpacts(
        supabase2,
        TEST_PCF_ID,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        2024,
      );

      const resultWithRef2024 = spy.mock.results[0].value;

      // 2020 data with referenceYear=2020: diff=0 => temporal=1 (best)
      expect(resultWithRef2020.pedigreeMatrix.temporal).toBe(1);
      // 2020 data with referenceYear=2024: diff=4 => temporal=2 (worse)
      expect(resultWithRef2024.pedigreeMatrix.temporal).toBe(2);

      // The DQI score should be higher (better) when referenceYear matches dataYear
      expect(resultWithRef2020.pedigreeDqi).toBeGreaterThan(resultWithRef2024.pedigreeDqi);
    });

    it('marks a 2020 material as very stale when referenceYear=2035 (diff=15 years)', async () => {
      const spy = vi.spyOn(dataQualityModule, 'assessMaterialDataQuality');

      const supabase = createSupabaseMock({
        product_carbon_footprint_materials: [createOlderMaterial()],
      });
      await aggregateProductImpacts(
        supabase,
        TEST_PCF_ID,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        2035,
      );

      expect(spy).toHaveBeenCalled();
      const result = spy.mock.results[0].value;

      // dataYear=2020, referenceYear=2035 => diff=15 => temporal score=5 (worst)
      expect(result.pedigreeMatrix.temporal).toBe(5);
      expect(result.temporalRepresentativeness.isStale).toBe(true);
      expect(result.temporalRepresentativeness.isVeryStale).toBe(true);
    });
  });

  describe('referenceYear impact on aggregated result', () => {

    it('includes referenceYear in the temporal representativeness output', async () => {
      const supabase = createSupabaseMock();
      const result = await aggregateProductImpacts(
        supabase,
        TEST_PCF_ID,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        2024,
      );

      expect(result.success).toBe(true);
      // The aggregated impacts should contain data quality assessment
      const dqa = result.impacts?.uncertainty_sensitivity?.data_quality_assessment;
      expect(dqa).toBeDefined();
      // Temporal coverage should reflect the material's data year
      expect(dqa.temporal_coverage).toBeDefined();
    });

    it('produces different DQI scores for different reference years with the same materials', async () => {
      // Materials from 2024: with referenceYear=2024 they are fresh, with referenceYear=2010 they are stale
      const materials = [createTestMaterial(), createOlderMaterial()];

      const supabase1 = createSupabaseMock({
        product_carbon_footprint_materials: materials,
      });
      const result2024 = await aggregateProductImpacts(
        supabase1,
        TEST_PCF_ID,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        2024,
      );

      const supabase2 = createSupabaseMock({
        product_carbon_footprint_materials: materials,
      });
      const result2010 = await aggregateProductImpacts(
        supabase2,
        TEST_PCF_ID,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        2010,
      );

      // Both should succeed
      expect(result2024.success).toBe(true);
      expect(result2010.success).toBe(true);

      const dqa2024 = result2024.impacts?.uncertainty_sensitivity?.data_quality_assessment;
      const dqa2010 = result2010.impacts?.uncertainty_sensitivity?.data_quality_assessment;

      // With referenceYear=2024, materials from 2024/2020 are fresh/slightly old
      // With referenceYear=2010, materials from 2024/2020 are 14/10 years in the future => stale
      // The overall DQI should differ
      expect(dqa2024.overall_dqi).not.toBe(dqa2010.overall_dqi);
    });
  });
});
