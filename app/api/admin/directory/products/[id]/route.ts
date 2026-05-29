import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { recalculateCompleteness } from '@/lib/distributor/scoring/recalculate';

// Shape-only schema: the handler does its own coercion + range checks
// per field below. This rejects non-object bodies and unknown keys
// (mass-assignment guard); numeric fields accept string or number
// because the handler parses both.
const ProductPatchSchema = z
  .object({
    name: z.string(),
    gtin: z.union([z.string(), z.number()]).nullable(),
    category: z.string().nullable(),
    abv: z.union([z.string(), z.number()]).nullable(),
    container_size_ml: z.union([z.string(), z.number()]).nullable(),
    container_format: z.string().nullable(),
    recipe_overview: z.string().nullable(),
  })
  .partial()
  .strict();

/**
 * Admin edit + delete for a directory product.
 *
 * PATCH /api/admin/directory/products/[id]
 *   Body: { name?, gtin?, category?, abv?, container_size_ml?,
 *           container_format?, recipe_overview? }
 *   Returns: updated row
 *
 * DELETE /api/admin/directory/products/[id]
 *   Refuses (409) if any brand_skus rows reference the product — those
 *   are per-distributor listings that need manual reassignment first.
 *   Otherwise deletes the row; ON DELETE CASCADE on scraped_brand_data,
 *   brand_awards, brand_completeness_snapshots takes care of children.
 *   brand_document_submissions.product_directory_ids is a uuid[] (not
 *   FK), so we strip the deleted id out of any submissions referencing
 *   it. Triggers recalculateCompleteness on the parent brand so its
 *   score reflects the change immediately.
 */
export const runtime = 'nodejs';

const VALID_CATEGORY = new Set(['spirits', 'wine', 'beer', 'non_alc', 'other']);
const VALID_FORMAT = new Set(['bottle', 'can', 'keg', 'bag_in_box', 'other']);

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsedBody = ProductPatchSchema.safeParse(raw);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'invalid_body', details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsedBody.data;

  const patch: Record<string, unknown> = {};
  const reject = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });

  if ('name' in body) {
    const n = typeof body.name === 'string' ? body.name.trim() : '';
    if (!n) return reject('name_required');
    if (n.length > 200) return reject('name_too_long');
    patch.name = n;
  }
  if ('gtin' in body) {
    const g = body.gtin == null ? null : typeof body.gtin === 'string' ? body.gtin.trim() : null;
    if (g != null && !/^\d{8,14}$/.test(g)) return reject('gtin_must_be_8_to_14_digits');
    patch.gtin = g;
  }
  if ('category' in body) {
    const c = typeof body.category === 'string' ? body.category : null;
    if (c != null && !VALID_CATEGORY.has(c)) return reject('invalid_category');
    patch.category = c;
  }
  if ('abv' in body) {
    const v = body.abv;
    if (v == null || v === '') {
      patch.abv = null;
    } else {
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      if (!Number.isFinite(n) || n < 0 || n > 100) return reject('abv_out_of_range');
      patch.abv = n;
    }
  }
  if ('container_size_ml' in body) {
    const v = body.container_size_ml;
    if (v == null || v === '') {
      patch.container_size_ml = null;
    } else {
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      if (!Number.isFinite(n) || n <= 0 || n > 100_000) return reject('container_size_invalid');
      patch.container_size_ml = Math.round(n);
    }
  }
  if ('container_format' in body) {
    const c = typeof body.container_format === 'string' ? body.container_format : null;
    if (c != null && !VALID_FORMAT.has(c)) return reject('invalid_container_format');
    patch.container_format = c;
  }
  if ('recipe_overview' in body) {
    const r = body.recipe_overview == null ? null : typeof body.recipe_overview === 'string' ? body.recipe_overview.trim() : null;
    if (r != null && r.length > 4000) return reject('recipe_overview_too_long');
    patch.recipe_overview = r;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_fields_to_update' }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await auth.service
    .from('product_directory')
    .update(patch)
    .eq('id', params.id)
    .select('id, name, gtin, category, abv, container_size_ml, container_format, recipe_overview')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'product_not_found' }, { status: 404 });

  return NextResponse.json({ ok: true, product: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  // Load the product first so we know its brand for the post-delete
  // recalc and so we can return a useful 404 vs. silent success.
  const { data: product } = await auth.service
    .from('product_directory')
    .select('id, name, brand_directory_id')
    .eq('id', params.id)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
  }
  const brandDirectoryId = (product as { brand_directory_id: string }).brand_directory_id;

  // Check for brand_skus referencing this product. brand_skus FK has
  // ON DELETE RESTRICT — Postgres would block the delete anyway, but
  // a pre-flight check produces a much clearer error message naming
  // the distributors involved.
  const { data: skus } = await auth.service
    .from('brand_skus')
    .select('id, brand_profile_id')
    .eq('product_directory_id', params.id);
  const linkedSkus = (skus ?? []) as Array<{ id: string; brand_profile_id: string }>;
  if (linkedSkus.length > 0) {
    return NextResponse.json(
      {
        error: 'product_has_linked_skus',
        detail: `This product is referenced by ${linkedSkus.length} brand SKU listing${
          linkedSkus.length === 1 ? '' : 's'
        }. Reassign or remove those listings first, then delete the product.`,
        linked_count: linkedSkus.length,
      },
      { status: 409 },
    );
  }

  // Strip the deleted id from any brand_document_submissions that
  // referenced it (uuid[] column, not an FK — no cascade for us).
  const { data: subs } = await auth.service
    .from('brand_document_submissions')
    .select('id, product_directory_ids')
    .contains('product_directory_ids', [params.id]);
  for (const sub of (subs ?? []) as Array<{ id: string; product_directory_ids: string[] }>) {
    const next = sub.product_directory_ids.filter((id) => id !== params.id);
    await auth.service
      .from('brand_document_submissions')
      .update({ product_directory_ids: next })
      .eq('id', sub.id);
  }

  const { error: deleteError } = await auth.service
    .from('product_directory')
    .delete()
    .eq('id', params.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Refresh the parent brand's completeness/vitality so the score
  // panel updates without waiting for the next deep-enrich.
  try {
    await recalculateCompleteness(auth.service, brandDirectoryId);
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, deleted_id: params.id });
}
