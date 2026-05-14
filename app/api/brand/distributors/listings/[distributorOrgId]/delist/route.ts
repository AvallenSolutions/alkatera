import { NextResponse } from 'next/server';
import { requireBrandMember } from '@/lib/distributor/integration/brand-auth';

/**
 * POST /api/brand/distributors/listings/[distributorOrgId]/delist
 *
 * Body: { delisted: boolean }
 *
 * Sets brand_profiles.listing_status to 'delisted' or 'active' for the
 * specified distributor's listing of this brand. The action is
 * scope-checked: only the brand whose alka**tera** org maps to the
 * directory entry can flip the listing's status. Distributor-side
 * brand list views filter out delisted listings by default.
 *
 * Data is preserved either way — delisting doesn't remove the brand
 * from the canonical directory or affect any other distributor that
 * lists the brand.
 */
export async function POST(
  request: Request,
  { params }: { params: { distributorOrgId: string } },
) {
  const auth = await requireBrandMember();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  let body: { delisted?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (typeof body.delisted !== 'boolean') {
    return NextResponse.json({ error: 'delisted_boolean_required' }, { status: 400 });
  }
  const distributorOrgId = params.distributorOrgId;
  if (!distributorOrgId || distributorOrgId.length < 8) {
    return NextResponse.json({ error: 'invalid_distributor_org_id' }, { status: 400 });
  }

  // Resolve the brand's directory entry. Only the linked alkatera org
  // can mutate listings under it.
  const { data: directory } = await auth.supabase
    .from('brand_directory')
    .select('id')
    .eq('alkatera_org_id', auth.organization_id)
    .maybeSingle();
  if (!directory) {
    return NextResponse.json({ error: 'no_directory_entry' }, { status: 404 });
  }
  const directoryId = (directory as { id: string }).id;

  const { data: updated, error } = await auth.supabase
    .from('brand_profiles')
    .update({ listing_status: body.delisted ? 'delisted' : 'active', updated_at: new Date().toISOString() })
    .eq('brand_directory_id', directoryId)
    .eq('distributor_org_id', distributorOrgId)
    .select('id, listing_status')
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: 'listing_not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    brand_profile_id: (updated as { id: string }).id,
    listing_status: (updated as { listing_status: 'active' | 'delisted' }).listing_status,
  });
}
