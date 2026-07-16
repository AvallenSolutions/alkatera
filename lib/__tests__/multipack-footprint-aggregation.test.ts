/**
 * Multipack footprint aggregation.
 *
 * A multipack's footprint = Σ(component product footprints × quantity) + the
 * multipack's OWN transit/grouping packaging. The calculator injects each
 * component's aggregated footprint as a `multipack_component` material row (see
 * product-lca-calculator: "Multipack footprint path"). This test proves the
 * aggregator folds those rows into the headline total and books them under
 * raw materials (the pack's "contents"), keeping the multipack's own packaging
 * in the packaging stage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AggregationResult } from '../product-lca-aggregator';

const mockSupabaseClient = { from: vi.fn() };

function createQueryMock(response: { data: unknown; error: unknown }) {
  const mock: Record<string, unknown> = {};
  const chainable = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'ilike', 'lte', 'gte', 'order', 'limit', 'in'];
  chainable.forEach(m => { mock[m] = vi.fn().mockReturnValue(mock); });
  mock.single = vi.fn().mockResolvedValue(response);
  mock.maybeSingle = vi.fn().mockResolvedValue(response);
  mock.then = (resolve: (r: typeof response) => void) => { resolve(response); return Promise.resolve(response); };
  return mock;
}

const ZERO_IMPACTS = {
  impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: 0,
  impact_transport: 0, impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
  impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
  impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
  confidence_score: 80, ch4_kg: 0, n2o_kg: 0,
};

// One component product bottle, footprint 2.0 kg CO2e, ×1 in the pack. This is
// the shape the calculator injects for each multipack component.
const COMPONENT_ROW = {
  id: 'mat-component',
  material_name: 'Everleaf Marine 50cl (×1)',
  material_type: 'multipack_component',
  quantity: 1,
  unit: 'unit',
  ...ZERO_IMPACTS,
  impact_climate: 2.0,
  impact_climate_fossil: 1.8,
  impact_climate_biogenic: 0.2,
};

// The multipack's OWN shipper box (shipment role, one per multipack unit).
const SHIPPER_ROW = {
  id: 'mat-shipper',
  material_name: 'Corrugated shipper box',
  material_type: 'packaging',
  packaging_category: 'shipment',
  quantity: 0.25,
  unit: 'kg',
  units_per_group: 1,
  ...ZERO_IMPACTS,
  impact_climate: 0.5,
  impact_climate_fossil: 0.5,
};

const MOCK_PCF = { product_id: 'prod-mp', organization_id: 'org-001', system_boundary: 'cradle-to-gate' };
const MOCK_PRODUCT = { unit_size_value: null, unit_size_unit: null };

function mockMaterials(rows: unknown[]) {
  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'product_carbon_footprint_materials') return createQueryMock({ data: rows, error: null });
    if (table === 'product_carbon_footprints') return createQueryMock({ data: MOCK_PCF, error: null });
    if (table === 'products') return createQueryMock({ data: MOCK_PRODUCT, error: null });
    return createQueryMock({ data: null, error: null });
  });
}

async function runAggregator(): Promise<AggregationResult> {
  const { aggregateProductImpacts } = await import('../product-lca-aggregator');
  // cradle-to-gate keeps the assertion to production impacts (no EoL/use phase).
  return aggregateProductImpacts(
    mockSupabaseClient as any,
    'pcf-mp',
    [],
    'cradle-to-gate',
  );
}

const stage = (r: AggregationResult, key: string) =>
  ((r.impacts as any)?.breakdown?.by_lifecycle_stage?.[key] as number | undefined) ?? 0;

describe('Multipack footprint aggregation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sums component footprints and own packaging into the headline total', async () => {
    mockMaterials([COMPONENT_ROW, SHIPPER_ROW]);
    const result = await runAggregator();
    expect(result.success).toBe(true);
    // 2.0 (component) + 0.5 (shipper) = 2.5 kg CO2e per multipack unit.
    expect(result.total_carbon_footprint).toBeCloseTo(2.5, 6);
  });

  it('books components under raw materials and own packaging under packaging', async () => {
    mockMaterials([COMPONENT_ROW, SHIPPER_ROW]);
    const result = await runAggregator();
    expect(stage(result, 'raw_materials')).toBeCloseTo(2.0, 6);
    expect(stage(result, 'packaging')).toBeCloseTo(0.5, 6);
  });

  it('a component with no completed footprint contributes nothing (no injected row)', async () => {
    // The calculator skips components without a completed PCF, so the aggregator
    // only ever sees the multipack's own packaging in that case.
    mockMaterials([SHIPPER_ROW]);
    const result = await runAggregator();
    expect(result.total_carbon_footprint).toBeCloseTo(0.5, 6);
    expect(stage(result, 'raw_materials')).toBeCloseTo(0, 6);
  });
});
