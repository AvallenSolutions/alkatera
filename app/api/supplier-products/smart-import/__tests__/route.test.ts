import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks. The kickoff route imports getSupabaseAPIClient, pdf-parse,
// and the @anthropic-ai/sdk module dynamically — every dependency that talks
// to the outside world is mocked here so the tests are deterministic.
// ---------------------------------------------------------------------------

const mockUser = { id: 'user-1' };

const mockSupplier = {
  id: 'supplier-1',
  organization_id: 'org-1',
  user_id: 'user-1',
};

interface JobRow {
  id: string;
  status: string;
  file_storage_path?: string;
  extracted_products?: any;
  error?: string | null;
}

let jobs: JobRow[];
let cachedJobBySupplierAndHash: { supplier_id: string; file_hash: string; created_at: string; id: string } | null;
let dailyCount: number;
let lastUploadCall: { bucket: string; path: string } | null;
let supplierLookup: typeof mockSupplier | null;

const fromImpl = vi.fn();
const storageFromImpl = vi.fn();
const anthropicCreateMock = vi.fn();

vi.mock('@/lib/supabase/api-client', () => ({
  getSupabaseAPIClient: vi.fn(async () => ({
    user: mockUser,
    error: null,
    client: { from: fromImpl, storage: { from: storageFromImpl } } as any,
  })),
}));

vi.mock('pdf-parse', () => ({
  default: vi.fn(async (_buf: Buffer) => ({ text: 'Frugal Bottle weighs 82g and is 94% recycled.' })),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: anthropicCreateMock };
  },
}));

// Lazy-import the route under test AFTER mocks are wired.
let POST: typeof import('../route').POST;

const buildFromBuilder = (table: string) => {
  if (table === 'suppliers') {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            supplierLookup ? { data: supplierLookup, error: null } : { data: null, error: null },
        }),
      }),
    };
  }
  if (table === 'organization_members') {
    // Default: not a member.
    return {
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
    };
  }
  if (table === 'supplier_product_import_jobs') {
    const insertChain = {
      insert: (row: any) => {
        const newJob: JobRow = { id: `job-${jobs.length + 1}`, status: row.status };
        jobs.push(newJob);
        return {
          select: () => ({
            single: async () => ({ data: newJob, error: null }),
          }),
        };
      },
      update: (patch: any) => ({
        eq: async (_col: string, jobId: string) => {
          const j = jobs.find(x => x.id === jobId);
          if (j) Object.assign(j, patch);
          return { error: null };
        },
      }),
      // Two select chains: dedupe (.eq.eq.eq.gte.order.limit.maybeSingle) and
      // daily-count (.eq.gte.in via head:true count).
      select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.count === 'exact' && opts.head) {
          return {
            eq: () => ({
              gte: () => ({
                in: async () => ({ count: dailyCount, error: null }),
              }),
            }),
          };
        }
        return {
          eq: (_a: string, _b: string) => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: cachedJobBySupplierAndHash
                          ? { id: cachedJobBySupplierAndHash.id }
                          : null,
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      },
    };
    return insertChain;
  }
  throw new Error(`Unmocked table: ${table}`);
};

beforeEach(async () => {
  vi.clearAllMocks();
  jobs = [];
  cachedJobBySupplierAndHash = null;
  dailyCount = 0;
  lastUploadCall = null;
  supplierLookup = mockSupplier;

  fromImpl.mockImplementation(buildFromBuilder);
  storageFromImpl.mockImplementation((bucket: string) => ({
    upload: async (path: string, _buf: Buffer, _opts: any) => {
      lastUploadCall = { bucket, path };
      return { data: { path }, error: null };
    },
  }));

  anthropicCreateMock.mockResolvedValue({
    content: [
      {
        type: 'tool_use',
        id: 't1',
        name: 'extract_supplier_products',
        input: {
          products: [
            {
              name: 'Frugal Bottle',
              product_type: 'packaging',
              unit: 'unit',
              packaging_category: 'container',
              primary_material: 'recycled_paperboard',
              epr_material_code: 'PC',
              epr_is_drinks_container: true,
              weight_g: { value: 82, confidence: 'high', source_quote: '82g' },
              recycled_content_pct: { value: 94, confidence: 'high', source_quote: '94%' },
              recyclability_pct: { value: null, confidence: 'low', source_quote: null },
              impact_climate: { value: 0.091, confidence: 'high', source_quote: '0.091 kg' },
              impact_water: { value: null, confidence: 'low', source_quote: null },
              impact_waste: { value: null, confidence: 'low', source_quote: null },
              impact_land: { value: null, confidence: 'low', source_quote: null },
              origin_country_code: 'GB',
              description: 'Paper bottle.',
              row_confidence: 'high',
            },
          ],
          unmapped: [],
        },
      },
    ],
  });

  process.env.ANTHROPIC_API_KEY = 'sk-test';

  ({ POST } = await import('../route'));
});

// Minimal File-like that exposes arrayBuffer() reliably across runtimes.
// JSDOM's Blob.arrayBuffer() is flaky on the version pinned in this repo,
// so we hand-roll the surface the route actually touches.
const makeFakeFile = (name: string, type: string, bytes: Uint8Array) => ({
  name,
  type,
  size: bytes.byteLength,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
});

const makeRequest = (file: { name: string; type: string; bytes?: Uint8Array } | null, supplierId: string | null) => {
  const fd: Record<string, unknown> = {};
  if (file) {
    fd.file = makeFakeFile(file.name, file.type, file.bytes ?? new Uint8Array([1, 2, 3]));
  }
  if (supplierId !== null) fd.supplier_id = supplierId;
  // Mimic the slice of FormData the route uses: get(name).
  const fakeFormData = {
    get: (key: string) => fd[key] ?? null,
  } as any;
  return { formData: async () => fakeFormData } as any;
};

const mkApiClientWith = (impl: { user: any; error: any }) => async () => ({
  user: impl.user,
  error: impl.error,
  client: { from: fromImpl, storage: { from: storageFromImpl } } as any,
});

describe('POST /api/supplier-products/smart-import', () => {
  it('returns 401 when caller is not authenticated', async () => {
    const apiClient = await import('@/lib/supabase/api-client');
    (apiClient.getSupabaseAPIClient as any).mockImplementationOnce(
      mkApiClientWith({ user: null, error: { message: 'no session' } }),
    );

    const res = await POST(makeRequest({ name: 'a.pdf', type: 'application/pdf' }, 'supplier-1'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when the file is missing', async () => {
    const res = await POST(makeRequest(null, 'supplier-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('file');
  });

  it('returns 400 when supplier_id is missing', async () => {
    const res = await POST(makeRequest({ name: 'a.pdf', type: 'application/pdf' }, null));
    expect(res.status).toBe(400);
  });

  it('rejects unsupported file types', async () => {
    const res = await POST(makeRequest({ name: 'a.png', type: 'image/png' }, 'supplier-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Unsupported/i);
  });

  it('returns 404 when supplier does not exist', async () => {
    supplierLookup = null;
    const res = await POST(makeRequest({ name: 'a.pdf', type: 'application/pdf' }, 'supplier-1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller does not own the supplier and is not in its org', async () => {
    supplierLookup = { ...mockSupplier, user_id: 'someone-else' };
    const res = await POST(makeRequest({ name: 'a.pdf', type: 'application/pdf' }, 'supplier-1'));
    expect(res.status).toBe(403);
  });

  it('returns the cached jobId when the same file was processed within 24h', async () => {
    cachedJobBySupplierAndHash = {
      supplier_id: 'supplier-1',
      file_hash: 'unused',
      created_at: new Date().toISOString(),
      id: 'cached-job-7',
    };
    const res = await POST(makeRequest({ name: 'a.pdf', type: 'application/pdf' }, 'supplier-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobId).toBe('cached-job-7');
    expect(body.cached).toBe(true);
    // No anthropic call when we hit the cache.
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });

  it('returns 429 when the daily extraction cap is reached', async () => {
    dailyCount = 999;
    const res = await POST(makeRequest({ name: 'a.pdf', type: 'application/pdf' }, 'supplier-1'));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/Daily smart-import limit/i);
    // No Anthropic call when capped.
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });

  it('happy path: creates a job, uploads to storage, runs extraction, and returns 202', async () => {
    const res = await POST(makeRequest({ name: 'frugal.pdf', type: 'application/pdf' }, 'supplier-1'));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.jobId).toBeTruthy();

    // File landed in supplier-product-evidence under the supplier's folder.
    expect(lastUploadCall?.bucket).toBe('supplier-product-evidence');
    expect(lastUploadCall?.path).toMatch(/^supplier-1\/imports\/job-\d+-frugal\.pdf$/);

    // Anthropic was called once and the row is back as completed with the
    // extracted product attached.
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
    const completed = jobs.find(j => j.status === 'completed');
    expect(completed?.extracted_products?.products?.[0]?.name).toBe('Frugal Bottle');
  });

  it('marks the job failed and still returns 202 when extraction throws', async () => {
    anthropicCreateMock.mockRejectedValueOnce(new Error('Anthropic rate limited'));
    const res = await POST(makeRequest({ name: 'frugal.pdf', type: 'application/pdf' }, 'supplier-1'));
    expect(res.status).toBe(202);
    const failed = jobs.find(j => j.status === 'failed');
    expect(failed?.error).toContain('Anthropic rate limited');
  });

  it('accepts CSV files and routes them to catalogue mode (no PDF parse)', async () => {
    const csvBytes = new TextEncoder().encode(
      [
        'name,type,weight,recycled',
        'Bottle A,packaging,82,94',
        'Bottle B,packaging,90,60',
        'Bottle C,packaging,100,30',
        'Bottle D,packaging,110,10',
      ].join('\n'),
    );
    const res = await POST(makeRequest({ name: 'cat.csv', type: 'text/csv', bytes: csvBytes }, 'supplier-1'));
    expect(res.status).toBe(202);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);

    // pdf-parse must not be invoked for CSVs.
    const pdfMod = await import('pdf-parse');
    expect((pdfMod.default as any).mock.calls).toHaveLength(0);
  });

  it('allows an org member who does not own the supplier through', async () => {
    supplierLookup = { ...mockSupplier, user_id: 'someone-else' };
    // Override the membership lookup to return a row.
    fromImpl.mockImplementation((table: string) => {
      if (table === 'organization_members') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'm1' }, error: null }) }) }),
          }),
        };
      }
      return buildFromBuilder(table);
    });
    const res = await POST(makeRequest({ name: 'frugal.pdf', type: 'application/pdf' }, 'supplier-1'));
    expect(res.status).toBe(202);
  });
});
