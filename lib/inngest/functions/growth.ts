import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { gatherGrowthIngredients, scoreFromIngredients, computeGrowthSignals } from '@/lib/desk/growth-score';

/**
 * "Forest gone quiet" stall sweep (on Inngest), run weekly.
 *
 * The desk's growth score (lib/desk/growth-score.ts) drives the living forest —
 * bare ground for a new org, closed canopy at 100 — but it's computed live and
 * nothing previously tracked it over time. This sweep gives it memory: every
 * week it snapshots each active org's score into growth_score_snapshots, then
 * compares today's score against the snapshot from 14+ days ago. If the score
 * hasn't moved and there's still at least one undone setup signal, the org gets
 * a single gentle in-app nudge through the existing user_notifications /
 * NotificationBell mechanism (the same one advisor messages and feedback
 * replies use) pointing back at /desk/.
 *
 * Flow:
 *   Netlify Schedule fn (weekly) → inngest.send('growth/stall.check')
 *                                        │
 *                                        ▼
 *                              growthStallSweep (this function)
 *
 * Idempotency: the score snapshot itself is a plain append (one row a week is
 * harmless even on a re-run); the nudge is deduped by checking for an existing
 * unread growth_stall notification, or one created in the last 14 days, for
 * the org before inserting. Each org is its own step and swallows its own
 * errors so one bad org never blocks the rest.
 */

const STALL_WINDOW_DAYS = 14;

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

interface ActiveOrg {
  id: string;
  name: string;
}

export const growthStallSweep = inngest.createFunction(
  {
    id: 'growth-stall-sweep',
    name: 'Growth score: "forest gone quiet" stall nudge',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'growth/stall.check' }, { cron: '0 8 * * 1' }],
  },
  async ({ step }) => {
    let supabase: SupabaseClient;
    try {
      supabase = service();
    } catch (err: unknown) {
      // Missing env is a graceful no-op, not a failure — mirrors trial-reminders.
      console.warn('[growth-stall-sweep] no-op:', (err as Error)?.message);
      return { ok: false, reason: (err as Error)?.message };
    }

    const orgs = (await step
      .run('list-active-orgs', async () => {
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name')
          .in('subscription_status', ['active', 'trial'])
          .neq('is_platform_admin', true);
        if (error) throw new Error(`Failed to list active orgs: ${error.message}`);
        return (data ?? []) as ActiveOrg[];
      })
      .catch((err: unknown) => {
        // No organizations table access at all (e.g. local dev without the
        // table yet) — no-op rather than throw.
        console.warn('[growth-stall-sweep] could not list orgs:', (err as Error)?.message);
        return [] as ActiveOrg[];
      })) as ActiveOrg[];

    if (orgs.length === 0) {
      return { checked: 0, nudged: 0 };
    }

    let nudged = 0;
    for (const org of orgs) {
      const outcome = await step
        .run(`sweep-${org.id}`, async () => {
          const nowIso = new Date().toISOString();

          // 1. Compute today's score + signals, and record the snapshot regardless
          //    of whether a nudge fires — future runs need this history point.
          const ingredients = await gatherGrowthIngredients(supabase, org.id);
          const { score } = scoreFromIngredients(ingredients);

          const { error: insertErr } = await supabase
            .from('growth_score_snapshots')
            .insert({ organization_id: org.id, score, captured_at: nowIso });
          if (insertErr) {
            // Table may not exist yet in an env that hasn't run the migration —
            // log and stop here rather than throwing the whole org.
            console.warn(`[growth-stall-sweep] snapshot insert failed for ${org.id}: ${insertErr.message}`);
            return { nudged: false as const };
          }

          // 2. Find the snapshot from 14+ days ago. None yet (org too new for
          //    the sweep to have run twice with a gap) → nothing to compare.
          const cutoffIso = new Date(Date.now() - STALL_WINDOW_DAYS * 86_400_000).toISOString();
          const { data: prior, error: priorErr } = await supabase
            .from('growth_score_snapshots')
            .select('score, captured_at')
            .eq('organization_id', org.id)
            .lte('captured_at', cutoffIso)
            .order('captured_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (priorErr || !prior) return { nudged: false as const };
          if (prior.score !== score) return { nudged: false as const }; // score moved — no stall

          // 3. Still something left to do? A stalled score at 100 (fully grown)
          //    isn't a stall worth nagging about.
          const signals = computeGrowthSignals(ingredients);
          const hasUndone = Object.values(signals).some((band) => band.some((s) => !s.done));
          if (!hasUndone) return { nudged: false as const };

          // 4. Dedupe: skip if an equivalent unread nudge exists, or one was
          //    created in the last 14 days (whether read or not).
          const dedupeCutoffIso = new Date(Date.now() - STALL_WINDOW_DAYS * 86_400_000).toISOString();
          const { data: existing, error: existingErr } = await supabase
            .from('user_notifications')
            .select('id, is_read, created_at')
            .eq('organization_id', org.id)
            .eq('notification_type', 'growth_stall')
            .or(`is_read.eq.false,created_at.gte.${dedupeCutoffIso}`)
            .limit(1);
          if (existingErr) {
            console.warn(`[growth-stall-sweep] dedupe check failed for ${org.id}: ${existingErr.message}`);
            return { nudged: false as const };
          }
          if (existing && existing.length > 0) return { nudged: false as const };

          // 5. Who to nudge: every member of the org, same as the advisor-message
          //    convention (notify all org members) since any of them can add data.
          const { data: members, error: membersErr } = await supabase
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', org.id);
          if (membersErr || !members || members.length === 0) {
            if (membersErr) console.warn(`[growth-stall-sweep] members lookup failed for ${org.id}: ${membersErr.message}`);
            return { nudged: false as const };
          }

          const rows = members.map((m: { user_id: string }) => ({
            user_id: m.user_id,
            organization_id: org.id,
            notification_type: 'growth_stall',
            title: 'The forest has been quiet for a while.',
            message:
              'Nothing new has grown in your forest this fortnight. One small piece of data would get it going again.',
            entity_type: 'growth_stall',
            entity_id: org.id,
            metadata: { href: '/desk/', score },
          }));

          const { error: notifyErr } = await supabase.from('user_notifications').insert(rows);
          if (notifyErr) {
            console.warn(`[growth-stall-sweep] notification insert failed for ${org.id}: ${notifyErr.message}`);
            return { nudged: false as const };
          }

          return { nudged: true as const };
        })
        .catch((err: unknown) => {
          // Isolate per-org failures: log and move on; this org retries next weekly run.
          console.error(`[growth-stall-sweep] org ${org.id} failed:`, (err as Error)?.message);
          return { nudged: false as const };
        });

      if (outcome?.nudged) nudged++;
    }

    return { checked: orgs.length, nudged };
  },
);
