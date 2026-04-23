import { describe, expect, it, vi } from 'vitest';
import { executeTool, ROSA_TOOLS, type ToolContext } from '../tools';
import { formatMemoryBlock, type MemoryEntry } from '../memory';

/**
 * Minimal Supabase client mock. Builder-style API.
 * Each test sets the terminal response via `terminal`.
 */
function buildMockClient(responses: Record<string, any> = {}) {
  const calls: any[] = [];
  const makeChain = (table: string) => {
    const state: any = {
      _table: table,
      _filters: [],
      select: vi.fn().mockImplementation(function (this: any) {
        return this;
      }),
      eq: vi.fn().mockImplementation(function (this: any, col: string, val: any) {
        this._filters.push(['eq', col, val]);
        return this;
      }),
      gte: vi.fn().mockImplementation(function (this: any) {
        return this;
      }),
      lte: vi.fn().mockImplementation(function (this: any) {
        return this;
      }),
      lt: vi.fn().mockImplementation(function (this: any) {
        return this;
      }),
      in: vi.fn().mockImplementation(function (this: any) {
        return this;
      }),
      or: vi.fn().mockImplementation(function (this: any) {
        return this;
      }),
      order: vi.fn().mockImplementation(function (this: any) {
        return this;
      }),
      limit: vi.fn().mockImplementation(function (this: any) {
        return this;
      }),
      maybeSingle: vi.fn().mockImplementation(async function (this: any) {
        calls.push({ table, filters: this._filters, op: 'maybeSingle' });
        const r = responses[`${table}:maybeSingle`];
        return r ?? { data: null, error: null };
      }),
      single: vi.fn().mockImplementation(async function (this: any) {
        calls.push({ table, filters: this._filters, op: 'single' });
        const r = responses[`${table}:single`];
        return r ?? { data: null, error: null };
      }),
      upsert: vi.fn().mockImplementation(function (this: any, row: any) {
        this._upserted = row;
        return this;
      }),
      then: undefined,
    };
    // Make the chain itself thenable so `await q` resolves to the list response.
    Object.defineProperty(state, 'then', {
      value: (onFulfilled: any) => {
        calls.push({ table, filters: state._filters, op: 'list' });
        const r = responses[`${table}:list`];
        return Promise.resolve(r ?? { data: [], error: null, count: 0 }).then(onFulfilled);
      },
    });
    return state;
  };
  return {
    client: {
      from: (t: string) => makeChain(t),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as any,
    calls,
  };
}

function makeCtx(mockClient: any, overrides?: Partial<ToolContext>): ToolContext {
  return {
    supabase: mockClient,
    organizationId: 'org-1',
    userId: 'user-1',
    ...overrides,
  };
}

describe('ROSA_TOOLS schema', () => {
  it('exposes every tool we expect in Phase 1', () => {
    const names = ROSA_TOOLS.map(t => t.name).sort();
    expect(names).toEqual(expect.arrayContaining([
      'get_org_context',
      'list_facilities',
      'list_products',
      'list_suppliers',
      'list_lcas',
      'list_reports',
      'list_insights',
      'query_pulse_metrics',
      'compare_facilities',
      'list_recent_anomalies',
      'get_product_footprint',
      'get_lca_summary',
      'search_knowledge_bank',
      'explain_methodology',
      'compare_to_benchmark',
      'suggest_data_gaps',
      'list_memories',
      'save_memory',
      'run_safe_sql',
    ]));
  });

  it('every tool has a name, description and input_schema', () => {
    for (const t of ROSA_TOOLS) {
      expect(t.name).toBeTruthy();
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.input_schema).toBeDefined();
    }
  });
});

describe('executeTool — unknown tool', () => {
  it('returns an error for unknown tool names', async () => {
    const { client } = buildMockClient();
    const res = await executeTool(makeCtx(client), 'not_a_tool', {});
    expect(res.is_error).toBe(true);
    expect(res.content).toMatch(/Unknown tool/);
  });
});

describe('list_suppliers', () => {
  it('scopes by organization_id and returns rows', async () => {
    const { client, calls } = buildMockClient({
      'suppliers:list': { data: [{ id: 's1', name: 'Acme' }], error: null },
    });
    const res = await executeTool(makeCtx(client), 'list_suppliers', {});
    expect(res.is_error).toBe(false);
    expect(JSON.parse(res.content)[0].name).toBe('Acme');
    const suppliersCall = calls.find(c => c.table === 'suppliers');
    expect(suppliersCall.filters).toContainEqual(['eq', 'organization_id', 'org-1']);
  });
});

describe('list_lcas', () => {
  it('filters by status when provided and scopes to org', async () => {
    const { client, calls } = buildMockClient({
      'product_carbon_footprints:list': { data: [{ id: 'l1', status: 'completed' }], error: null },
    });
    const res = await executeTool(makeCtx(client), 'list_lcas', { status: 'completed' });
    expect(res.is_error).toBe(false);
    const call = calls.find(c => c.table === 'product_carbon_footprints');
    expect(call.filters).toContainEqual(['eq', 'organization_id', 'org-1']);
    expect(call.filters).toContainEqual(['eq', 'status', 'completed']);
  });
});

describe('search_knowledge_bank', () => {
  it('rejects empty query', async () => {
    const { client } = buildMockClient();
    const res = await executeTool(makeCtx(client), 'search_knowledge_bank', { query: '' });
    expect(res.is_error).toBe(true);
  });

  it('returns entries with source_url on match', async () => {
    const { client } = buildMockClient({
      'gaia_knowledge_base:list': {
        data: [{
          id: 'kb1',
          entry_type: 'guideline',
          title: 'ISO 14044',
          content: 'Data quality...',
          category: 'iso_methodology',
          tags: ['iso_14044'],
          source_url: 'https://www.iso.org/standard/38498.html',
          priority: 10,
        }],
        error: null,
      },
    });
    const res = await executeTool(makeCtx(client), 'search_knowledge_bank', { query: 'ISO 14044' });
    expect(res.is_error).toBe(false);
    const parsed = JSON.parse(res.content);
    expect(parsed.entries[0].source_url).toBe('https://www.iso.org/standard/38498.html');
  });
});

describe('explain_methodology', () => {
  it('requires a term', async () => {
    const { client } = buildMockClient();
    const res = await executeTool(makeCtx(client), 'explain_methodology', { term: '' });
    expect(res.is_error).toBe(true);
  });
});

describe('suggest_data_gaps', () => {
  it('nudges user to add their first product when everything is empty', async () => {
    const { client } = buildMockClient({
      'products:list': { data: [], error: null, count: 0 },
      'facilities:list': { data: [], error: null, count: 0 },
      'suppliers:list': { data: [], error: null, count: 0 },
      'product_carbon_footprints:list': { data: [], error: null, count: 0 },
    });
    const res = await executeTool(makeCtx(client), 'suggest_data_gaps', {});
    expect(res.is_error).toBe(false);
    const parsed = JSON.parse(res.content);
    expect(parsed.next.step).toMatch(/first product/i);
  });
});

describe('save_memory', () => {
  it('rejects empty key', async () => {
    const { client } = buildMockClient();
    const res = await executeTool(makeCtx(client), 'save_memory', { scope: 'user', key: '', value: 'x' });
    expect(res.is_error).toBe(true);
  });

  it('upserts into rosa_memory with scope', async () => {
    const { client, calls } = buildMockClient({
      'rosa_memory:single': { data: { id: 'm1' }, error: null },
    });
    const res = await executeTool(makeCtx(client), 'save_memory', {
      scope: 'user',
      key: 'response_style',
      value: 'short',
    });
    expect(res.is_error).toBe(false);
    expect(calls.some(c => c.table === 'rosa_memory')).toBe(true);
  });
});

describe('compare_to_benchmark', () => {
  it('returns note when product has no completed LCA', async () => {
    const { client } = buildMockClient({
      'products:maybeSingle': {
        data: { id: 'p1', name: 'Avallen Calvados', product_type: 'Spirits', volume_ml: 700 },
        error: null,
      },
      'product_carbon_footprints:maybeSingle': { data: null, error: null },
    });
    const res = await executeTool(makeCtx(client), 'compare_to_benchmark', { product_id: 'p1' });
    expect(res.is_error).toBe(false);
    const parsed = JSON.parse(res.content);
    expect(parsed.benchmark.value_kg_co2e_per_litre).toBeGreaterThan(0);
    expect(parsed.benchmark.source_url).toBeTruthy();
  });
});

describe('formatMemoryBlock', () => {
  it('returns empty string when no memories', () => {
    expect(formatMemoryBlock([])).toBe('');
  });

  it('groups user vs org memories with labels', () => {
    const entries: MemoryEntry[] = [
      { id: '1', scope: 'user', key: 'response_style', value: 'short', updated_at: '2026-04-01' },
      { id: '2', scope: 'org', key: 'reporting_framework', value: 'VSME', updated_at: '2026-04-01' },
    ];
    const block = formatMemoryBlock(entries);
    expect(block).toMatch(/About this user/);
    expect(block).toMatch(/About this organisation/);
    expect(block).toMatch(/response_style: short/);
    expect(block).toMatch(/reporting_framework: VSME/);
  });
});
