import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';

/**
 * GET /api/distributor/documents/conflicts
 * Optional query: ?brand_profile_id=...
 *
 * Returns every unresolved conflict (resolution IS NULL) for brands in
 * the caller's distributor org, joined with the brand name and the
 * originating submission. Used by the conflicts table on each brand's
 * detail page.
 */
export async function GET(request: Request) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const url = new URL(request.url);
  const brandProfileId = url.searchParams.get('brand_profile_id');

  // Get brand ids in this distributor org first so we can scope by IN().
  const { data: brands } = await auth.supabase
    .from('brand_profiles')
    .select('id, name')
    .eq('distributor_org_id', auth.organization.id);
  const brandIds = (brands ?? []).map((b: { id: string }) => b.id);
  const brandNameById = new Map(
    (brands ?? []).map((b: { id: string; name: string }) => [b.id, b.name]),
  );
  if (brandIds.length === 0) {
    return NextResponse.json({ conflicts: [] });
  }

  let query = auth.supabase
    .from('brand_data_conflicts')
    .select(
      'id, brand_profile_id, field_key, existing_value, existing_source, existing_confidence, new_value, new_source, new_confidence, submission_id, created_at',
    )
    .in('brand_profile_id', brandIds)
    .is('resolution', null)
    .order('created_at', { ascending: false });
  if (brandProfileId) {
    query = query.eq('brand_profile_id', brandProfileId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const conflicts = (data ?? []).map((c: { brand_profile_id: string }) => ({
    ...c,
    brand_name: brandNameById.get(c.brand_profile_id) ?? null,
  }));

  return NextResponse.json({ conflicts });
}
