import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { findBrands, type SourcingFilters } from '@/lib/admin/sourcing/find-brands';
import { processBulkBrands } from '@/lib/admin/directory/process-bulk-brands';
import { processBulkProducts } from '@/lib/admin/directory/process-bulk-products';
import {
  BRAND_FIELDS,
  PRODUCT_FIELDS,
  type BrandFieldKey,
  type ProductFieldKey,
} from '@/lib/admin/directory/field-specs';

/**
 * POST /api/admin/directory/sourcing
 * Body: { category?, country?, certifications?, keywords?, query?, limit? }
 *
 * Admin-driven brand sourcing. Uses Claude + web search to find real
 * drinks brands matching the filters (or a specific brand for a manual
 * query), then ingests them into the directory as `pending` — they
 * land in the review queue, never live until an admin verifies them.
 *
 * Returns what was found + how it landed (created vs linked).
 */
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  let body: SourcingFilters;
  try {
    body = (await request.json()) as SourcingFilters;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const hasCriteria =
    !!body.query?.trim() ||
    !!body.category ||
    !!body.country ||
    (Array.isArray(body.certifications) && body.certifications.length > 0) ||
    !!body.keywords?.trim();
  if (!hasCriteria) {
    return NextResponse.json(
      { error: 'no_criteria', detail: 'Provide a search query or at least one filter.' },
      { status: 400 },
    );
  }

  // 1. Search the web for matching brands.
  const found = await findBrands(body);
  if (found.error) {
    return NextResponse.json(
      { error: 'sourcing_failed', detail: found.error },
      { status: 502 },
    );
  }
  if (found.brands.length === 0) {
    return NextResponse.json({
      ok: true,
      summary: found.summary ?? 'No matching brands found.',
      found_brands: 0,
      brands: { created: 0, linked: 0, errors: [] },
      products: { created: 0, linked: 0, errors: [] },
    });
  }

  // 2. Ingest as pending. Reuse the bulk processors with an identity
  //    column mapping (the sourced objects are already keyed by field
  //    name). Brands first so products can match.
  const brandMapping = identityMapping(BRAND_FIELDS.map((f) => f.key)) as Partial<
    Record<BrandFieldKey, string>
  >;
  const productMapping = identityMapping(PRODUCT_FIELDS.map((f) => f.key)) as Partial<
    Record<ProductFieldKey, string>
  >;

  const brandResult = await processBulkBrands({
    service: auth.service,
    rows: found.brands.map(stringifyValues),
    mapping: brandMapping,
  });

  const productResult =
    found.products.length > 0
      ? await processBulkProducts({
          service: auth.service,
          rows: found.products.map(stringifyValues),
          mapping: productMapping,
        })
      : { rows_processed: 0, products_created: 0, products_linked: 0, errors: [] };

  return NextResponse.json({
    ok: true,
    summary: found.summary,
    found_brands: found.brands.length,
    brand_names: found.brands.map((b) => b.name),
    brands: {
      created: brandResult.brands_created,
      linked: brandResult.brands_linked,
      errors: brandResult.errors,
    },
    products: {
      created: productResult.products_created,
      linked: productResult.products_linked,
      errors: productResult.errors,
    },
  });
}

function identityMapping(keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = k;
  return out;
}

function stringifyValues(row: object): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) continue;
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}
