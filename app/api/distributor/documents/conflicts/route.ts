import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';

/**
 * GET /api/distributor/documents/conflicts
 * Optional query: ?brand_profile_id=...
 *
 * Returns every unresolved conflict (resolution IS NULL) for brands in
 * the caller's distributor org, joined with the brand name. Used by the
 * conflicts table on each brand's detail page.
 *
 * Phase 3: conflicts hang off brand_directory_id. We resolve the
 * caller's listings to their canonical directory ids, then query the
 * conflict table by directory id. Distributors continue to see
 * conflicts only for brands in their own portfolio (via the listing
 * filter); the brand_profile_id query param scopes further when present.
 */
export async function GET(request: Request) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const url = new URL(request.url);
  const brandProfileId = url.searchParams.get('brand_profile_id');

  // Get every brand listing in this distributor org so we can scope by
  // the set of directory entries they cover.
  const { data: brands } = await auth.supabase
    .from('brand_profiles')
    .select('id, brand_directory_id, name')
    .eq('distributor_org_id', auth.organization.id);
  const brandList = (brands ?? []) as Array<{ id: string; brand_directory_id: string; name: string }>;
  if (brandList.length === 0) {
    return NextResponse.json({ conflicts: [] });
  }

  // Map directory id → display name (from the listing). When two
  // listings collapse onto the same directory, pick the first
  // alphabetically — only matters for cross-portfolio dedup, which
  // doesn't happen until Phase 4.
  const nameByDirectory = new Map<string, string>();
  for (const b of brandList) {
    if (!nameByDirectory.has(b.brand_directory_id)) {
      nameByDirectory.set(b.brand_directory_id, b.name);
    }
  }
  let directoryIds = Array.from(nameByDirectory.keys());

  // Optional filter to a single listing.
  if (brandProfileId) {
    const target = brandList.find((b) => b.id === brandProfileId);
    if (!target) {
      return NextResponse.json({ conflicts: [] });
    }
    directoryIds = [target.brand_directory_id];
  }

  const { data, error } = await auth.supabase
    .from('brand_data_conflicts')
    .select(
      'id, brand_directory_id, field_key, existing_value, existing_source, existing_confidence, new_value, new_source, new_confidence, submission_id, created_at',
    )
    .in('brand_directory_id', directoryIds)
    .is('resolution', null)
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const conflicts = (data ?? []).map((c: { brand_directory_id: string }) => ({
    ...c,
    brand_name: nameByDirectory.get(c.brand_directory_id) ?? null,
  }));

  return NextResponse.json({ conflicts });
}
