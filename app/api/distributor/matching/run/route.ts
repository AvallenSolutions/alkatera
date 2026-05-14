import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';
import { attemptAutoMatch } from '@/lib/distributor/integration/linker';

/**
 * POST /api/distributor/matching/run
 * Body: { brand_profile_id?: string }
 *
 * If brand_profile_id is provided, run the matcher for that one brand;
 * otherwise run it for every unlinked brand in the caller's org.
 * Owner / data_manager only.
 */
export async function POST(request: Request) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { brand_profile_id?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // empty body acceptable
  }

  let brands: Array<{
    id: string;
    name: string;
    normalized_name: string;
    website: string | null;
  }> = [];

  if (typeof body.brand_profile_id === 'string' && body.brand_profile_id.length > 0) {
    const { data } = await auth.supabase
      .from('brand_profiles')
      .select('id, name, normalized_name, website')
      .eq('id', body.brand_profile_id)
      .eq('distributor_org_id', auth.organization.id)
      .maybeSingle();
    if (!data) {
      return NextResponse.json({ error: 'brand_not_found' }, { status: 404 });
    }
    brands = [data as (typeof brands)[number]];
  } else {
    const { data } = await auth.supabase
      .from('brand_profiles')
      .select('id, name, normalized_name, website')
      .eq('distributor_org_id', auth.organization.id)
      .is('alkatera_org_id', null);
    brands = (data ?? []) as typeof brands;
  }

  let linked = 0;
  let suggested = 0;
  let noMatch = 0;
  for (const brand of brands) {
    const outcome = await attemptAutoMatch(auth.supabase, brand);
    if (outcome.action === 'linked') linked += 1;
    else if (outcome.action === 'suggested') suggested += 1;
    else noMatch += 1;
  }
  return NextResponse.json({ scanned: brands.length, linked, suggested, no_match: noMatch });
}
