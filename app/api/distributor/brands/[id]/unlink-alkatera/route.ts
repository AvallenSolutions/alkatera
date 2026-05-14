import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';
import { removeBrandDistributorLink } from '@/lib/distributor/integration/linker';

/**
 * POST /api/distributor/brands/[id]/unlink-alkatera
 *
 * Removes the link between this brand_profile and its currently-bound
 * alkatera org. Tier drops back to 1 or 2 depending on whether the
 * brand has submitted documents directly.
 *
 * Owner / data_manager only.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data: brand } = await auth.supabase
    .from('brand_profiles')
    .select('id, alkatera_org_id')
    .eq('id', params.id)
    .eq('distributor_org_id', auth.organization.id)
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ error: 'brand_not_found' }, { status: 404 });
  }
  const alkateraOrgId = (brand as { alkatera_org_id: string | null }).alkatera_org_id;
  if (!alkateraOrgId) {
    return NextResponse.json({ error: 'not_linked' }, { status: 409 });
  }

  const result = await removeBrandDistributorLink(auth.supabase, params.id, alkateraOrgId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'unlink_failed' }, { status: 500 });
  }
  return NextResponse.json({ new_tier: result.new_tier });
}
