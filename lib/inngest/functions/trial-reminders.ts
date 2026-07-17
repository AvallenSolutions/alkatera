import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';

/**
 * Free-trial lifecycle sweep (on Inngest), run daily.
 *
 * Trials are card-on-file but never auto-charge. This sweep does two things:
 *   1. Reminds trial orgs to choose a plan as they approach the end (7 / 3 / 1 days out).
 *   2. Backstop: expires trials whose end has passed, flipping them to read-only and
 *      emailing "trial ended, choose a plan". The Stripe webhook (cancel_at_period_end ->
 *      customer.subscription.deleted) is the primary expiry path; this catches any it missed.
 *
 * Flow:
 *   Netlify Schedule fn (daily) → inngest.send('subscriptions/trial-reminder.sweep')
 *                                      │
 *                                      ▼
 *                           trialReminderSweep
 *
 * Idempotency: reminders use the trial_reminders table (unique on org+milestone+expiry);
 * expiry uses an atomic status claim (update ... where status = 'trial'). Plus Inngest step
 * memoization, so each email goes out once even if the cron runs late, twice, or retries.
 * Each org is its own step and swallows its own errors so one bad org never blocks the rest.
 */

// Days-remaining thresholds at which we send a reminder, most-lenient first.
const MILESTONES = [7, 3, 1] as const;
const milestoneKey = (m: number) => `${m}day`;

/**
 * Decide which reminder (if any) to send for a trial that has `days` left, given the
 * milestones already sent. Returns the most-urgent unsent milestone the trial qualifies
 * for, plus every more-lenient milestone to record alongside it — so the sequence stays
 * monotonic (a later run can never send "7 days" after "1 day" already went out) and each
 * trial gets at most one reminder per run. Pure + exported for unit testing.
 */
export function selectReminder(
  days: number,
  sentMilestones: ReadonlySet<number>
): { target: number; toRecord: number[] } | null {
  const qualifying = MILESTONES.filter((m) => days <= m);
  const unsent = qualifying.filter((m) => !sentMilestones.has(m));
  if (unsent.length === 0) return null;
  const target = Math.min(...unsent);
  // Record the target plus any still-unsent more-lenient milestones (supersede them so a
  // later run can't send a staler notice). Already-sent milestones need no re-recording.
  return { target, toRecord: unsent.filter((m) => m >= target) };
}

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

interface TrialOrg {
  id: string;
  name: string;
  billing_email: string | null;
  subscription_tier: string | null;
  subscription_expires_at: string;
}

/** Send a trial lifecycle email through the shared subscription-email edge function. */
async function sendTrialEmail(
  organizationId: string,
  eventType: 'trial_ending_soon' | 'trial_ended',
  metadata: Record<string, unknown>
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase config for email');
  const res = await fetch(`${url}/functions/v1/send-subscription-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ organizationId, eventType, metadata }),
  });
  if (!res.ok) {
    throw new Error(`send-subscription-email ${res.status}: ${await res.text()}`);
  }
}

export const trialReminderSweep = inngest.createFunction(
  {
    id: 'trial-reminder-sweep',
    name: 'Free-trial lifecycle: remind before end, expire after',
    concurrency: { limit: 1 },
    retries: 2,
    triggers: [{ event: 'subscriptions/trial-reminder.sweep' }, { cron: '0 9 * * *' }],
  },
  async ({ step }) => {
    const supabase = service();
    const nowMs = Date.now();
    const horizonIso = new Date(nowMs + MILESTONES[0] * 86_400_000).toISOString();
    const nowIso = new Date(nowMs).toISOString();

    // 0. Backstop: expire trials whose end has already passed (with a 1h grace so the Stripe
    //    webhook gets first crack). Atomic claim ensures exactly one path sends trial_ended.
    const ended = (await step.run('list-ended-trials', async () => {
      const cutoff = new Date(nowMs - 3_600_000).toISOString();
      const { data, error } = await supabase
        .from('organizations')
        .select('id, subscription_expires_at')
        .eq('subscription_status', 'trial')
        .not('subscription_expires_at', 'is', null)
        .lte('subscription_expires_at', cutoff)
        .neq('is_platform_admin', true);
      if (error) throw new Error(`Failed to list ended trials: ${error.message}`);
      return (data ?? []) as Array<{ id: string; subscription_expires_at: string }>;
    })) as Array<{ id: string; subscription_expires_at: string }>;

    let expired = 0;
    for (const org of ended) {
      const res = await step.run(`expire-${org.id}`, async () => {
        // Claim the transition: only the run that flips trial -> cancelled emails.
        const { data: claimed, error } = await supabase
          .from('organizations')
          .update({ subscription_status: 'cancelled', subscription_tier: 'seed', updated_at: new Date().toISOString() })
          .eq('id', org.id)
          .eq('subscription_status', 'trial')
          .select('id');
        if (error) throw new Error(error.message);
        if (!claimed || claimed.length === 0) return { expired: false as const }; // webhook already handled it
        await sendTrialEmail(org.id, 'trial_ended', { trialEndsAt: org.subscription_expires_at });
        return { expired: true as const };
      }).catch((err: unknown) => {
        console.error(`[trial-reminders] expire ${org.id} failed:`, (err as Error)?.message);
        return { expired: false as const };
      });
      if (res?.expired) expired++;
    }

    // 1. Trials whose end is within the widest milestone window.
    const trials = (await step.run('find-expiring-trials', async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, billing_email, subscription_tier, subscription_expires_at')
        .eq('subscription_status', 'trial')
        .not('subscription_expires_at', 'is', null)
        .not('billing_email', 'is', null)
        .lte('subscription_expires_at', horizonIso)
        .gt('subscription_expires_at', nowIso)
        .neq('is_platform_admin', true);
      if (error) throw new Error(`Failed to list expiring trials: ${error.message}`);
      return (data ?? []) as TrialOrg[];
    })) as TrialOrg[];

    if (trials.length === 0) {
      return { checked: 0, reminded: 0, expired };
    }

    // 2. Reminders already sent for these orgs (keyed by org+milestone+expiry).
    const sentSet = new Set(
      (await step.run('load-sent-reminders', async () => {
        const ids = trials.map((t) => t.id);
        const { data, error } = await supabase
          .from('trial_reminders')
          .select('organization_id, milestone, trial_expires_at')
          .in('organization_id', ids);
        if (error) throw new Error(`Failed to load sent reminders: ${error.message}`);
        return (data ?? []) as Array<{ organization_id: string; milestone: string; trial_expires_at: string }>;
      })).map((r) => `${r.organization_id}|${r.milestone}|${r.trial_expires_at}`)
    );

    // 3. One step per org: send the most-urgent unsent milestone, then record it (plus
    //    any more-lenient milestones, so a later run can't send a stale "7 days" notice).
    let reminded = 0;
    for (const org of trials) {
      const outcome = await step.run(`remind-${org.id}`, async () => {
        const expIso = org.subscription_expires_at;
        const days = Math.max(0, Math.ceil((new Date(expIso).getTime() - Date.now()) / 86_400_000));
        const alreadySent = new Set(
          MILESTONES.filter((m) => sentSet.has(`${org.id}|${milestoneKey(m)}|${expIso}`))
        );
        const decision = selectReminder(days, alreadySent);
        if (!decision) return { sent: false as const };

        const { target, toRecord } = decision;
        await sendTrialEmail(org.id, 'trial_ending_soon', {
          daysRemaining: days,
          trialEndsAt: expIso,
          tier: org.subscription_tier ?? 'seed',
        });

        // Record the milestone we sent plus every more-lenient one (toRecord), so the
        // reminder sequence stays monotonic (never send "7 days" after "1 day").
        const rows = toRecord.map((m) => ({
          organization_id: org.id,
          milestone: milestoneKey(m),
          trial_expires_at: expIso,
        }));
        const { error } = await supabase
          .from('trial_reminders')
          .upsert(rows, { onConflict: 'organization_id,milestone,trial_expires_at', ignoreDuplicates: true });
        if (error) {
          // Email already went out; a failed record just risks a rare duplicate next run.
          console.warn(`[trial-reminders] failed to record reminder for ${org.id}: ${error.message}`);
        }
        return { sent: true as const, milestone: milestoneKey(target), days };
      }).catch((err: unknown) => {
        // Isolate per-org failures: log and move on; this org retries next daily run.
        console.error(`[trial-reminders] org ${org.id} failed:`, (err as Error)?.message);
        return { sent: false as const, error: (err as Error)?.message };
      });

      if (outcome?.sent) reminded++;
    }

    return { checked: trials.length, reminded, expired };
  }
);
