import { NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * GET /api/brand/directory/discovery-status
 *
 * Returns the brand's canonical directory entry id, current
 * discovery_opt_out value, and how many distributors currently list
 * the brand. Used by the DirectoryDiscoveryToggle component on the
 * brand-side /dashboard/settings/distributors page.
 *
 * Resolves the brand from the authenticated user's organization
 * membership. If the user is a member of multiple orgs (unusual) we
 * return the most-recently-joined org's directory entry — the toggle
 * UI is a no-op if no entry exists.
 */
export async function GET() {
  const { client, user, error } = await getSupabaseAPIClient();
  if (error || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { data: membership } = await client
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({
      directoryId: null,
      discoveryOptOut: false,
      listedByCount: 0,
    });
  }
  const orgId = (membership as { organization_id: string }).organization_id;

  const { data: directory } = await client
    .from('brand_directory')
    .select('id, discovery_opt_out')
    .eq('alkatera_org_id', orgId)
    .maybeSingle();
  if (!directory) {
    return NextResponse.json({
      directoryId: null,
      discoveryOptOut: false,
      listedByCount: 0,
    });
  }
  const dir = directory as { id: string; discovery_opt_out: boolean };

  const { count } = await client
    .from('brand_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('brand_directory_id', dir.id)
    .eq('listing_status', 'active');

  return NextResponse.json({
    directoryId: dir.id,
    discoveryOptOut: dir.discovery_opt_out,
    listedByCount: count ?? 0,
  });
}
