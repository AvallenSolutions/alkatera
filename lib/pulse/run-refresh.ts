import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PULSE_REFRESH_JOBS,
  seedPulseJobs,
  type PulseJobState,
} from './refresh-jobs';

/**
 * Server-side helpers for executing a Pulse refresh run.
 *
 * The production path runs each job in its own Inngest `step.run`
 * (`lib/inngest/functions/pulse-refresh.ts`). `patchJob` is shared with that
 * function. `runPulseRefreshInline` is the local-dev / no-Inngest fallback: it
 * runs the jobs in-process so the "Refresh data" button still works when
 * INNGEST_EVENT_KEY isn't configured. It is fire-and-forget by design — never
 * await it in a request handler, just kick it off and return the run id.
 */

/** Patch a single job's state on the run row, preserving the others. */
export async function patchJob(
  supabase: SupabaseClient,
  runId: string,
  key: string,
  state: PulseJobState,
): Promise<void> {
  const { data, error: readErr } = await supabase
    .from('pulse_refresh_runs')
    .select('jobs')
    .eq('id', runId)
    .single();
  if (readErr) throw new Error(`read run ${runId}: ${readErr.message}`);

  const jobs = { ...(data?.jobs ?? {}), [key]: state };
  const { error } = await supabase
    .from('pulse_refresh_runs')
    .update({ jobs, updated_at: new Date().toISOString() })
    .eq('id', runId);
  if (error) throw new Error(`patch job ${key}: ${error.message}`);
}

/**
 * Fallback executor for environments without Inngest (local dev). Runs all jobs
 * sequentially in-process, updating the run row as it goes. No platform gateway
 * sits in front of a local node server, so the long runtime is fine here.
 */
export async function runPulseRefreshInline(
  supabase: SupabaseClient,
  runId: string,
  baseUrl: string,
  cronSecret: string | undefined,
): Promise<void> {
  await supabase
    .from('pulse_refresh_runs')
    .update({ status: 'running', jobs: seedPulseJobs(), updated_at: new Date().toISOString() })
    .eq('id', runId);

  if (!cronSecret) {
    await supabase
      .from('pulse_refresh_runs')
      .update({
        status: 'failed',
        error: 'CRON_SECRET not configured',
        updated_at: new Date().toISOString(),
      })
      .eq('id', runId);
    return;
  }

  let anyFailed = false;
  for (const job of PULSE_REFRESH_JOBS) {
    await patchJob(supabase, runId, job.key, { status: 'running' }).catch(() => undefined);
    try {
      const res = await fetch(`${baseUrl}${job.path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
      });
      await patchJob(
        supabase,
        runId,
        job.key,
        res.ok
          ? { status: 'completed', httpStatus: res.status }
          : { status: 'failed', httpStatus: res.status, error: `HTTP ${res.status}` },
      );
      if (!res.ok) anyFailed = true;
    } catch (err: unknown) {
      anyFailed = true;
      await patchJob(supabase, runId, job.key, {
        status: 'failed',
        error: (err as Error)?.message ?? 'job failed',
      }).catch(() => undefined);
    }
  }

  await supabase
    .from('pulse_refresh_runs')
    .update({
      status: anyFailed ? 'failed' : 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId);
}
