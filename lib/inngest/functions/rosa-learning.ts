import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { runLearningSweep } from '@/lib/rosa/learning-sweep-run';

/**
 * Rosa learning curation sweep -- Pillar 4 step 2 "Curate"
 * (data-revolution-plan.md).
 *
 * Weekly. Gathers the last 7 days of failure signals already captured by
 * step 1 (see lib/rosa/learning-signals.ts, lib/rosa/tools.ts, lib/rosa/
 * actions.ts, app/api/rosa/chat/route.ts): rosa_message_feedback verdicts
 * of not_right/too_vague, rosa_telemetry learning.knowledge_miss /
 * learning.proposal_cancelled / learning.rephrase events, and
 * support.ticket_filed events with after_answer=true. Clusters them
 * deterministically (lib/rosa/learning-sweep.ts, no LLM) and writes one
 * rosa_learning_cases row per new cluster for an admin to work at
 * /admin/rosa-learning.
 *
 * The gather/cluster/write logic itself lives in
 * lib/rosa/learning-sweep-run.ts as a plain async function, so it can also
 * be run directly (outside the Inngest runtime) for a manual trigger or
 * local verification -- this Inngest function is a thin step.run wrapper
 * around it for scheduling + retry/observability.
 *
 * Flow:
 *   Netlify Schedule fn (weekly) -> inngest.send('rosa/learning.sweep')
 *                                          |
 *                                          v
 *                              rosaLearningSweep (this function)
 *
 * Idempotency: each cluster carries a deterministic evidence.cluster_key
 * (query text for knowledge misses, tool name for cancellations,
 * conversation id for conversation-level signals). Before inserting, the
 * sweep checks for an existing OPEN case with the same cluster_key and
 * skips it -- so a re-run (or next week's run re-seeing the same
 * still-unresolved pattern) never duplicates a case an admin hasn't dealt
 * with yet. Once a case is resolved or dismissed, the same cluster_key can
 * open a fresh case if the pattern recurs.
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const rosaLearningSweep = inngest.createFunction(
  {
    id: 'rosa-learning-sweep',
    name: 'Rosa learning: weekly curation sweep',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'rosa/learning.sweep' }],
  },
  async ({ step }) => {
    let supabase: SupabaseClient;
    try {
      supabase = service();
    } catch (err: unknown) {
      console.warn('[rosa-learning-sweep] no-op:', (err as Error)?.message);
      return { ok: false, reason: (err as Error)?.message };
    }

    const result = await step
      .run('sweep', () => runLearningSweep(supabase))
      .catch((err: unknown) => {
        console.error('[rosa-learning-sweep] sweep failed:', (err as Error)?.message);
        return { checked: 0, created: 0, candidates: [] };
      });

    return { checked: result.checked, created: result.created };
  },
);
