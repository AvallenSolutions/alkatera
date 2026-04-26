import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockUser = { id: 'user-1' };

let job: any;
let isMember: boolean;

const fromImpl = vi.fn();

vi.mock('@/lib/supabase/api-client', () => ({
  getSupabaseAPIClient: vi.fn(async () => ({
    user: mockUser,
    error: null,
    client: { from: fromImpl } as any,
  })),
}));

let GET: typeof import('../route').GET;

beforeEach(async () => {
  vi.clearAllMocks();
  job = {
    id: 'job-1',
    supplier_id: 'supplier-1',
    user_id: 'user-1',
    organization_id: 'org-1',
    status: 'completed',
    phase_message: null,
    extracted_products: { products: [{ name: 'Frugal Bottle' }], unmapped: [], mode_used: 'datasheet' },
    error: null,
    created_at: 'c',
    updated_at: 'u',
  };
  isMember = false;

  fromImpl.mockImplementation((table: string) => {
    if (table === 'supplier_product_import_jobs') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => (job ? { data: job, error: null } : { data: null, error: null }) }),
        }),
      };
    }
    if (table === 'organization_members') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: isMember ? { id: 'm1' } : null, error: null }) }),
          }),
        }),
      };
    }
    throw new Error(`Unmocked: ${table}`);
  });

  ({ GET } = await import('../route'));
});

const ctx = (jobId: string) => ({ params: { jobId } });

describe('GET /api/supplier-products/smart-import/[jobId]', () => {
  it('returns 401 when caller is not authenticated', async () => {
    const apiClient = await import('@/lib/supabase/api-client');
    (apiClient.getSupabaseAPIClient as any).mockImplementationOnce(async () => ({
      user: null,
      error: { message: 'no session' },
      client: { from: fromImpl } as any,
    }));
    const res = await GET({} as any, ctx('job-1'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when jobId is empty', async () => {
    const res = await GET({} as any, ctx(''));
    expect(res.status).toBe(400);
  });

  it('returns 404 when the job does not exist', async () => {
    job = null;
    const res = await GET({} as any, ctx('missing'));
    expect(res.status).toBe(404);
  });

  it('returns the job for the owning user', async () => {
    const res = await GET({} as any, ctx('job-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobId).toBe('job-1');
    expect(body.status).toBe('completed');
    expect(body.products).toEqual([{ name: 'Frugal Bottle' }]);
    expect(body.modeUsed).toBe('datasheet');
  });

  it('returns 403 when caller is not the owner and not an org member', async () => {
    job = { ...job, user_id: 'other' };
    isMember = false;
    const res = await GET({} as any, ctx('job-1'));
    expect(res.status).toBe(403);
  });

  it('returns 200 when caller is an org member of the job org', async () => {
    job = { ...job, user_id: 'other' };
    isMember = true;
    const res = await GET({} as any, ctx('job-1'));
    expect(res.status).toBe(200);
  });

  it('exposes phaseMessage and error fields without crashing on null payload', async () => {
    job = { ...job, status: 'parsing', phase_message: 'Parsing file…', extracted_products: null, error: null };
    const res = await GET({} as any, ctx('job-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.phaseMessage).toBe('Parsing file…');
    expect(body.products).toEqual([]);
    expect(body.unmapped).toEqual([]);
    expect(body.modeUsed).toBeNull();
  });
});
