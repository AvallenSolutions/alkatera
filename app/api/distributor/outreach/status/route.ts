import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';

/**
 * GET /api/distributor/outreach/status
 *
 * Returns the rows needed to populate the outreach dashboard table:
 * every brand in the distributor org with its current outreach state
 * and the latest submission timestamp.
 */
export async function GET() {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const { data, error } = await auth.supabase
    .from('brand_profiles')
    .select(
      'id, name, category, outreach_email, outreach_sent_at, outreach_last_reminder_at, outreach_reminder_count, first_submission_at, last_submission_at, alkatera_tier, upload_token_expires_at',
    )
    .eq('distributor_org_id', auth.organization.id)
    .order('name');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ brands: data ?? [] });
}
