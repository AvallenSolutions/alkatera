import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';
import { recalculateCompleteness, recalculateOrg } from '@/lib/distributor/scoring/recalculate';

/**
 * POST /api/distributor/scoring/recalculate
 * Body: { brand_profile_id?: string }
 *
 * If `brand_profile_id` is provided, recompute completeness for just
 * that brand; otherwise recompute every brand in the caller's org.
 *
 * Owner / data_manager only — viewers cannot mutate snapshots.
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

  if (typeof body.brand_profile_id === 'string' && body.brand_profile_id.length > 0) {
    const { data: brand } = await auth.supabase
      .from('brand_profiles')
      .select('id')
      .eq('id', body.brand_profile_id)
      .eq('distributor_org_id', auth.organization.id)
      .maybeSingle();
    if (!brand) {
      return NextResponse.json({ error: 'brand_not_found' }, { status: 404 });
    }
    const result = await recalculateCompleteness(auth.supabase, body.brand_profile_id);
    return NextResponse.json({ result });
  }

  const { updated } = await recalculateOrg(auth.supabase, auth.organization.id);
  return NextResponse.json({ updated });
}
