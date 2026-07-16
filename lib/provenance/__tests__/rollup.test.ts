import { describe, expect, it, vi } from 'vitest';
import {
  computeConfirmedShare,
  confirmedShareFromIngredients,
  gatherProvenanceIngredients,
  PROVENANCE_AREA_WEIGHTS,
  type ProvenanceRollupIngredients,
} from '../rollup';

const EMPTY: ProvenanceRollupIngredients = {
  productsTotal: 0,
  productsConfirmed: 0,
  utilitiesTotal: 0,
  utilitiesConfirmed: 0,
  packagingTotal: 0,
  packagingConfirmed: 0,
};

describe('confirmedShareFromIngredients (pure scorer)', () => {
  it('scores an org with nothing at all at 0%', () => {
    const { confirmedPct, byArea } = confirmedShareFromIngredients(EMPTY);
    expect(confirmedPct).toBe(0);
    expect(byArea).toEqual({ products: 0, utilities: 0, packaging: 0 });
  });

  it('scores a fully confirmed org at 100%', () => {
    const { confirmedPct, byArea } = confirmedShareFromIngredients({
      productsTotal: 10,
      productsConfirmed: 10,
      utilitiesTotal: 24,
      utilitiesConfirmed: 24,
      packagingTotal: 15,
      packagingConfirmed: 15,
    });
    expect(confirmedPct).toBe(100);
    expect(byArea).toEqual({ products: 100, utilities: 100, packaging: 100 });
  });

  it('area weights sum to 100', () => {
    expect(
      PROVENANCE_AREA_WEIGHTS.products + PROVENANCE_AREA_WEIGHTS.utilities + PROVENANCE_AREA_WEIGHTS.packaging,
    ).toBe(100);
  });

  it('weights products, utilities and packaging per PROVENANCE_AREA_WEIGHTS', () => {
    // Only products fully confirmed, everything else at 0 — confirmedPct
    // should land exactly on the products weight.
    const { confirmedPct } = confirmedShareFromIngredients({
      ...EMPTY,
      productsTotal: 4,
      productsConfirmed: 4,
    });
    expect(confirmedPct).toBe(PROVENANCE_AREA_WEIGHTS.products);
  });

  it('an area with no records reads as 0% confirmed, not excluded from weighting', () => {
    // Products and utilities fully confirmed; packaging has no rows at all
    // (e.g. a hospitality-only org). Packaging still drags the total down.
    const { confirmedPct, byArea } = confirmedShareFromIngredients({
      productsTotal: 5,
      productsConfirmed: 5,
      utilitiesTotal: 10,
      utilitiesConfirmed: 10,
      packagingTotal: 0,
      packagingConfirmed: 0,
    });
    expect(byArea.packaging).toBe(0);
    expect(confirmedPct).toBe(PROVENANCE_AREA_WEIGHTS.products + PROVENANCE_AREA_WEIGHTS.utilities);
  });

  it('clamps a confirmed count above total rather than exceeding 100%', () => {
    const { byArea } = confirmedShareFromIngredients({
      ...EMPTY,
      productsTotal: 5,
      productsConfirmed: 9, // shouldn't happen, but must not blow up the score
    });
    expect(byArea.products).toBe(100);
  });

  it('is monotonic: confirming one more record never lowers the score', () => {
    const base: ProvenanceRollupIngredients = {
      productsTotal: 10,
      productsConfirmed: 3,
      utilitiesTotal: 20,
      utilitiesConfirmed: 5,
      packagingTotal: 8,
      packagingConfirmed: 2,
    };
    const baseScore = confirmedShareFromIngredients(base).confirmedPct;
    for (const key of ['productsConfirmed', 'utilitiesConfirmed', 'packagingConfirmed'] as const) {
      const bumped = confirmedShareFromIngredients({ ...base, [key]: base[key] + 1 });
      expect(bumped.confirmedPct).toBeGreaterThanOrEqual(baseScore);
    }
  });
});

// ---------------------------------------------------------------------------
// gatherProvenanceIngredients — mocked db, chainable query builder keyed by
// table name with a per-table response queue (a call queue rather than a
// single fixed response, since e.g. facility_activity_entries is queried
// twice in one gather: once for the trailing-12-months total, once for the
// confirmed subset).
// ---------------------------------------------------------------------------

interface MockResponse {
  data?: unknown[];
  count?: number;
  error?: unknown;
}

function createMockDb(responses: Record<string, MockResponse[]>) {
  const callIndex: Record<string, number> = {};
  const from = vi.fn((table: string) => {
    const queue = responses[table] ?? [];
    const idx = callIndex[table] ?? 0;
    callIndex[table] = idx + 1;
    const response: MockResponse = queue[idx] ?? queue[queue.length - 1] ?? { data: [], count: 0, error: null };

    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      then: (resolve: (value: MockResponse) => unknown) => Promise.resolve(response).then(resolve),
    };
    return builder;
  });
  return { from };
}

describe('gatherProvenanceIngredients', () => {
  it('combines facility_activity_entries and utility_data_entries into one utilities figure, and scopes product_materials to packaging', async () => {
    const db = createMockDb({
      products: [{ data: Array.from({ length: 10 }, (_, i) => ({ id: `p${i}` })), error: null }],
      facilities: [{ data: [{ id: 'f1' }, { id: 'f2' }], error: null }],
      product_carbon_footprints: [{ count: 6, error: null }],
      facility_activity_entries: [
        { count: 20, error: null }, // total
        { count: 8, error: null }, // confirmed (data_provenance in primary_*)
      ],
      utility_data_entries: [
        { count: 10, error: null }, // total
        { count: 4, error: null }, // confirmed (data_quality = 'actual')
      ],
      product_materials: [
        { count: 30, error: null }, // total packaging rows
        { count: 9, error: null }, // confirmed (matched_source_name set, not proxy)
      ],
    });

    const ingredients = await gatherProvenanceIngredients(db, 'org-1');

    expect(ingredients).toEqual({
      productsTotal: 10,
      productsConfirmed: 6,
      utilitiesTotal: 30, // 20 + 10
      utilitiesConfirmed: 12, // 8 + 4
      packagingTotal: 30,
      packagingConfirmed: 9,
    });
  });

  it('skips the facility- and product-scoped queries for a brand new org with neither', async () => {
    const db = createMockDb({
      products: [{ data: [], error: null }],
      facilities: [{ data: [], error: null }],
      product_carbon_footprints: [{ count: 0, error: null }],
      facility_activity_entries: [
        { count: 0, error: null },
        { count: 0, error: null },
      ],
    });

    const ingredients = await gatherProvenanceIngredients(db, 'org-empty');

    expect(ingredients).toEqual({
      productsTotal: 0,
      productsConfirmed: 0,
      utilitiesTotal: 0,
      utilitiesConfirmed: 0,
      packagingTotal: 0,
      packagingConfirmed: 0,
    });
    // Never queried: nothing to scope utility_data_entries / product_materials to.
    expect(db.from).not.toHaveBeenCalledWith('utility_data_entries');
    expect(db.from).not.toHaveBeenCalledWith('product_materials');
  });

  it('degrades a failed query to 0 rather than throwing', async () => {
    const db = createMockDb({
      products: [{ data: [{ id: 'p1' }], error: null }],
      facilities: [{ data: [], error: null }],
      product_carbon_footprints: [{ count: null, error: { message: 'boom' } }],
      facility_activity_entries: [
        { count: null, error: { message: 'boom' } },
        { count: null, error: { message: 'boom' } },
      ],
    });

    const ingredients = await gatherProvenanceIngredients(db, 'org-flaky');
    expect(ingredients.productsConfirmed).toBe(0);
    expect(ingredients.utilitiesTotal).toBe(0);
  });
});

describe('computeConfirmedShare (org wrapper)', () => {
  it('gathers ingredients then scores them', async () => {
    const db = createMockDb({
      products: [{ data: [{ id: 'p1' }, { id: 'p2' }], error: null }],
      facilities: [{ data: [], error: null }],
      product_carbon_footprints: [{ count: 2, error: null }],
      facility_activity_entries: [
        { count: 0, error: null },
        { count: 0, error: null },
      ],
    });

    const rollup = await computeConfirmedShare(db, 'org-1');
    expect(rollup.byArea.products).toBe(100);
    expect(rollup.confirmedPct).toBe(PROVENANCE_AREA_WEIGHTS.products);
  });
});
