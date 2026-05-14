import { NextResponse } from 'next/server';
import { requireBrandMember } from '@/lib/distributor/integration/brand-auth';
import { syncBrandTier } from '@/lib/distributor/integration/linker';
import { syncAlkateraDataForBrand } from '@/lib/distributor/integration/alkatera-sync';

/**
 * PATCH /api/brand/distributors/[linkId]
 *   Body: { sharing_active?: boolean, confirmed?: boolean, deactivated_reason?: string }
 *
 *   - sharing_active: brand toggles whether their data flows to this distributor
 *   - confirmed: brand accepts a pending manual / fuzzy match
 *
 *   Each change re-runs the tier calculation for the linked
 *   brand_profile so the distributor sees the new tier immediately.
 *
 * DELETE /api/brand/distributors/[linkId]
 *   Brand-initiated full disconnect — removes the link row entirely.
 */
export async function PATCH(request: Request, { params }: { params: { linkId: string } }) {
  const auth = await requireBrandMember();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  let body: { sharing_active?: unknown; confirmed?: unknown; deactivated_reason?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.sharing_active === 'boolean') {
    update.sharing_active = body.sharing_active;
    if (!body.sharing_active) {
      update.deactivated_at = new Date().toISOString();
      if (typeof body.deactivated_reason === 'string') {
        update.deactivated_reason = body.deactivated_reason.slice(0, 200);
      }
    } else {
      update.deactivated_at = null;
      update.deactivated_reason = null;
    }
  }
  if (body.confirmed === true) {
    update.confirmed_by_brand = true;
    update.confirmed_at = new Date().toISOString();
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_fields_to_update' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('brand_distributor_links')
    .update(update)
    .eq('id', params.linkId)
    .eq('alkatera_org_id', auth.organization_id)
    .select('id, brand_profile_id, sharing_active, confirmed_by_brand')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let new_tier: number | undefined;
  try {
    new_tier = await syncBrandTier(
      auth.supabase,
      (data as { brand_profile_id: string }).brand_profile_id,
    );
  } catch {
    // best-effort
  }

  // If the brand just confirmed the link (or re-activated sharing),
  // sync their live alkatera data into the distributor's view straight
  // away — they shouldn't have to wait for tomorrow's cron.
  const linkRow = data as { sharing_active: boolean; confirmed_by_brand: boolean; brand_profile_id: string };
  if (linkRow.confirmed_by_brand && linkRow.sharing_active) {
    try {
      await syncAlkateraDataForBrand(auth.supabase, linkRow.brand_profile_id);
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({ link: data, new_tier });
}

export async function DELETE(_request: Request, { params }: { params: { linkId: string } }) {
  const auth = await requireBrandMember();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const { data: link } = await auth.supabase
    .from('brand_distributor_links')
    .select('id, brand_profile_id, alkatera_org_id')
    .eq('id', params.linkId)
    .eq('alkatera_org_id', auth.organization_id)
    .maybeSingle();
  if (!link) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await auth.supabase
    .from('brand_distributor_links')
    .delete()
    .eq('id', params.linkId)
    .eq('alkatera_org_id', auth.organization_id);

  // If this was the only link on the brand_profile, clear its alkatera_org_id.
  const { count: remaining } = await auth.supabase
    .from('brand_distributor_links')
    .select('id', { count: 'exact', head: true })
    .eq('brand_profile_id', (link as { brand_profile_id: string }).brand_profile_id);
  if (!remaining || remaining === 0) {
    await auth.supabase
      .from('brand_profiles')
      .update({ alkatera_org_id: null })
      .eq('id', (link as { brand_profile_id: string }).brand_profile_id);
  }

  let new_tier: number | undefined;
  try {
    new_tier = await syncBrandTier(
      auth.supabase,
      (link as { brand_profile_id: string }).brand_profile_id,
    );
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, new_tier });
}
