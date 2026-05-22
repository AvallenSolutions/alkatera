import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

/**
 * PATCH /api/admin/directory/brands/[id]/verification
 * Body: { status: 'verified' | 'rejected' | 'pending', reason?: string }
 *
 * Admin moderation of a directory brand. Verifying a brand cascades to
 * its products (the brand is the unit of trust — see the locked policy).
 * Rejecting hides it from Discover with an optional reason. Setting back
 * to pending re-queues it.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  let body: { status?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const status = body.status;
  if (status !== 'verified' && status !== 'rejected' && status !== 'pending') {
    return NextResponse.json(
      { error: 'invalid_status', detail: "status must be 'verified', 'rejected' or 'pending'" },
      { status: 400 },
    );
  }
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;

  const now = new Date().toISOString();
  const brandPatch: Record<string, unknown> = {
    verification_status: status,
    updated_at: now,
    rejection_reason: status === 'rejected' ? reason : null,
    verified_at: status === 'verified' ? now : null,
    verified_by: status === 'verified' ? auth.user.id : null,
  };

  const { error: brandError } = await auth.service
    .from('brand_directory')
    .update(brandPatch)
    .eq('id', params.id);
  if (brandError) {
    return NextResponse.json({ error: brandError.message }, { status: 500 });
  }

  // Cascade to products. Verifying the brand verifies its still-pending
  // products; rejecting/pending pulls them back too so a rejected brand
  // never leaves verified products dangling in Discover.
  let productsCascaded = 0;
  if (status === 'verified') {
    const { data } = await auth.service
      .from('product_directory')
      .update({ verification_status: 'verified', verified_at: now, verified_by: auth.user.id })
      .eq('brand_directory_id', params.id)
      .eq('verification_status', 'pending')
      .select('id');
    productsCascaded = (data as Array<{ id: string }> | null)?.length ?? 0;
  } else if (status === 'rejected' || status === 'pending') {
    const { data } = await auth.service
      .from('product_directory')
      .update({ verification_status: status, verified_at: null, verified_by: null })
      .eq('brand_directory_id', params.id)
      .eq('verification_status', 'verified')
      .select('id');
    productsCascaded = (data as Array<{ id: string }> | null)?.length ?? 0;
  }

  return NextResponse.json({
    id: params.id,
    verification_status: status,
    products_cascaded: productsCascaded,
  });
}
