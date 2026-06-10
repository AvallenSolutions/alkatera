import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { runBrandAgent } from '@/lib/distributor/scraping/brand-agent';

/**
 * Scraping queue, on Inngest. Replaces the old
 * `/api/cron/process-scraping-queue` route that was 300s-ceiling-bound
 * and routinely left jobs stranded when Netlify killed the function.
 *
 * Flow:
 *
 *   Netlify Schedule fn → inngest.send('scraping/queue.tick')
 *                              │
 *                              ▼
 *                  scrapingQueueTick
 *                  - Resets stale 'running' jobs back to 'queued'
 *                  - Claims up to N queued jobs (marks 'running')
 *                  - Fans out one 'scraping/brand.run' per job
 *                              │
 *                              ▼
 *                  scrapingBrandRun (per brand)
 *                  - Runs brand-agent against the brand
 *                  - Updates the job row to 'complete' or 'error'
 *
 * Each brand-run is its own Inngest function execution. Inngest retries
 * each one independently, so a single bad brand can't kill the rest of
 * the batch — the chronic "one slow brand kills 7 others" pattern
 * is structurally impossible.
 */

const MAX_BRANDS_PER_TICK = 40;
// Stale-running threshold: 30 min. Worker steps now THROW on transient
// failures so Inngest's retry/backoff handles them (total span can exceed
// 10 minutes); the sweep must not re-queue a job that is mid-retry or the
// same brand runs twice. It exists only to rescue jobs whose run died
// without onFailure firing (e.g. lost event, unregistered function).
const STALE_MS = 30 * 60 * 1000;

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface JobRow {
  id: string;
  brand_profile_id: string | null;
  distributor_org_id: string | null;
  brand_directory_id: string | null;
}

/**
 * Fan-out tick: claim queued jobs and dispatch one Inngest event per job.
 */
export const scrapingQueueTick = inngest.createFunction(
  {
    id: 'scraping-queue-tick',
    name: 'Scraping queue: claim + fan out',
    // One in flight at a time so duplicate ticks can't double-claim.
    concurrency: { limit: 1 },
    retries: 0,
    triggers: [{ event: 'scraping/queue.tick' }],
  },
  async ({ step }) => {
    const supabase = service();

    const recoveredCount = await step.run('recover-stale-running', async () => {
      const cutoff = new Date(Date.now() - STALE_MS).toISOString();
      const { data: recovered } = await supabase
        .from('scraping_jobs')
        .update({ status: 'queued', started_at: null })
        .eq('status', 'running')
        .lt('started_at', cutoff)
        .select('id');
      return (recovered ?? []).length;
    });

    const claimed = await step.run('claim-jobs', async () => {
      const { data, error: selectError } = await supabase
        .from('scraping_jobs')
        .select('id, brand_profile_id, distributor_org_id, brand_directory_id')
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(MAX_BRANDS_PER_TICK);
      if (selectError) throw new Error(`claim select failed: ${selectError.message}`);
      const rows = (data ?? []) as JobRow[];
      if (rows.length === 0) return [] as JobRow[];
      // Status guard so a concurrent writer (admin cancel/requeue) isn't
      // stomped back to 'running'; throw on error so we never fan out events
      // for rows still marked 'queued' (the next tick would re-dispatch them).
      const { data: updated, error: updateError } = await supabase
        .from('scraping_jobs')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .in('id', rows.map((j) => j.id))
        .eq('status', 'queued')
        .select('id');
      if (updateError) throw new Error(`claim update failed: ${updateError.message}`);
      const claimedIds = new Set((updated ?? []).map((r: { id: string }) => r.id));
      return rows.filter((j) => claimedIds.has(j.id));
    });

    if (claimed.length === 0) {
      return { recovered_stale: recoveredCount, dispatched: 0 };
    }

    await step.sendEvent(
      'fan-out-brand-runs',
      claimed.map((job: JobRow) => ({
        name: 'scraping/brand.run',
        data: {
          job_id: job.id,
          brand_profile_id: job.brand_profile_id ?? null,
          brand_directory_id: job.brand_directory_id ?? null,
        },
      })),
    );

    return { recovered_stale: recoveredCount, dispatched: claimed.length };
  },
);

/**
 * Per-brand worker. Runs brand-agent against one claimed job and
 * writes the terminal status. Lives in its own Inngest function so
 * Inngest can retry it independently of every other brand in the
 * batch.
 */
export const scrapingBrandRun = inngest.createFunction(
  {
    id: 'scraping-brand-run',
    name: 'Scrape one brand',
    // Limit fan-out concurrency so we don't melt Gemini quotas or
    // hammer shared third-party hosts when 40 brands all share a
    // sustainability platform. Capped at 5 to stay within the Inngest
    // plan's per-function concurrency limit — a higher value makes the
    // whole app fail to sync (Inngest rejects the registration).
    concurrency: { limit: 5 },
    // 3 attempts per brand with exponential backoff. The worker step THROWS
    // on failure (a step that returns an error payload is never retried), so
    // transient 5xx / timeout failures actually pass on retry; onFailure
    // below writes the terminal 'error' status when all attempts exhaust.
    retries: 3,
    triggers: [{ event: 'scraping/brand.run' }],
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data as { job_id: string };
      if (!original?.job_id) return;
      const supabase = service();
      await supabase
        .from('scraping_jobs')
        .update({
          status: 'error',
          completed_at: new Date().toISOString(),
          error_message: `Failed after retries: ${error.message}`.slice(0, 1000),
        })
        .eq('id', original.job_id);
    },
  },
  async ({ event, step }) => {
    const supabase = service();
    const eventData = event.data as {
      job_id: string;
      brand_profile_id: string | null;
      brand_directory_id: string | null;
    };
    const { job_id, brand_profile_id, brand_directory_id } = eventData;

    // Throws on transient failure → Inngest retries the step; terminal
    // failure (all retries exhausted) is handled by onFailure above.
    const result = await step.run('run-brand-agent', async () => {
      return runBrandAgent({
        supabase,
        brandProfileId: brand_profile_id ?? undefined,
        brandDirectoryId: brand_directory_id ?? undefined,
        jobId: job_id,
      });
    });

    await step.run('persist-job-status', async () => {
      // The agent ran to completion; 'error' here means it structurally
      // failed on every source (a data problem, not a transient one).
      const finalStatus: 'complete' | 'error' =
        result.errors.length > 0 && result.sources_succeeded === 0 ? 'error' : 'complete';

      const messageLines: string[] = [];
      if (result.errors.length > 0) messageLines.push(...result.errors.slice(0, 5));
      if (result.skip_reasons.length > 0)
        messageLines.push(...result.skip_reasons.slice(0, 5));

      await supabase
        .from('scraping_jobs')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          sources_attempted: result.sources_attempted,
          sources_succeeded: result.sources_succeeded,
          error_message: messageLines.join('\n') || null,
        })
        .eq('id', job_id);

      if (brand_profile_id) {
        await supabase
          .from('brand_profiles')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', brand_profile_id);
      } else if (brand_directory_id) {
        await supabase
          .from('brand_directory')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', brand_directory_id);
      }
    });

    return {
      job_id,
      sources_succeeded: result.sources_succeeded,
      findings_written: result.findings_written,
    };
  },
);
