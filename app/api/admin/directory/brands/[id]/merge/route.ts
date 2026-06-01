import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

const MergeSchema = z.object({
  dupe_id: z.string().min(1),
});

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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = MergeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', detail: '`dupe_id` required.' },
      { status: 400 },
    );
  }
  const dupeId = parsed.data.dupe_id;
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
