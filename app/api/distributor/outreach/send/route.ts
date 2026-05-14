import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';
import { dispatchOutreach } from '@/lib/distributor/outreach/dispatcher';

/**
 * POST /api/distributor/outreach/send
 * Body: { brand_profile_ids?: string[], send_all?: boolean, force?: boolean }
 *
 * Sends the initial outreach email to one or many brands. Owner /
 * data_manager only. Brands without an outreach_email are skipped with
 * a reason, not errored.
 */
export async function POST(request: Request) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { brand_profile_ids?: unknown; send_all?: unknown; force?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // empty body acceptable
  }

  let brandProfileIds: string[] = [];
  if (Array.isArray(body.brand_profile_ids)) {
    brandProfileIds = body.brand_profile_ids.filter((v): v is string => typeof v === 'string');
  } else if (body.send_all === true) {
    const { data } = await auth.supabase
      .from('brand_profiles')
      .select('id')
      .eq('distributor_org_id', auth.organization.id);
    brandProfileIds = (data ?? []).map((row: { id: string }) => row.id);
  }
  if (brandProfileIds.length === 0) {
    return NextResponse.json({ error: 'no_brands_targeted' }, { status: 400 });
  }

  const result = await dispatchOutreach({
    supabase: auth.supabase,
    distributorOrgId: auth.organization.id,
    distributorName: auth.organization.name,
    replyTo: auth.user.email,
    sentBy: auth.user.id,
    brandProfileIds,
    emailType: 'initial',
    force: body.force === true,
  });

  return NextResponse.json(result);
}
