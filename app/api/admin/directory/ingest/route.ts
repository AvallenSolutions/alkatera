import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { safeCompare } from '@/lib/utils/safe-compare';
import { processBulkBrands } from '@/lib/admin/directory/process-bulk-brands';
import { processBulkProducts } from '@/lib/admin/directory/process-bulk-products';
import {
  BRAND_FIELDS,
  PRODUCT_FIELDS,
  type BrandFieldKey,
  type ProductFieldKey,
} from '@/lib/admin/directory/field-specs';

/**
 * POST /api/admin/directory/ingest
 *
 * Hands-free directory ingestion for automated jobs (e.g. a Claude
 * Cowork schedule). Accepts JSON keyed directly by the directory field
 * names — no file upload, no column mapping:
 *
 *   {
 *     "brands":   [{ "name": "Hayman's Gin", "website": "...", ... }],
 *     "products": [{ "brand_name": "Hayman's Gin", "product_name": "...", "gtin": "..." }]
 *   }
 *
 * Brands are processed first so products can match against them.
 * Idempotent: existing brands/products are linked, not duplicated, and
 * only blank columns are filled. Returns created/linked counts + the
 * skipped-row reasons.
 *
 * Auth — either:
 *   - an alka**tera** admin session (cookie), for manual testing, OR
 *   - `Authorization: Bearer $DIRECTORY_INGEST_TOKEN` (falls back to
 *     $CRON_SECRET) for unattended schedules.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_ROWS = 5000;

// Next.js patches global fetch and, on this route pattern (the token auth
// path never touches next/headers, so nothing auto-triggers dynamic mode),
// would otherwise cache these outbound Supabase requests across invocations
// — the "existing brands/products" reads would keep returning the first
// response they ever saw and break idempotency. no-store on every call is
// what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

// Rows are keyed directly by directory field names; unknown keys are
// ignored downstream by the processors, so each row is a permissive
// record. Values get coerced to strings via stringifyValues().
const IngestSchema = z.object({
  brands: z.array(z.record(z.unknown())).optional(),
  products: z.array(z.record(z.unknown())).optional(),
});

export async function POST(request: Request) {
  const service = await resolveServiceClient(request);
  if (!service) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = IngestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_json', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const brands = Array.isArray(body.brands) ? body.brands : [];
  const products = Array.isArray(body.products) ? body.products : [];
  if (brands.length === 0 && products.length === 0) {
    return NextResponse.json(
      { error: 'empty_payload', detail: 'Provide a non-empty "brands" and/or "products" array.' },
      { status: 400 },
    );
  }
  if (brands.length > MAX_ROWS || products.length > MAX_ROWS) {
    return NextResponse.json(
      { error: 'too_many_rows', detail: `Max ${MAX_ROWS} rows per array per call.` },
      { status: 413 },
    );
  }

  // Identity column mapping: the JSON keys ARE the field names, so map
  // each known field-spec key to itself. Unknown keys in the payload
  // are simply ignored by the processors.
  const brandMapping = identityMapping(BRAND_FIELDS.map((f) => f.key)) as Partial<
    Record<BrandFieldKey, string>
  >;
  const productMapping = identityMapping(PRODUCT_FIELDS.map((f) => f.key)) as Partial<
    Record<ProductFieldKey, string>
  >;

  // Brands first so the products step can resolve brand_name matches.
  const brandResult =
    brands.length > 0
      ? await processBulkBrands({
          service,
          rows: brands.map(stringifyValues),
          mapping: brandMapping,
        })
      : { rows_processed: 0, brands_created: 0, brands_linked: 0, errors: [] };

  const productResult =
    products.length > 0
      ? await processBulkProducts({
          service,
          rows: products.map(stringifyValues),
          mapping: productMapping,
        })
      : { rows_processed: 0, products_created: 0, products_linked: 0, errors: [] };

  return NextResponse.json({
    ok: true,
    brands: {
      processed: brandResult.rows_processed,
      created: brandResult.brands_created,
      linked: brandResult.brands_linked,
      errors: brandResult.errors,
    },
    products: {
      processed: productResult.rows_processed,
      created: productResult.products_created,
      linked: productResult.products_linked,
      errors: productResult.errors,
    },
    generated_at: new Date().toISOString(),
  });
}

/**
 * Returns a service-role client if the caller is authenticated either
 * as an alka**tera** admin (cookie session) or via the ingest bearer
 * token. Returns null if neither.
 */
async function resolveServiceClient(request: Request): Promise<SupabaseClient | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: noStoreFetch },
  });

  // Token path (unattended automation).
  const token = process.env.DIRECTORY_INGEST_TOKEN || process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (token && authHeader && safeCompare(authHeader, `Bearer ${token}`)) {
    return service;
  }

  // Session path (manual / admin testing).
  try {
    const userClient = getSupabaseServerClient() as unknown as SupabaseClient;
    const { data } = await userClient.auth.getUser();
    if (data.user) {
      const { data: isAdmin } = await userClient.rpc('is_alkatera_admin');
      if (isAdmin) return service;
    }
  } catch {
    /* fall through to unauthorized */
  }
  return null;
}

function identityMapping(keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = k;
  return out;
}

/**
 * Coerce all values of an arbitrary object to strings. JSON payloads
 * carry numbers (founding_year, abv) and the CSV-oriented processors
 * expect string cells, so we normalise here.
 */
function stringifyValues(row: unknown): Record<string, string> {
  if (!row || typeof row !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}
