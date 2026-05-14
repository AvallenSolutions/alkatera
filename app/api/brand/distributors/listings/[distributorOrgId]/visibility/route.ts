import { NextResponse } from 'next/server';
import { requireBrandMember } from '@/lib/distributor/integration/brand-auth';

const SENTINEL_FIELD_KEY = '__all__';

/**
 * POST /api/brand/distributors/listings/[distributorOrgId]/visibility
 *
 * Body: { blocked: boolean }
 *
 * Sets a blanket "block all fields from this distributor" preference
 * for the calling brand. When blocked=true we upsert a
 * brand_sharing_preferences row keyed on the sentinel
 * field_key='__all__' with block_all_fields=true; when blocked=false
 * we delete that row. The get_brand_data_for_distributor RPC honours
 * the wildcard so the distributor immediately stops seeing
 * brand-verified + alkatera-live data (scraped data still visible).
 *
 * Per-field preferences (managed elsewhere via the preferences route)
 * are untouched — toggling the blanket block ON and back OFF preserves
 * any field-level customisation the brand had set up.
 */
export async function POST(
  request: Request,
  { params }: { params: { distributorOrgId: string } },
) {
  const auth = await requireBrandMember();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  let body: { blocked?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (typeof body.blocked !== 'boolean') {
    return NextResponse.json({ error: 'blocked_boolean_required' }, { status: 400 });
  }
  const distributorOrgId = params.distributorOrgId;
  if (!distributorOrgId || distributorOrgId.length < 8) {
    return NextResponse.json({ error: 'invalid_distributor_org_id' }, { status: 400 });
  }

  if (body.blocked) {
    const { error } = await auth.supabase
      .from('brand_sharing_preferences')
      .upsert(
        {
          alkatera_org_id: auth.organization_id,
          distributor_org_id: distributorOrgId,
          field_key: SENTINEL_FIELD_KEY,
          sharing_enabled: false,
          block_all_fields: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'alkatera_org_id,distributor_org_id,field_key' },
      );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await auth.supabase
      .from('brand_sharing_preferences')
      .delete()
      .eq('alkatera_org_id', auth.organization_id)
      .eq('distributor_org_id', distributorOrgId)
      .eq('field_key', SENTINEL_FIELD_KEY);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, blocked: body.blocked });
}
