import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';

/**
 * PATCH  /api/distributor/brands/[id]/products/[skuId]
 * DELETE /api/distributor/brands/[id]/products/[skuId]
 *
 * Edit or remove a single product (brand_sku) under a brand. Scoped to the
 * caller's org AND the brand, so a member can only touch their own SKUs.
 * Owner / data_manager only.
 */

function optionalText(value: unknown, max = 200): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === '') return { ok: true, value: null };
  if (typeof value === 'string') return { ok: true, value: value.trim().slice(0, max) || null };
  return { ok: false };
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; skuId: string } },
) {
  const auth = await requireDistributor();
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status });
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if ('product_name' in body) {
    if (typeof body.product_name !== 'string' || !body.product_name.trim()) {
      return NextResponse.json({ error: 'invalid_product_name' }, { status: 400 });
    }
    update.product_name = body.product_name.trim().slice(0, 300);
  }
  for (const field of ['sku_code', 'gtin', 'category', 'country_of_origin'] as const) {
    if (field in body) {
      const res = optionalText(body[field]);
      if (!res.ok) return NextResponse.json({ error: `invalid_${field}` }, { status: 400 });
      update[field] = res.value;
    }
  }
  if ('listing_status' in body) {
    if (body.listing_status !== 'active' && body.listing_status !== 'delisted') {
      return NextResponse.json({ error: 'invalid_listing_status' }, { status: 400 });
    }
    update.listing_status = body.listing_status;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_fields_to_update' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('brand_skus')
    .update(update)
    .eq('id', params.skuId)
    .eq('brand_profile_id', params.id)
    .eq('distributor_org_id', auth.organization.id)
    .select('id, product_name, sku_code, gtin, category, country_of_origin, listing_status')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ sku: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; skuId: string } },
) {
  const auth = await requireDistributor();
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status });
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { error, count } = await auth.supabase
    .from('brand_skus')
    .delete({ count: 'exact' })
    .eq('id', params.skuId)
    .eq('brand_profile_id', params.id)
    .eq('distributor_org_id', auth.organization.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
