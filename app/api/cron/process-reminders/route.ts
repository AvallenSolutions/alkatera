import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { dispatchOutreach } from '@/lib/distributor/outreach/dispatcher';

/**
 * Cron: distributor outreach reminders
 *
 * POST /api/cron/process-reminders
 *
 * Runs once a day. For each active outreach_reminder_schedules row:
 *   1. Find brands in scope (single-brand schedule → that brand;
 *      org-wide schedule → every brand in the org).
 *   2. Drop any brand that has already submitted (first_submission_at).
 *   3. Drop any brand that has hit max_reminders.
 *   4. Drop any brand whose last contact was within interval_days.
 *   5. Send a reminder to the survivors via the Phase 3 dispatcher,
 *      using the schedule creator as `sent_by` and their email as
 *      replyTo.
 *
 * Auth: CRON_SECRET Bearer.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'missing_supabase_config' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as SupabaseClient;

  const { data: schedules } = await supabase
    .from('outreach_reminder_schedules')
    .select('id, distributor_org_id, created_by, brand_profile_id, interval_days, max_reminders')
    .eq('active', true);

  type Schedule = {
    id: string;
    distributor_org_id: string;
    created_by: string;
    brand_profile_id: string | null;
    interval_days: number;
    max_reminders: number;
  };
  const summary: Array<{
    schedule_id: string;
    distributor_org_id: string;
    sent: number;
    skipped: number;
    errors: number;
  }> = [];

  for (const sched of (schedules ?? []) as Schedule[]) {
    // Look up the distributor org name + creator email so dispatch can
    // build correct from / replyTo / subject lines.
    const { data: org } = await supabase
      .from('distributor_organizations')
      .select('name')
      .eq('id', sched.distributor_org_id)
      .maybeSingle();
    if (!org) {
      summary.push({ schedule_id: sched.id, distributor_org_id: sched.distributor_org_id, sent: 0, skipped: 0, errors: 1 });
      continue;
    }

    let creatorEmail: string | null = null;
    try {
      const { data } = await (
        supabase.auth as unknown as {
          admin: {
            getUserById: (id: string) => Promise<{ data: { user: { email?: string | null } | null } }>;
          };
        }
      ).admin.getUserById(sched.created_by);
      creatorEmail = data?.user?.email ?? null;
    } catch {
      // service role may not be configured in dev
    }

    // Find candidate brands.
    const cutoff = new Date(Date.now() - sched.interval_days * 24 * 60 * 60 * 1000).toISOString();
    let candidateQuery = supabase
      .from('brand_profiles')
      .select(
        'id, outreach_sent_at, outreach_last_reminder_at, outreach_reminder_count, first_submission_at, outreach_email',
      )
      .eq('distributor_org_id', sched.distributor_org_id)
      .is('first_submission_at', null)
      .not('outreach_sent_at', 'is', null)
      .not('outreach_email', 'is', null)
      .lt('outreach_reminder_count', sched.max_reminders);
    if (sched.brand_profile_id) {
      candidateQuery = candidateQuery.eq('id', sched.brand_profile_id);
    }
    const { data: candidates } = await candidateQuery;

    const eligibleIds = ((candidates ?? []) as Array<{
      id: string;
      outreach_sent_at: string | null;
      outreach_last_reminder_at: string | null;
      outreach_reminder_count: number;
    }>)
      .filter((b) => {
        const lastTouch =
          (b.outreach_last_reminder_at &&
          (!b.outreach_sent_at || b.outreach_last_reminder_at > b.outreach_sent_at)
            ? b.outreach_last_reminder_at
            : b.outreach_sent_at) ?? null;
        if (!lastTouch) return false;
        return new Date(lastTouch).toISOString() < cutoff;
      })
      .map((b) => b.id);

    if (eligibleIds.length === 0) {
      summary.push({ schedule_id: sched.id, distributor_org_id: sched.distributor_org_id, sent: 0, skipped: 0, errors: 0 });
      continue;
    }

    const result = await dispatchOutreach({
      supabase,
      distributorOrgId: sched.distributor_org_id,
      distributorName: (org as { name: string }).name,
      replyTo: creatorEmail,
      sentBy: sched.created_by,
      brandProfileIds: eligibleIds,
      emailType: 'reminder',
    });

    summary.push({
      schedule_id: sched.id,
      distributor_org_id: sched.distributor_org_id,
      sent: result.sent,
      skipped: result.skipped,
      errors: result.errors,
    });
  }

  return NextResponse.json({ schedules_processed: summary.length, summary });
}
