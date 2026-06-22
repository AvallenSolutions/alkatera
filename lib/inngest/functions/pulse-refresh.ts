import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import {
  PULSE_REFRESH_JOBS,
  seedPulseJobs,
  type PulseJobState,
} from '@/lib/pulse/refresh-jobs';
import { patchJob } from '@/lib/pulse/run-refresh';

/**
 * Pulse on-demand refresh (on Inngest).
 *
 * The "Refresh data" button used to run all five Pulse data jobs sequentially
 * inside a single /api/pulse/admin/refresh request. Those jobs are heavy
 * (snapshots iterate every org; insights make a Gemini call per org), so the
 * synchronous chain blew past the platform's sync-function timeout. The gateway
 * then returned an HTML 502/504 page, and the browser's `res.json()` choked on
 * it — the classic "Unexpected token '<', "<HTML>…" is not valid JSON" error.
 *
 * Now the button only records a run row + dispatches this event. Each job runs
 * in its own `step.run` (a fresh function invocation with its own time budget
 * and retries), and progress is written to `pulse_refresh_runs` so the UI can
 * poll for live per-job status.
 *
 * Flow:
 *   POST /api/pulse/admin/refresh  → insert pulse_refresh_runs row (queued)
 *                                  → inngest.send('pulse/refresh.requested')
 *                                          │
 *                                          ▼
 *                                    pulseRefreshRun  (this function)
 *                                          │
 *   GET /api/pulse/admin/refresh/status ◄──┘ (UI polls the row)
 *
 * Jobs run in order (snapshots → anomalies → grid-carbon → insights →
 * shadow-prices) because insights read the tables the earlier jobs populate.
 * Each job swallows its own error so one failure doesn't abort the rest; the
 * run is marked 'failed' if any job failed, 'completed' otherwise.
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const pulseRefreshRun = inngest.createFunction(
  {
    id: 'pulse-refresh-run',
    name: 'Pulse on-demand refresh: run all data jobs',
    // One refresh at a time keeps the snapshots→insights ordering meaningful and
    // avoids two runs stamping on the same metric_snapshots rows.
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'pulse/refresh.requested' }],
  },
  async ({ event, step }) => {
    const { run_id: runId, base_url: baseUrl } = event.data as {
      run_id: string;
      base_url: string;
    };
    const cronSecret = process.env.CRON_SECRET;

    const supabase = service();

    await step.run('mark-running', async () => {
      await supabase
        .from('pulse_refresh_runs')
        .update({ status: 'running', jobs: seedPulseJobs(), updated_at: new Date().toISOString() })
        .eq('id', runId);
    });

    if (!cronSecret) {
      await step.run('fail-no-secret', async () => {
        await supabase
          .from('pulse_refresh_runs')
          .update({
            status: 'failed',
            error: 'CRON_SECRET not configured',
            updated_at: new Date().toISOString(),
          })
          .eq('id', runId);
      });
      return { ok: false, reason: 'CRON_SECRET not configured' };
    }

    let anyFailed = false;
    for (const job of PULSE_REFRESH_JOBS) {
      // Mark this job running so the UI shows a spinner while it executes.
      await step.run(`start-${job.key}`, async () => {
        await patchJob(supabase, runId, job.key, { status: 'running' });
      });

      const outcome = await step
        .run(`job-${job.key}`, async () => {
          const res = await fetch(`${baseUrl}${job.path}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cronSecret}`,
              'Content-Type': 'application/json',
            },
          });
          const state: PulseJobState = res.ok
            ? { status: 'completed', httpStatus: res.status }
            : { status: 'failed', httpStatus: res.status, error: `HTTP ${res.status}` };
          await patchJob(supabase, runId, job.key, state);
          return { ok: res.ok };
        })
        .catch(async (err: unknown) => {
          const message = (err as Error)?.message ?? 'job failed';
          await patchJob(supabase, runId, job.key, { status: 'failed', error: message }).catch(
            () => undefined,
          );
          return { ok: false };
        });

      if (!outcome?.ok) anyFailed = true;
    }

    await step.run('finalise', async () => {
      await supabase
        .from('pulse_refresh_runs')
        .update({
          status: anyFailed ? 'failed' : 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', runId);
    });

    return { ok: !anyFailed };
  },
);
