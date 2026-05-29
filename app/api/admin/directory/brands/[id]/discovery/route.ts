import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

const DiscoveryPatchSchema = z.object({
  discovery_opt_out: z.boolean(),
});

/**
 * PATCH /api/admin/directory/brands/[id]/discovery
 * Body: { discovery_opt_out: boolean }
 *
 * Admin override for brand_directory.discovery_opt_out. Distinct from
 * the brand-side toggle at /api/brand-directory/[id]/discovery (which
 * requires alka**tera** org membership) — this one only requires
 * admin status, so staff can suppress placeholder / spammy entries.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = DiscoveryPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const body = parsed.data;

  const { error } = await auth.service
    .from('brand_directory')
    .update({
      discovery_opt_out: body.discovery_opt_out,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: params.id, discovery_opt_out: body.discovery_opt_out });
}
