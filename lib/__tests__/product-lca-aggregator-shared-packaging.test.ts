/**
 * Shared-packaging End-of-Life allocation tests.
 *
 * Regression cover for the UNROOTED / Happy Curations LCA review (2026-06-10):
 *
 *   Fix #1 — Secondary/shipment/tertiary packaging (a multipack carton) must have
 *            its END-OF-LIFE burden divided by units_per_group, the same divisor
 *            the production side already applies. Previously the full multipack
 *            carton was disposed against every single bottle.
 *
 *   Fix #2 — A cardboard multipack carton named "… box" must classify as 'paper'
 *            (74% UK recycling, biogenic incineration), not fall back to 'other'
 *            (28% recycling, fossil 1.5 kg/kg incineration).
 *
 * Primary packaging (container/closure/label) must NEVER be amortised, even if a
 * units_per_group value is present on the row.
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
  impact_climate: 0, impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: 0,
  impact_transport: 0, impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
  impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
  impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
  confidence_score: 50, ch4_kg: 0, n2o_kg: 0,
};

// A 4-pack cardboard multipack carton. Full carton mass = 0.134 kg, shared across
// 4 bottles → per-bottle EoL share should be 0.0335 kg.
const makeBox = (unitsPerGroup: number) => ({
  id: 'mat-box',
  material_name: '4 × 420ml box',
  material_type: 'packaging',
  category_type: 'MANUFACTURING_MATERIAL',
  packaging_category: 'secondary',
  quantity: 0.134,
  unit: 'kg',
  units_per_group: unitsPerGroup,
  ...ZERO_IMPACTS,
});

// Primary glass bottle (per-bottle). Carries a stray units_per_group to prove
// primary packaging is never amortised.
const GLASS_BOTTLE = {
  id: 'mat-glass',
  material_name: '420ml flint glass bottle',
  material_type: 'packaging',
  category_type: 'MANUFACTURING_MATERIAL',
  packaging_category: 'container',
  quantity: 0.230,
  unit: 'kg',
  units_per_group: 4,
  ...ZERO_IMPACTS,
};

const MOCK_PCF = { product_id: 'prod-001', organization_id: 'org-001', system_boundary: 'cradle-to-grave' };
const MOCK_PRODUCT = { unit_size_value: 420, unit_size_unit: 'ml' };
const EOL_CONFIG = { region: 'uk' as const };

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
  return aggregateProductImpacts(
    mockSupabaseClient as any,
    'pcf-001',
    [],
    'cradle-to-grave',
    undefined,
    EOL_CONFIG,
  );
}

const findEol = (result: AggregationResult, name: string) =>
  ((result.impacts as any)?.eol_material_breakdown as any[] | undefined)?.find(m => m.material === name);

const stageEol = (result: AggregationResult) =>
  result.impacts!.breakdown!.by_lifecycle_stage!.end_of_life;

/**
 * CAPTURED, NOT HAND-DERIVED.
 *
 * Read straight out of `aggregateProductImpacts` running against the fixtures
 * in this file (capture run 2026-07-22, redesign branch, on top of the
 * downstream-stage extraction in `lib/lca/downstream-stages.ts`). A failure
 * here means the engine moved; explain the move before re-capturing.
 *
 * Why exact values: the ratio assertions this suite is built on
 * (`shared.netEmissions ≈ full.netEmissions / 4`) hold under any uniform
 * scaling of the stage, so a mutation inflating end-of-life by 50% sailed
 * through them. The divisor and the absolute burden both need pinning.
 * `lib/lca/__tests__/downstream-stages.test.ts` set the pattern.
 *
 * All UK region, cut-off allocation, zero production-side impacts, so the
 * end-of-life stage total IS the sum of these rows.
 */
const GOLDEN = {
  /** 0.134 kg carton ÷ 4 bottles = 0.0335 kg, paper factors at UK 74/5/15/4/2. */
  box_shared_4: 0.0058909750000000006,
  /** The same carton un-shared: exactly 4× the above. */
  box_full: 0.023563900000000002,
  /** 0.23 kg flint glass, never amortised despite its stray units_per_group. */
  glass_bottle: 0.0018285,
} as const;

describe('Shared-packaging EoL allocation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('classifies a cardboard "box" carton as paper (not other) at end-of-life', async () => {
    mockMaterials([makeBox(4)]);
    const box = findEol(await runAggregator(), '4 × 420ml box');
    expect(box).toBeDefined();
    expect(box.factorKey).toBe('paper');
    // Paper UK recycling rate ≈ 74%, NOT the 28% of the 'other' fallback.
    expect(box.recyclingPct).toBeGreaterThan(60);
  });

  it('divides the carton EoL mass AND burden by units_per_group', async () => {
    mockMaterials([makeBox(4)]);
    const result = await runAggregator();
    const box = findEol(result, '4 × 420ml box');
    // 0.134 kg carton ÷ 4 bottles = 0.0335 kg per bottle.
    expect(box.massKg).toBe(0.0335);
    // And the burden that mass carries, in absolute terms. A ratio assertion
    // alone survives any uniform inflation of the stage.
    expect(box.netEmissions).toBe(GOLDEN.box_shared_4);
    expect(box.grossEmissions).toBe(GOLDEN.box_shared_4);
    expect(box.avoidedEmissions === 0).toBe(true); // cut-off; `===` because it is -0
    // Nothing else in this fixture has an impact, so the stage IS this row.
    expect(stageEol(result)).toBe(GOLDEN.box_shared_4);
  });

  it('carton EoL net scales 1/units_per_group (4-pack vs un-shared)', async () => {
    mockMaterials([makeBox(4)]);
    const sharedResult = await runAggregator();
    const shared = findEol(sharedResult, '4 × 420ml box');

    vi.clearAllMocks();
    mockMaterials([makeBox(1)]);
    const fullResult = await runAggregator();
    const full = findEol(fullResult, '4 × 420ml box');

    expect(full.massKg).toBe(0.134);
    expect(full.netEmissions).toBe(GOLDEN.box_full);
    expect(stageEol(fullResult)).toBe(GOLDEN.box_full);

    // EoL is linear in mass, so the 4-pack share is exactly 1/4 of the full
    // carton. Kept alongside the absolute values: the ratio pins the divisor,
    // the absolutes pin the burden. Neither catches the other's regression.
    expect(shared.netEmissions).toBeCloseTo(full.netEmissions / 4, 12);
    expect(shared.massKg).toBe(full.massKg / 4);
  });

  it('does NOT amortise primary packaging even when units_per_group is set', async () => {
    mockMaterials([GLASS_BOTTLE]);
    const result = await runAggregator();
    const glass = findEol(result, '420ml flint glass bottle');
    expect(glass).toBeDefined();
    // Full per-bottle mass retained despite the stray units_per_group=4.
    expect(glass.massKg).toBe(0.230);
    expect(glass.factorKey).toBe('glass');
    expect(glass.netEmissions).toBe(GOLDEN.glass_bottle);
    expect(stageEol(result)).toBe(GOLDEN.glass_bottle);
  });

  it('sums a shared carton and an un-amortised bottle into one stage total', async () => {
    // Both allocation rules firing at once, which is the real multipack case.
    mockMaterials([makeBox(4), GLASS_BOTTLE]);
    const result = await runAggregator();
    expect(stageEol(result)).toBe(GOLDEN.box_shared_4 + GOLDEN.glass_bottle);
  });
});
