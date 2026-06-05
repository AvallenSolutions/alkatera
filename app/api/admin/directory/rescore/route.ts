import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { recalculateCompleteness } from '@/lib/distributor/scoring/recalculate';

/**
 * POST /api/admin/directory/rescore
 *
 * Re-runs recalculateCompleteness across the brand_directory. Used after
 * a scoring-model change so persisted scores / category / country reflect
 * the latest code without waiting for organic recompute triggers.
 *
 * Processes ONE SMALL BATCH per request and returns a cursor — the client
 * (RescoreAllButton) loops until `done`. Doing the whole directory in a
 * single synchronous request blew past Netlify's ~26s function ceiling
 * (recalc does several DB round-trips, and the occasional LLM category
 * fallback, per brand) and returned an HTML 504 page instead of JSON.
 *
 * Pagination orders by `id` (immutable) rather than `updated_at` — recalc
 * writes score_updated_at on every row, so an updated_at order would
 * reshuffle the set mid-walk and skip/repeat brands.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const DEFAULT_BATCH = 8;
const MAX_BATCH = 25;

export async function POST(request: Request) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  let offset = 0;
  let limit = DEFAULT_BATCH;
  try {
    const body = (await request.json()) as { offset?: unknown; limit?: unknown };
    if (typeof body?.offset === 'number' && Number.isFinite(body.offset)) {
      offset = Math.max(0, Math.floor(body.offset));
    }
    if (typeof body?.limit === 'number' && Number.isFinite(body.limit)) {
      limit = Math.min(MAX_BATCH, Math.max(1, Math.floor(body.limit)));
    }
  } catch {
    // No/invalid body → defaults (first call).
  }

  const { count } = await auth.service
    .from('brand_directory')
    .select('id', { count: 'exact', head: true });
  const total = count ?? 0;

  const { data: rows } = await auth.service
    .from('brand_directory')
    .select('id')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);
  const ids = ((rows ?? []) as Array<{ id: string }>).map((r) => r.id);

  let updated = 0;
  const errors: Array<{ id: string; error: string }> = [];
  for (const id of ids) {
    try {
      const result = await recalculateCompleteness(auth.service, id);
      if (result) updated += 1;
    } catch (err: unknown) {
      errors.push({ id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const nextOffset = offset + ids.length;
  return NextResponse.json({
    ok: true,
    total,
    offset,
    processed: ids.length,
    updated,
    next_offset: nextOffset,
    done: ids.length === 0 || nextOffset >= total,
    error_count: errors.length,
    errors: errors.slice(0, 10),
  });
}
