import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockUser = { id: 'user-1' };
const mockSupplier = { id: 'supplier-1', organization_id: 'org-1', user_id: 'user-1' };

let supplierLookup: typeof mockSupplier | null;
let isMember: boolean;
let insertedRows: any[];
let insertError: { message: string; code?: string } | null;

const fromImpl = vi.fn();

vi.mock('@/lib/supabase/api-client', () => ({
  getSupabaseAPIClient: vi.fn(async () => ({
    user: mockUser,
    error: null,
    client: { from: fromImpl } as any,
  })),
}));

let POST: typeof import('../route').POST;

beforeEach(async () => {
  vi.clearAllMocks();
  supplierLookup = mockSupplier;
  isMember = false;
  insertedRows = [];
  insertError = null;

  fromImpl.mockImplementation((table: string) => {
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
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: isMember ? { id: 'm1' } : null, error: null }) }),
          }),
        }),
      };
    }
    if (table === 'supplier_products') {
      return {
        insert: (rows: any[]) => {
          insertedRows = rows;
          return {
            select: () => ({
              // chain for insert+select
              // simulate inserted ids
              then: undefined,
            }),
            // direct .select await
          };
        },
        update: () => ({ in: async () => ({ error: null }) }),
      } as any;
    }
    throw new Error(`Unmocked: ${table}`);
  });

  // Override insert to await-able shape with returning ids.
  fromImpl.mockImplementation((table: string) => {
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
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: isMember ? { id: 'm1' } : null, error: null }) }),
          }),
        }),
      };
    }
    if (table === 'supplier_products') {
      return {
        insert: (rows: any[]) => ({
          select: async () => {
            if (insertError) return { data: null, error: insertError };
            insertedRows = rows;
            return { data: rows.map((_, i) => ({ id: `prod-${i + 1}` })), error: null };
          },
        }),
        update: () => ({ in: async () => ({ error: null }) }),
      } as any;
    }
    throw new Error(`Unmocked: ${table}`);
  });

  ({ POST } = await import('../route'));
});

const makeRequest = (body: any) =>
  ({
    json: async () => body,
  }) as any;

const goodPackagingRow = (overrides: any = {}) => ({
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
  description: 'Paper bottle',
  row_confidence: 'high',
  ...overrides,
});

const goodIngredientRow = () => ({
  ...goodPackagingRow(),
  name: 'Organic Apples',
  product_type: 'ingredient',
  unit: 'kg',
  packaging_category: null,
  primary_material: null,
  epr_material_code: null,
  epr_is_drinks_container: null,
  weight_g: { value: null, confidence: 'low', source_quote: null },
  recycled_content_pct: { value: null, confidence: 'low', source_quote: null },
});

describe('POST /api/supplier-products/smart-import/confirm', () => {
  it('returns 401 when caller is not authenticated', async () => {
    const apiClient = await import('@/lib/supabase/api-client');
    (apiClient.getSupabaseAPIClient as any).mockImplementationOnce(async () => ({
      user: null,
      error: { message: 'no session' },
      client: { from: fromImpl } as any,
    }));
    const res = await POST(makeRequest({ jobId: 'j', supplierId: 's', products: [goodPackagingRow()] }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when jobId is missing', async () => {
    const res = await POST(makeRequest({ supplierId: 's', products: [goodPackagingRow()] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when supplierId is missing', async () => {
    const res = await POST(makeRequest({ jobId: 'j', products: [goodPackagingRow()] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when no products are selected', async () => {
    const res = await POST(makeRequest({ jobId: 'j', supplierId: 's', products: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when supplier does not exist', async () => {
    supplierLookup = null;
    const res = await POST(makeRequest({ jobId: 'j', supplierId: 'gone', products: [goodPackagingRow()] }));
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not the supplier owner and not an org member', async () => {
    supplierLookup = { ...mockSupplier, user_id: 'other' };
    isMember = false;
    const res = await POST(makeRequest({ jobId: 'j', supplierId: 'supplier-1', products: [goodPackagingRow()] }));
    expect(res.status).toBe(403);
  });

  it('rejects packaging row missing weight_g', async () => {
    const bad = goodPackagingRow({
      weight_g: { value: null, confidence: 'low', source_quote: null },
    });
    const res = await POST(makeRequest({ jobId: 'j', supplierId: 'supplier-1', products: [bad] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
    expect(body.issues.join(' ')).toMatch(/weight per unit/i);
  });

  it('rejects packaging row missing recycled_content_pct', async () => {
    const bad = goodPackagingRow({
      recycled_content_pct: { value: null, confidence: 'low', source_quote: null },
    });
    const res = await POST(makeRequest({ jobId: 'j', supplierId: 'supplier-1', products: [bad] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues.join(' ')).toMatch(/recycled content/i);
  });

  it('rejects packaging row with weight_g <= 0', async () => {
    const bad = goodPackagingRow({
      weight_g: { value: 0, confidence: 'high', source_quote: '0g' },
    });
    const res = await POST(makeRequest({ jobId: 'j', supplierId: 'supplier-1', products: [bad] }));
    expect(res.status).toBe(400);
  });

  it('rejects row with empty name', async () => {
    const bad = goodPackagingRow({ name: '   ' });
    const res = await POST(makeRequest({ jobId: 'j', supplierId: 'supplier-1', products: [bad] }));
    expect(res.status).toBe(400);
  });

  it('rejects packaging row with no packaging_category', async () => {
    const bad = goodPackagingRow({ packaging_category: null });
    const res = await POST(makeRequest({ jobId: 'j', supplierId: 'supplier-1', products: [bad] }));
    expect(res.status).toBe(400);
  });

  it('happy path: inserts a packaging row with correct fields and returns ids', async () => {
    const res = await POST(makeRequest({ jobId: 'j', supplierId: 'supplier-1', products: [goodPackagingRow()] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(1);
    expect(body.productIds).toEqual(['prod-1']);
    expect(insertedRows).toHaveLength(1);
    const row = insertedRows[0];
    expect(row.product_type).toBe('packaging');
    expect(row.packaging_category).toBe('container');
    expect(row.weight_g).toBe(82);
    expect(row.recycled_content_pct).toBe(94);
    expect(row.impact_climate).toBe(0.091);
    expect(row.carbon_intensity).toBe(0.091); // legacy mirror
    expect(row.is_active).toBe(true);
    expect(row.is_verified).toBe(false);
    expect(row.category).toBe('Packaging');
  });

  it('drops numeric values whose source_quote is empty (extra hallucination guard)', async () => {
    const fab = goodPackagingRow({
      // server-side guard: even if a numeric arrives without a quote, it
      // must not reach supplier_products as a fabricated value.
      impact_climate: { value: 999, confidence: 'high', source_quote: '   ' },
    });
    const res = await POST(makeRequest({ jobId: 'j', supplierId: 'supplier-1', products: [fab] }));
    expect(res.status).toBe(200);
    const row = insertedRows[0];
    expect(row.impact_climate).toBeNull();
    expect(row.carbon_intensity).toBeNull();
  });

  it('handles ingredient rows without imposing the packaging validators', async () => {
    const res = await POST(makeRequest({ jobId: 'j', supplierId: 'supplier-1', products: [goodIngredientRow()] }));
    expect(res.status).toBe(200);
    const row = insertedRows[0];
    expect(row.product_type).toBe('ingredient');
    expect(row.unit).toBe('kg');
    expect(row.packaging_category).toBeUndefined(); // not set for ingredients
    expect(row.category).toBeNull();
  });

  it('returns 500 when the bulk insert fails', async () => {
    insertError = { message: 'unique constraint violated', code: '23505' };
    const res = await POST(makeRequest({ jobId: 'j', supplierId: 'supplier-1', products: [goodPackagingRow()] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('unique constraint');
    expect(body.code).toBe('23505');
  });

  it('allows an org-member caller to confirm even when not the supplier owner', async () => {
    supplierLookup = { ...mockSupplier, user_id: 'other' };
    isMember = true;
    const res = await POST(makeRequest({ jobId: 'j', supplierId: 'supplier-1', products: [goodPackagingRow()] }));
    expect(res.status).toBe(200);
  });
});
