import { describe, expect, it, vi } from 'vitest';
import { checkProvenanceGate, CONFIRMED_SHARE_EXPORT_THRESHOLD } from '../gate';

// Same chainable mock-db shape as rollup.test.ts (kept independent rather
// than imported, since it's a small test fixture and the two files should
// stay free to evolve their fixtures separately).
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

describe('CONFIRMED_SHARE_EXPORT_THRESHOLD', () => {
  it('is 80, per the plan', () => {
    expect(CONFIRMED_SHARE_EXPORT_THRESHOLD).toBe(80);
  });
});

describe('checkProvenanceGate', () => {
  it('allows a fully confirmed org through with no blockers', async () => {
    const db = createMockDb({
      products: [{ data: [{ id: 'p1' }], error: null }],
      facilities: [{ data: [], error: null }],
      product_carbon_footprints: [{ count: 1, error: null }],
      facility_activity_entries: [{ count: 0, error: null }, { count: 0, error: null }],
    });
    const result = await checkProvenanceGate(db, 'org-1', 'products');
    expect(result.allowed).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('blocks and names the area when below threshold', async () => {
    const db = createMockDb({
      products: [{ data: Array.from({ length: 10 }, (_, i) => ({ id: `p${i}` })), error: null }],
      facilities: [{ data: [], error: null }],
      product_carbon_footprints: [{ count: 2, error: null }], // 20% confirmed
      facility_activity_entries: [{ count: 0, error: null }, { count: 0, error: null }],
    });
    const result = await checkProvenanceGate(db, 'org-1', 'products');
    expect(result.allowed).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toMatchObject({ area: 'products', unconfirmedCount: 8, deepLink: '/products' });
  });

  it('an area with zero records is never a blocker (nothing to confirm)', async () => {
    const db = createMockDb({
      products: [{ data: [], error: null }],
      facilities: [{ data: [], error: null }],
      product_carbon_footprints: [{ count: 0, error: null }],
      facility_activity_entries: [{ count: 0, error: null }, { count: 0, error: null }],
    });
    const result = await checkProvenanceGate(db, 'org-1', 'overall');
    expect(result.blockers).toEqual([]);
  });

  it('overall scope lists every under-threshold area, not just the worst one', async () => {
    const db = createMockDb({
      products: [{ data: [{ id: 'p1' }, { id: 'p2' }], error: null }],
      facilities: [{ data: [{ id: 'f1' }], error: null }],
      product_carbon_footprints: [{ count: 0, error: null }], // products 0%
      facility_activity_entries: [{ count: 10, error: null }, { count: 0, error: null }], // utilities 0%
      utility_data_entries: [{ count: 0, error: null }, { count: 0, error: null }],
      product_materials: [{ count: 5, error: null }, { count: 0, error: null }], // packaging 0%
    });
    const result = await checkProvenanceGate(db, 'org-1', 'overall');
    expect(result.allowed).toBe(false);
    const areas = result.blockers.map((b) => b.area).sort();
    expect(areas).toEqual(['packaging', 'products', 'utilities']);
  });
});
