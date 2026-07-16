/**
 * Product LCA Aggregator — Full Test Suite
 *
 * Tests the aggregation engine across all system boundaries:
 * - Material impact summation (no transport double-counting)
 * - Packaging vs ingredient classification
 * - EoL applied only to packaging (not ingredients)
 * - System boundary gating for use-phase and EoL
 * - Facility emissions per-unit conversion and scope allocation
 * - DQI scoring with impact-weighted average
 * - Warning generation for missing configs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createQueryMock,
  createMockSupabaseClient,
  createMockIngredient,
  createMockPackaging,
  createMockPCF,
  createMockProduct,
  createMockFacilityEmissions,
} from './test-helpers';
import type { AggregationResult } from '../product-lca-aggregator';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockSupabaseClient = createMockSupabaseClient();

// ============================================================================
// MOCK DATA
// ============================================================================

const MALT = createMockIngredient({
  id: 'mat-malt',
  material_name: 'Pale Malt',
  quantity: 0.5,
  impact_climate: 0.450,
  impact_climate_fossil: 0.400,
  impact_climate_biogenic: 0.050,
  impact_transport: 0.010,
  confidence_score: 70,
});

const HOPS = createMockIngredient({
  id: 'mat-hops',
  material_name: 'Cascade Hops',
  quantity: 0.005,
  impact_climate: 0.015,
  impact_climate_fossil: 0.012,
  impact_climate_biogenic: 0.003,
  impact_transport: 0.002,
  confidence_score: 60,
});

const WATER = createMockIngredient({
  id: 'mat-water',
  material_name: 'Brewing Water',
  quantity: 0.5,
  impact_climate: 0.0005,
  impact_climate_fossil: 0.0005,
  impact_climate_biogenic: 0,
  impact_transport: 0,
  confidence_score: 90,
});

const ALU_CAN = createMockPackaging({
  id: 'mat-can',
  material_name: 'Aluminium Can 330ml',
  packaging_category: 'aluminium',
  quantity: 0.015,
  impact_climate: 0.225,
  impact_climate_fossil: 0.220,
  impact_climate_biogenic: 0.005,
  impact_transport: 0.005,
  confidence_score: 80,
});

const LABEL = createMockPackaging({
  id: 'mat-label',
  material_name: 'Paper Label',
  packaging_category: 'label',
  quantity: 0.003,
  impact_climate: 0.005,
  impact_climate_fossil: 0.004,
  impact_climate_biogenic: 0.001,
  impact_transport: 0.001,
  confidence_score: 75,
});

const MOCK_PCF = createMockPCF({ system_boundary: 'cradle-to-grave' });
const MOCK_PRODUCT = createMockProduct({ unit_size_value: 330, unit_size_unit: 'ml' });

const USE_PHASE_CONFIG = {
  needsRefrigeration: true,
  refrigerationDays: 7,
  retailRefrigerationSplit: 0.5,
  isCarbonated: true,
  carbonationType: 'beer' as const,
  consumerCountryCode: 'GB',
};

const EOL_CONFIG = {
  region: 'eu' as const,
  pathways: {
    aluminium: { recycling: 75, landfill: 10, incineration: 15, composting: 0, anaerobic_digestion: 0 },
    paper: { recycling: 82, landfill: 3, incineration: 10, composting: 3, anaerobic_digestion: 2 },
  },
};

// ============================================================================
// TEST SETUP
// ============================================================================

function setupFromMock(materials: unknown[] = [MALT, ALU_CAN]) {
  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'product_carbon_footprint_materials') {
      return createQueryMock({ data: materials, error: null });
    }
    if (table === 'product_carbon_footprints') {
      return createQueryMock({ data: MOCK_PCF, error: null });
    }
    if (table === 'products') {
      return createQueryMock({ data: MOCK_PRODUCT, error: null });
    }
    return createQueryMock({ data: null, error: null });
  });
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Product LCA Aggregator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setupFromMock();
  });

  // --------------------------------------------------------------------------
  // BASIC MATERIAL AGGREGATION
  // --------------------------------------------------------------------------

  describe('Material aggregation', () => {
    it('sums climate impacts across all materials', async () => {
      setupFromMock([MALT, HOPS, WATER, ALU_CAN, LABEL]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      expect(result.success).toBe(true);
      // Each material contributes impact_climate + its inbound transport
      // (stored impact_climate is factor-only outside the decomposition path).
      const expectedTotal =
        (0.450 + 0.010) + (0.015 + 0.002) + (0.0005 + 0) + (0.225 + 0.005) + (0.005 + 0.001);
      expect(result.total_carbon_footprint).toBeCloseTo(expectedTotal, 3);
    });

    it('counts materials with an estimated fossil/biogenic split (ISO 14067 §6.4.9.3 disclosure)', async () => {
      // Two materials had no LCI split (attributed 100% to fossil, flagged
      // estimated); one had a real split. Only the two with non-trivial impact
      // and the estimated flag should be counted, so the report can disclose them.
      const estimatedA = createMockIngredient({
        id: 'mat-est-a', material_name: 'Proxy Ingredient A',
        impact_climate: 0.2, impact_climate_fossil: 0.2, impact_climate_biogenic: 0,
        impact_transport: 0, carbon_split_estimated: true,
      });
      const estimatedB = createMockPackaging({
        id: 'mat-est-b', material_name: 'Proxy Packaging B',
        impact_climate: 0.1, impact_climate_fossil: 0.1, impact_climate_biogenic: 0,
        impact_transport: 0, carbon_split_estimated: true,
      });
      const realSplit = createMockIngredient({
        id: 'mat-real', material_name: 'Verified Ingredient',
        impact_climate: 0.3, impact_climate_fossil: 0.25, impact_climate_biogenic: 0.05,
        impact_transport: 0, carbon_split_estimated: false,
      });
      setupFromMock([estimatedA, estimatedB, realSplit]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      expect(result.success).toBe(true);
      expect((result.impacts.ghg_breakdown as any).carbon_origin.estimated_split_count).toBe(2);
    });

    it('does NOT re-apply the recycled-content credit to stored impacts', async () => {
      // The calculator applies the ISO 14067 §6.4.4 recycled-content credit
      // once, at persist time, so stored impact_climate is already post-credit.
      // Re-reducing here double-counted the credit (a ~35% understatement for
      // a 70% recycled can). The stored value must pass through unchanged.
      const recycledCan = createMockPackaging({
        id: 'mat-recycled-can',
        material_name: 'Recycled Aluminium Can 330ml',
        recycled_content_percentage: 70,
        impact_climate: 0.225,
        impact_climate_fossil: 0.220,
        impact_transport: 0,
      });
      setupFromMock([recycledCan]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      expect(result.success).toBe(true);
      expect(result.total_carbon_footprint).toBeCloseTo(0.225, 6);
    });

    it('returns error when no materials found', async () => {
      setupFromMock([]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No materials found');
    });

    it('handles materials fetch error gracefully', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'product_carbon_footprint_materials') {
          return createQueryMock({ data: null, error: { message: 'DB error' } });
        }
        return createQueryMock({ data: null, error: null });
      });

      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch materials');
    });
  });

  // --------------------------------------------------------------------------
  // TRANSPORT: NO DOUBLE-COUNTING (HIGH FIX #5)
  // --------------------------------------------------------------------------

  describe('Transport — counted exactly once', () => {
    it('totalClimate includes each material\'s inbound transport once', async () => {
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      // Stored impact_climate is factor-only outside the OpenLCA decomposition
      // path, so user-entered inbound transport (impact_transport) must be
      // added during aggregation or it never reaches the headline total.
      const expectedTotal =
        MALT.impact_climate + MALT.impact_transport +
        ALU_CAN.impact_climate + ALU_CAN.impact_transport;
      expect(result.total_carbon_footprint).toBeCloseTo(expectedTotal, 3);
    });

    it('does NOT add transport again when decomposition embedded it in impact_climate', async () => {
      // The calculator's "replacement" path persists impact_climate with user
      // transport already folded in, marked by impact_climate_production and
      // impact_climate_transport_embedded. The aggregator must not add
      // impact_transport on top for those rows.
      const decomposedMalt = createMockIngredient({
        id: 'mat-malt-decomposed',
        material_name: 'Pale Malt (decomposed)',
        quantity: 0.5,
        impact_climate: 0.455, // factor − embedded generic + user DEFRA transport
        impact_climate_fossil: 0.405,
        impact_climate_biogenic: 0.050,
        impact_transport: 0.010,
        impact_climate_production: 0.430,
        impact_climate_transport_embedded: 0.015,
        confidence_score: 70,
      });
      setupFromMock([decomposedMalt]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      expect(result.total_carbon_footprint).toBeCloseTo(0.455, 6);
    });

    it('by_material breakdown matches the headline total', async () => {
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      const byMaterial = result.impacts?.breakdown?.by_material as any[];
      const materialSum = byMaterial.reduce((s: number, m: any) => s + m.climate, 0);
      expect(materialSum).toBeCloseTo(result.total_carbon_footprint, 3);
    });

    it('transport is also tracked separately in total_transport', async () => {
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      expect(result.impacts.total_transport).toBeCloseTo(
        MALT.impact_transport + ALU_CAN.impact_transport,
        4,
      );
    });
  });

  // --------------------------------------------------------------------------
  // LIFECYCLE STAGE CLASSIFICATION
  // --------------------------------------------------------------------------

  describe('Stage classification', () => {
    it('ingredients go to raw_materials stage', async () => {
      setupFromMock([MALT]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      const stages = result.impacts.breakdown.by_lifecycle_stage;
      // Inbound transport rides with the material's stage bucket, added once
      expect(stages.raw_materials).toBeCloseTo(MALT.impact_climate + MALT.impact_transport, 4);
    });

    it('packaging goes to packaging', async () => {
      setupFromMock([ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      const stages = result.impacts.breakdown.by_lifecycle_stage;
      // Inbound transport rides with the material's stage bucket, added once
      expect(stages.packaging).toBeCloseTo(ALU_CAN.impact_climate + ALU_CAN.impact_transport, 4);
    });

    it('raw_materials and packaging are segregated correctly', async () => {
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      const stages = result.impacts.breakdown.by_lifecycle_stage;
      // Inbound transport rides with each material's stage bucket, added once
      expect(stages.raw_materials).toBeCloseTo(MALT.impact_climate + MALT.impact_transport, 4);
      expect(stages.packaging).toBeCloseTo(ALU_CAN.impact_climate + ALU_CAN.impact_transport, 4);
    });

    it('[Maturation] rows go to processing stage', async () => {
      const maturationRow = createMockIngredient({
        id: 'mat-maturation',
        material_name: '[Maturation] Barrel Oak',
        material_type: 'ingredient',
        quantity: 0.1,
        impact_climate: 0.050,
        impact_transport: 0.003,
      });
      setupFromMock([maturationRow]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      const stages = result.impacts.breakdown.by_lifecycle_stage;
      // Inbound transport rides with the material's stage bucket, added once
      expect(stages.processing).toBeCloseTo(0.050 + 0.003, 4);
      expect(stages.raw_materials).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // END-OF-LIFE: PACKAGING ONLY (HIGH FIX #6)
  // --------------------------------------------------------------------------

  describe('End-of-life — packaging only', () => {
    it('EoL is applied to packaging (aluminium can), not to malt ingredient', async () => {
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-grave',
        USE_PHASE_CONFIG,
        EOL_CONFIG,
      );

      expect(result.success).toBe(true);
      const eol = result.impacts.breakdown.by_lifecycle_stage.end_of_life;

      // EoL should be non-zero (from aluminium can)
      expect(eol).not.toBe(0);

      // EoL should be small (15g aluminium only, not 500g malt)
      expect(Math.abs(eol)).toBeLessThan(0.1);
    });

    it('EoL with high recycling produces net negative (avoided burden credit)', async () => {
      setupFromMock([ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-grave',
        USE_PHASE_CONFIG,
        EOL_CONFIG,
      );

      const eol = result.impacts.breakdown.by_lifecycle_stage.end_of_life;
      // Aluminium with 75% recycling → net negative credit
      expect(eol).toBeLessThan(0);
    });

    it('[Maturation] rows are excluded from EoL even though they are synthetic', async () => {
      const maturation = createMockIngredient({
        material_name: '[Maturation] Barrel Oak',
        material_type: 'packaging', // Even if wrongly tagged as packaging
        quantity: 1.0,
        impact_climate: 0.050,
      });
      setupFromMock([maturation]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-grave',
        USE_PHASE_CONFIG,
        EOL_CONFIG,
      );

      // Maturation rows excluded from EoL
      expect(result.impacts.breakdown.by_lifecycle_stage.end_of_life).toBe(0);
    });

    it('multiple packaging types each contribute to EoL', async () => {
      setupFromMock([ALU_CAN, LABEL]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-grave',
        USE_PHASE_CONFIG,
        EOL_CONFIG,
      );

      // Both aluminium and paper label should contribute to EoL
      expect(result.impacts.breakdown.by_lifecycle_stage.end_of_life).not.toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // SYSTEM BOUNDARY GATING
  // --------------------------------------------------------------------------

  describe('System boundary gating', () => {
    it('cradle-to-gate: no use-phase, no EoL', async () => {
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      expect(result.success).toBe(true);
      expect(result.impacts.breakdown.by_lifecycle_stage.use_phase).toBe(0);
      expect(result.impacts.breakdown.by_lifecycle_stage.end_of_life).toBe(0);
    });

    it('cradle-to-shelf: no use-phase, no EoL', async () => {
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-shelf',
      );

      expect(result.impacts.breakdown.by_lifecycle_stage.use_phase).toBe(0);
      expect(result.impacts.breakdown.by_lifecycle_stage.end_of_life).toBe(0);
    });

    it('cradle-to-consumer: use-phase included, no EoL', async () => {
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-consumer',
        USE_PHASE_CONFIG,
      );

      expect(result.impacts.breakdown.by_lifecycle_stage.use_phase).toBeGreaterThan(0);
      expect(result.impacts.breakdown.by_lifecycle_stage.end_of_life).toBe(0);
    });

    it('cradle-to-grave: both use-phase and EoL included', async () => {
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-grave',
        USE_PHASE_CONFIG,
        EOL_CONFIG,
      );

      expect(result.impacts.breakdown.by_lifecycle_stage.use_phase).toBeGreaterThan(0);
      expect(result.impacts.breakdown.by_lifecycle_stage.end_of_life).not.toBe(0);
    });

    it('defaults to cradle-to-gate when no boundary specified', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'product_carbon_footprint_materials') {
          return createQueryMock({ data: [MALT, ALU_CAN], error: null });
        }
        if (table === 'product_carbon_footprints') {
          return createQueryMock({ data: { ...MOCK_PCF, system_boundary: null }, error: null });
        }
        if (table === 'products') {
          return createQueryMock({ data: MOCK_PRODUCT, error: null });
        }
        return createQueryMock({ data: null, error: null });
      });

      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        undefined,
      );

      // Should default to gate: no use-phase, no EoL
      expect(result.impacts.breakdown.by_lifecycle_stage.use_phase).toBe(0);
      expect(result.impacts.breakdown.by_lifecycle_stage.end_of_life).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // MISSING CONFIG WARNINGS
  // --------------------------------------------------------------------------

  describe('Missing config warnings', () => {
    it('warns when use-phase config missing for consumer boundary', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');

      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-consumer',
        undefined, // Missing use-phase config
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('usePhaseConfig'),
      );
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some((w: string) => w.includes('Use-phase'))).toBe(true);
      warnSpy.mockRestore();
    });

    it('warns when EoL config missing for grave boundary', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');

      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-grave',
        USE_PHASE_CONFIG,
        undefined, // Missing EoL config
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('eolConfig'),
      );
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some((w: string) => w.includes('End-of-life'))).toBe(true);
      warnSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // WARNING PLUMBING (upstream warnings + fallback event formatting)
  // --------------------------------------------------------------------------

  describe('Warning plumbing', () => {
    it('passes upstream calculator warnings through to the result', async () => {
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');

      const upstream = ['The packaging item "Box" is a multipack or shipping pack, but it doesn\'t say how many products share it.'];
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
        undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined,
        upstream,
      );

      expect(result.warnings).toBeDefined();
      expect(result.warnings).toEqual(expect.arrayContaining(upstream));
    });

    it('formats data_quality fallback events in plain language (no Priority jargon)', async () => {
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');

      const events = [
        {
          material_name: 'Pale Malt',
          material_id: 'mat-malt',
          attempted_priority: 2,
          resolved_priority: 2,
          fallback_reason: "Quantity unit 'pint' was not recognised, so the value was treated as kilograms. Please change this item's unit to one from the unit list.",
          factor_value_kg_co2e: 0.45,
          source_reference: 'test',
          category: 'data_quality' as const,
        },
        {
          material_name: 'Cascade Hops',
          material_id: 'mat-hops',
          attempted_priority: 2,
          resolved_priority: 3,
          fallback_reason: 'OpenLCA timeout',
          factor_value_kg_co2e: 0.015,
          source_reference: 'test',
          category: 'transient' as const,
        },
      ];

      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
        undefined, undefined, undefined, undefined, undefined,
        events as any,
      );

      expect(result.warnings).toBeDefined();
      const dqWarning = result.warnings!.find((w: string) => w.startsWith('Pale Malt:'));
      expect(dqWarning).toBeDefined();
      expect(dqWarning).not.toContain('Priority');
      expect(dqWarning).toContain('was not recognised');
      // Non-data_quality events keep the technical template
      const transientWarning = result.warnings!.find((w: string) => w.startsWith('Cascade Hops:'));
      expect(transientWarning).toContain('Priority');
    });

    it('warns when an EoL packaging row carries an unrecognised unit', async () => {
      const pintCan = { ...ALU_CAN, unit: 'pint' };
      setupFromMock([MALT, pintCan]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');

      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-grave',
        USE_PHASE_CONFIG,
        EOL_CONFIG,
      );

      expect(result.warnings).toBeDefined();
      const w = result.warnings!.find((x: string) => x.includes('unrecognised unit "pint"'));
      expect(w).toBeDefined();
      expect(w).toContain('Aluminium Can 330ml');
    });
  });

  // --------------------------------------------------------------------------
  // RECYCLED CONTENT vs AVOIDED-BURDEN CROSS-CHECK (no maths change)
  // --------------------------------------------------------------------------

  describe('Recycled content vs avoided-burden warning', () => {
    const recycledCan = { ...ALU_CAN, recycled_content_percentage: 40 };

    it('warns when a recycled-content material also gets an avoided-burden EoL credit', async () => {
      setupFromMock([MALT, recycledCan]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');

      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-grave',
        USE_PHASE_CONFIG,
        EOL_CONFIG, // no allocationMethod → defaults to avoided-burden
      );

      const w = result.warnings?.find((x: string) => x.includes('count the same benefit twice'));
      expect(w).toBeDefined();
      expect(w).toContain('Aluminium Can 330ml');
      expect(w).toContain('40% recycled');
      expect(w).toContain('cut-off');
    });

    it('does not warn under cut-off allocation', async () => {
      setupFromMock([MALT, recycledCan]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');

      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-grave',
        USE_PHASE_CONFIG,
        { ...EOL_CONFIG, allocationMethod: 'cut-off' } as any,
      );

      expect(result.warnings?.find((x: string) => x.includes('count the same benefit twice'))).toBeUndefined();
    });

    it('does not warn when recycled content is zero', async () => {
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');

      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-grave',
        USE_PHASE_CONFIG,
        EOL_CONFIG,
      );

      expect(result.warnings?.find((x: string) => x.includes('count the same benefit twice'))).toBeUndefined();
    });

    it('does not change the calculated totals (warning only)', async () => {
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');

      setupFromMock([MALT, recycledCan]);
      const withRecycled = await aggregateProductImpacts(
        mockSupabaseClient as any, 'pcf-001', [], 'cradle-to-grave', USE_PHASE_CONFIG, EOL_CONFIG,
      );

      setupFromMock([MALT, ALU_CAN]);
      const withoutRecycled = await aggregateProductImpacts(
        mockSupabaseClient as any, 'pcf-001', [], 'cradle-to-grave', USE_PHASE_CONFIG, EOL_CONFIG,
      );

      // The recycled-content discount is applied upstream in the calculator;
      // the aggregator must not alter the maths based on this warning.
      expect(withRecycled.total_carbon_footprint).toBeCloseTo(withoutRecycled.total_carbon_footprint, 10);
    });
  });

  // --------------------------------------------------------------------------
  // DQI SCORING
  // --------------------------------------------------------------------------

  describe('DQI scoring', () => {
    it('calculates impact-weighted average of confidence scores', async () => {
      // Malt: impact=0.450, confidence=70
      // Can:  impact=0.225, confidence=80
      // Weighted: (0.450×70 + 0.225×80) / (0.450+0.225) = (31.5+18) / 0.675 = 73.33
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      expect(result.impacts.data_quality.score).toBeCloseTo(73, 0);
    });

    it('defaults to 40 (Poor) for materials with no confidence score', async () => {
      const noConfidence = createMockIngredient({
        confidence_score: undefined,
        impact_climate: 1.0,
      });
      setupFromMock([noConfidence]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      expect(result.impacts.data_quality.score).toBe(40);
      expect(result.impacts.data_quality.rating).toBe('Poor');
    });

    it('rates ≥80 as Good, ≥50 as Fair, <50 as Poor', async () => {
      const goodMat = createMockIngredient({ confidence_score: 85, impact_climate: 1.0 });
      setupFromMock([goodMat]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      let result = await aggregateProductImpacts(mockSupabaseClient as any, 'pcf-001', [], 'cradle-to-gate');
      expect(result.impacts.data_quality.rating).toBe('Good');

      vi.resetModules();
      const fairMat = createMockIngredient({ confidence_score: 60, impact_climate: 1.0 });
      setupFromMock([fairMat]);
      const mod2 = await import('../product-lca-aggregator');
      result = await mod2.aggregateProductImpacts(mockSupabaseClient as any, 'pcf-001', [], 'cradle-to-gate');
      expect(result.impacts.data_quality.rating).toBe('Fair');

      vi.resetModules();
      const poorMat = createMockIngredient({ confidence_score: 30, impact_climate: 1.0 });
      setupFromMock([poorMat]);
      const mod3 = await import('../product-lca-aggregator');
      result = await mod3.aggregateProductImpacts(mockSupabaseClient as any, 'pcf-001', [], 'cradle-to-gate');
      expect(result.impacts.data_quality.rating).toBe('Poor');
    });
  });

  // --------------------------------------------------------------------------
  // FACILITY EMISSIONS
  // --------------------------------------------------------------------------

  describe('Facility emissions', () => {
    it('converts total facility emissions to per-unit', async () => {
      const facility = createMockFacilityEmissions({
        allocatedEmissions: 500, // total
        scope1Emissions: 200,
        scope2Emissions: 300,
        productVolume: 10000,
      });
      setupFromMock([MALT]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [facility as any],
        'cradle-to-gate',
      );

      // Per-unit = 500 / 10000 = 0.05 kg CO2e/unit
      const stages = result.impacts.breakdown.by_lifecycle_stage;
      expect(stages.processing).toBeCloseTo(0.05, 4);
    });

    it('owned facility → scope1 + scope2', async () => {
      const facility = createMockFacilityEmissions({
        isContractManufacturer: false,
        allocatedEmissions: 500,
        scope1Emissions: 200,
        scope2Emissions: 300,
        productVolume: 10000,
      });
      setupFromMock([MALT]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [facility as any],
        'cradle-to-gate',
      );

      const scopes = result.impacts.breakdown.by_scope;
      expect(scopes.scope1).toBeCloseTo(200 / 10000, 4);
      expect(scopes.scope2).toBeCloseTo(300 / 10000, 4);
    });

    it('contract manufacturer → all to scope3', async () => {
      const facility = createMockFacilityEmissions({
        isContractManufacturer: true,
        allocatedEmissions: 500,
        scope1Emissions: 200,
        scope2Emissions: 300,
        productVolume: 10000,
      });
      setupFromMock([MALT]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [facility as any],
        'cradle-to-gate',
      );

      const scopes = result.impacts.breakdown.by_scope;
      // CM emissions go to scope3 (per-unit = 0.05)
      // Material emissions also scope3, including inbound transport (Cat 4)
      expect(scopes.scope3).toBeCloseTo(0.450 + 0.010 + 0.05, 3);
      expect(scopes.scope1).toBe(0);
      expect(scopes.scope2).toBe(0);
    });

    it('facility with productVolume=0 is excluded with a visible warning (never divided by 1)', async () => {
      // Regression: the old fallback divided by 1, booking the WHOLE run's
      // allocated emissions (here 500 kg) against a single unit. The facility
      // must now be skipped and the user told to fix the production volume.
      const facility = createMockFacilityEmissions({
        allocatedEmissions: 500,
        productVolume: 0,
      });
      setupFromMock([MALT]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [facility as any],
        'cradle-to-gate',
      );

      expect(result.success).toBe(true);
      expect(result.impacts.breakdown.by_lifecycle_stage.processing).toBeCloseTo(0, 3);
      const warnings: string[] = result.impacts.calculation_warnings || [];
      expect(warnings.some((w) => w.includes('no valid production volume'))).toBe(true);
      // The facility still appears in the report detail, flagged as excluded
      const detail = result.impacts.facility_detail?.[0];
      expect(detail?.excluded_invalid_volume).toBe(true);
      expect(detail?.per_unit_total).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // BY_MATERIAL BREAKDOWN
  // --------------------------------------------------------------------------

  describe('by_material breakdown', () => {
    it('lists all materials with name, quantity, unit, climate, source', async () => {
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      const byMaterial = result.impacts.breakdown.by_material;
      expect(byMaterial).toHaveLength(2);

      const names = byMaterial.map((m: any) => m.name);
      expect(names).toContain('Pale Malt');
      expect(names).toContain('Aluminium Can 330ml');

      const malt = byMaterial.find((m: any) => m.name === 'Pale Malt');
      // climate + inbound transport, same basis as the headline total
      expect(malt.climate).toBeCloseTo(0.450 + 0.010, 3);
      expect(malt.quantity).toBe(0.5);
      expect(malt.unit).toBe('kg');
    });

    it('by_material is sorted by climate descending (hotspot first)', async () => {
      setupFromMock([ALU_CAN, MALT]); // Malt has higher climate
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      const byMaterial = result.impacts.breakdown.by_material;
      expect(byMaterial[0].name).toBe('Pale Malt'); // 0.450 > 0.225
      expect(byMaterial[1].name).toBe('Aluminium Can 330ml');
    });
  });

  // --------------------------------------------------------------------------
  // GHG BREAKDOWN
  // --------------------------------------------------------------------------

  describe('GHG breakdown', () => {
    it('includes carbon_origin split (fossil, biogenic, dluc)', async () => {
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      const ghg = result.impacts.ghg_breakdown;
      // Inbound transport combustion is fossil CO2, so it feeds the fossil split
      expect(ghg.carbon_origin.fossil).toBeCloseTo(
        MALT.impact_climate_fossil + MALT.impact_transport +
          ALU_CAN.impact_climate_fossil + ALU_CAN.impact_transport,
        3,
      );
      expect(ghg.carbon_origin.biogenic).toBeCloseTo(
        MALT.impact_climate_biogenic + ALU_CAN.impact_climate_biogenic,
        3,
      );
    });

    it('uses IPCC AR6 GWP factors for gas inventory', async () => {
      setupFromMock([MALT]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      const gwp = result.impacts.ghg_breakdown.gwp_factors;
      expect(gwp.methane_gwp100).toBe(27.9);
      expect(gwp.n2o_gwp100).toBe(273);
      expect(gwp.method).toBe('IPCC AR6');
    });
  });

  // --------------------------------------------------------------------------
  // RESULT METADATA
  // --------------------------------------------------------------------------

  describe('Result metadata', () => {
    it('returns materials_count and production_sites_count', async () => {
      setupFromMock([MALT, ALU_CAN]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      expect(result.materials_count).toBe(2);
      expect(result.production_sites_count).toBe(0);
    });

    it('includes calculated_at timestamp', async () => {
      setupFromMock([MALT]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      expect(result.impacts.calculated_at).toBeTruthy();
      // Should be a valid ISO date string
      expect(new Date(result.impacts.calculated_at).getTime()).not.toBeNaN();
    });

    it('includes calculation_version', async () => {
      setupFromMock([MALT]);
      const { aggregateProductImpacts } = await import('../product-lca-aggregator');
      const result = await aggregateProductImpacts(
        mockSupabaseClient as any,
        'pcf-001',
        [],
        'cradle-to-gate',
      );

      expect(result.impacts.calculation_version).toBeTruthy();
    });
  });
});
