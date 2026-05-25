import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

/**
 * POST /api/admin/directory/brands/[id]/merge
 * Body: { dupe_id: string }
 *
 * Folds `dupe_id` into the brand referenced by the URL (the canonical).
 * Calls the merge_brand_directory_dupe RPC which moves every FK and
 * deletes the dupe row. Used by the admin "Fold duplicate in" button
 * on /admin/directory/brands/[id].
 */
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  let body: { dupe_id?: unknown };
  try {
    body = (await request.json()) as { dupe_id?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const dupeId =
    typeof body.dupe_id === 'string' && body.dupe_id.length > 0 ? body.dupe_id : null;
  if (!dupeId) {
    return NextResponse.json(
      { error: 'invalid_payload', detail: '`dupe_id` required.' },
      { status: 400 },
    );
  }
  if (dupeId === params.id) {
    return NextResponse.json(
      { error: 'invalid_payload', detail: 'Canonical and duplicate must differ.' },
      { status: 400 },
    );
  }

  const { error } = await auth.service.rpc('merge_brand_directory_dupe', {
    p_canonical_id: params.id,
    p_dupe_id: dupeId,
  });
  if (error) {
    return NextResponse.json(
      { error: 'merge_failed', detail: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
