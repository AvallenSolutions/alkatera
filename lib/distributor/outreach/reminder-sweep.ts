import type { SupabaseClient } from '@supabase/supabase-js';
import { dispatchOutreach } from './dispatcher';

/**
 * Distributor outreach reminders — daily sweep.
 *
 * For each active outreach_reminder_schedules row:
 *   1. Find brands in scope (single-brand schedule → that brand;
 *      org-wide schedule → every brand in the org).
 *   2. Drop any brand that has already submitted (first_submission_at).
 *   3. Drop any brand that has hit max_reminders.
 *   4. Drop any brand whose last contact was within interval_days.
 *   5. Send a reminder to the survivors via the Phase 3 dispatcher.
 *
 * Extracted from `/api/cron/process-reminders` so the route (kept for
 * manual/admin trigger) and the `distributorReminderSweep` Inngest cron
 * function share one implementation.
 */

export interface ReminderScheduleSummary {
  schedule_id: string;
  distributor_org_id: string;
  sent: number;
  skipped: number;
  errors: number;
}

export interface ReminderSweepResult {
  schedules_processed: number;
  summary: ReminderScheduleSummary[];
}

export async function runReminderSweep(supabase: SupabaseClient): Promise<ReminderSweepResult> {
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
  const summary: ReminderScheduleSummary[] = [];

  for (const sched of (schedules ?? []) as Schedule[]) {
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

  return { schedules_processed: summary.length, summary };
}
