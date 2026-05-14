import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';
import { createBrandDistributorLink } from '@/lib/distributor/integration/linker';

/**
 * POST /api/distributor/brands/[id]/link-alkatera
 * Body: { alkatera_org_id: string }
 *
 * Manually link a brand_profile to a specific alkatera organisation.
 * Manual links are flagged needs_brand_confirmation=true — the brand
 * receives an email and the link's confirmed_by_brand stays false until
 * they accept (from the brand-side Distributors settings page).
 *
 * Owner / data_manager only.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { alkatera_org_id?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (typeof body.alkatera_org_id !== 'string' || !body.alkatera_org_id) {
    return NextResponse.json({ error: 'alkatera_org_id_required' }, { status: 400 });
  }

  // Verify the brand belongs to this distributor.
  const { data: brand } = await auth.supabase
    .from('brand_profiles')
    .select('id')
    .eq('id', params.id)
    .eq('distributor_org_id', auth.organization.id)
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ error: 'brand_not_found' }, { status: 404 });
  }

  const result = await createBrandDistributorLink({
    supabase: auth.supabase,
    brandProfileId: params.id,
    alkateraOrgId: body.alkatera_org_id,
    matchMethod: 'manual',
    matchConfidence: 1.0,
    needsBrandConfirmation: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'link_failed' }, { status: 500 });
  }
  return NextResponse.json({ link_id: result.link_id, new_tier: result.new_tier });
}
