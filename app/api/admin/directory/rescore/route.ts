import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { recalculateCompleteness } from '@/lib/distributor/scoring/recalculate';

/**
 * POST /api/admin/directory/rescore
 *
 * Re-runs recalculateCompleteness across every brand_directory row.
 * Used after a scoring-model change (e.g. two-tier rollout) so the
 * persisted sustainability_score + scoring_mode reflects the latest
 * code without waiting for organic recompute triggers to fire.
 *
 * Capped at a reasonable batch to keep the synchronous response under
 * Netlify's ceiling. Returns counts so the admin sees what happened.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH_LIMIT = 500;

export async function POST(_request: Request) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  const { data: rows } = await auth.service
    .from('brand_directory')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(BATCH_LIMIT);
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

  return NextResponse.json({
    ok: true,
    scanned: ids.length,
    updated,
    error_count: errors.length,
    errors: errors.slice(0, 10),
    cap: BATCH_LIMIT,
  });
}
