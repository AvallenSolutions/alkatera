import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { sweepProductDupes, type DupeGroup, type ProductRow } from '@/lib/admin/sourcing/product-dedup-sweep';

/**
 * POST /api/admin/directory/brands/[id]/dedup-products
 *
 * Sweeps product_directory for the given brand, asks Claude Sonnet
 * to group duplicate SKUs, then auto-merges every high-confidence
 * group (≥0.85) via merge_product_directory_dupe. Lower-confidence
 * groups (0.6–0.85) are returned to the caller for manual review.
 *
 * Auto-merge threshold is intentionally conservative — a wrong merge
 * deletes one of two real SKUs, which is hard to recover from.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const AUTO_MERGE_THRESHOLD = 0.85;
const REVIEW_THRESHOLD = 0.6;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  const { data: brand } = await auth.service
    .from('brand_directory')
    .select('id, name')
    .eq('id', params.id)
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const directory = brand as { id: string; name: string };

  const { data: products } = await auth.service
    .from('product_directory')
    .select('id, name, gtin, category, abv, container_size_ml, container_format')
    .eq('brand_directory_id', directory.id)
    .order('name');
  const productRows = ((products ?? []) as ProductRow[]);
  if (productRows.length < 2) {
    return NextResponse.json({
      ok: true,
      summary: 'Brand has fewer than 2 products — nothing to dedup.',
      merged_groups: [],
      review_groups: [],
      total_products: productRows.length,
    });
  }

  const sweep = await sweepProductDupes(directory.name, productRows);
  if (sweep.error && sweep.groups.length === 0) {
    return NextResponse.json(
      { error: 'sweep_failed', detail: sweep.error },
      { status: 502 },
    );
  }

  const merged: Array<DupeGroup & { merged_count: number; errors: string[] }> = [];
  const review: DupeGroup[] = [];

  for (const group of sweep.groups) {
    if (group.confidence >= AUTO_MERGE_THRESHOLD) {
      const errors = await applyGroupMerge(auth.service, group);
      merged.push({
        ...group,
        merged_count: group.duplicate_ids.length - errors.length,
        errors,
      });
    } else if (group.confidence >= REVIEW_THRESHOLD) {
      review.push(group);
    }
    // <0.6 groups are dropped: false-positive risk too high to bother.
  }

  return NextResponse.json({
    ok: true,
    summary: sweep.summary ?? null,
    merged_groups: merged,
    review_groups: review,
    total_products: productRows.length,
  });
}

/**
 * Merge every duplicate in a group into the canonical. Returns the
 * subset of duplicate_ids that failed to merge (e.g. SQL error).
 */
async function applyGroupMerge(
  service: SupabaseClient,
  group: DupeGroup,
): Promise<string[]> {
  const failures: string[] = [];
  for (const dupeId of group.duplicate_ids) {
    const { error } = await service.rpc('merge_product_directory_dupe', {
      p_canonical_id: group.canonical_id,
      p_dupe_id: dupeId,
    });
    if (error) failures.push(dupeId);
  }
  return failures;
}
