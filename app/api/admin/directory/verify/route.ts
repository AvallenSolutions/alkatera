import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

/**
 * POST /api/admin/directory/verify
 * Body: { brand_ids: string[], status: 'verified' | 'rejected' }
 *
 * Bulk moderation for the review queue — verify or reject many brands
 * in one call. Verifying cascades to each brand's pending products.
 * Capped at 500 ids per call.
 */
const MAX_IDS = 500;

export async function POST(request: Request) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  let body: { brand_ids?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const ids = Array.isArray(body.brand_ids)
    ? body.brand_ids.filter((x): x is string => typeof x === 'string')
    : [];
  const status = body.status;
  if (status !== 'verified' && status !== 'rejected') {
    return NextResponse.json(
      { error: 'invalid_status', detail: "status must be 'verified' or 'rejected'" },
      { status: 400 },
    );
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: 'no_ids' }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { error: 'too_many_ids', detail: `Max ${MAX_IDS} brands per call.` },
      { status: 413 },
    );
  }

  const now = new Date().toISOString();
  const { data: updatedBrands, error } = await auth.service
    .from('brand_directory')
    .update({
      verification_status: status,
      verified_at: status === 'verified' ? now : null,
      verified_by: status === 'verified' ? auth.user.id : null,
      updated_at: now,
    })
    .in('id', ids)
    .select('id');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const brandsUpdated = (updatedBrands as Array<{ id: string }> | null)?.length ?? 0;

  // Cascade to products.
  let productsCascaded = 0;
  if (status === 'verified') {
    const { data } = await auth.service
      .from('product_directory')
      .update({ verification_status: 'verified', verified_at: now, verified_by: auth.user.id })
      .in('brand_directory_id', ids)
      .eq('verification_status', 'pending')
      .select('id');
    productsCascaded = (data as Array<{ id: string }> | null)?.length ?? 0;
  } else {
    const { data } = await auth.service
      .from('product_directory')
      .update({ verification_status: 'rejected', verified_at: null, verified_by: null })
      .in('brand_directory_id', ids)
      .eq('verification_status', 'verified')
      .select('id');
    productsCascaded = (data as Array<{ id: string }> | null)?.length ?? 0;
  }

  return NextResponse.json({
    status,
    brands_updated: brandsUpdated,
    products_cascaded: productsCascaded,
  });
}
