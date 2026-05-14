import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';
import { dispatchOutreach } from '@/lib/distributor/outreach/dispatcher';

/**
 * POST /api/distributor/outreach/remind
 * Body: { brand_profile_ids: string[], remind_non_responders?: boolean, days_since?: number, force?: boolean }
 *
 * Sends a reminder to targeted brands. When `remind_non_responders` is
 * true we target every brand that has had outreach sent ≥ `days_since`
 * (default 14) days ago and has not submitted documents yet.
 *
 * The dispatcher enforces a hard 7-day minimum between sends regardless
 * of how the brand IDs were picked — that's the rate-limit guard. Pass
 * `force: true` to override (useful for tests).
 */
export async function POST(request: Request) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: {
    brand_profile_ids?: unknown;
    remind_non_responders?: unknown;
    days_since?: unknown;
    force?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    // empty body acceptable
  }

  let brandProfileIds: string[] = [];
  if (Array.isArray(body.brand_profile_ids)) {
    brandProfileIds = body.brand_profile_ids.filter((v): v is string => typeof v === 'string');
  } else if (body.remind_non_responders === true) {
    const daysSince = typeof body.days_since === 'number' && body.days_since > 0 ? body.days_since : 14;
    const cutoff = new Date(Date.now() - daysSince * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await auth.supabase
      .from('brand_profiles')
      .select('id, outreach_sent_at, last_submission_at')
      .eq('distributor_org_id', auth.organization.id)
      .not('outreach_sent_at', 'is', null)
      .is('last_submission_at', null)
      .lte('outreach_sent_at', cutoff);
    brandProfileIds = (data ?? []).map((r: { id: string }) => r.id);
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
    emailType: 'reminder',
    force: body.force === true,
  });

  return NextResponse.json(result);
}
