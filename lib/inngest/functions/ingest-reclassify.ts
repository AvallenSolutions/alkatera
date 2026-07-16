import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NonRetriableError } from 'inngest';
import { inngest } from '../client';
import {
  runReclassify,
  ReclassifyUnsupportedError,
  type ReclassifyJob,
} from '@/lib/ingest/reclassify';
import type { ClassifierResultType } from '@/lib/ingest/classify-document';

/**
 * Background forced-type reclassification for large ingest files. The sync
 * reclassify route (`/api/ingest/auto/[jobId]/reclassify`) handles small files
 * inline; files above the sync ceiling flip the job to 'extracting' and fire
 * `ingest/reclassify.run`, which we handle here. The extraction is the same
 * shared `runReclassify` the sync path uses, so both write identical rows; on
 * success we flip the job back to 'completed' and the client's poll picks up
 * the new result. Failures land on 'failed' (via onFailure), matching the
 * classify path's vocabulary so the existing poll UI just works.
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const JOB_COLUMNS =
  'id, organization_id, user_id, result_type, result_payload, original_result_type, reclassify_count, stash_path, file_name, file_mime';

export const ingestReclassifyRun = inngest.createFunction(
  {
    id: 'ingest-reclassify-run',
    name: 'Ingest: re-read a large document as a new type',
    concurrency: { limit: 4 },
    // The worker step THROWS on transient failure so these retries fire;
    // onFailure writes the terminal 'failed' status when attempts exhaust (or
    // immediately for a NonRetriableError).
    retries: 2,
    triggers: [{ event: 'ingest/reclassify.run' }],
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data as { job_id?: string };
      if (!original?.job_id) return;
      const supabase = service();
      await supabase
        .from('ingest_jobs')
        .update({
          status: 'failed',
          error: (error.message || 'Could not re-read the document.').slice(0, 500),
          phase_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', original.job_id);
    },
  },
  async ({ event, step }) => {
    const supabase = service();
    const { job_id, target_type } = event.data as { job_id: string; target_type: string };

    // Download + forced extraction + result/feedback/profile writes in one step
    // (the file bytes are too big to pass between steps as JSON).
    await step.run('reclassify', async () => {
      const { data: job } = await supabase
        .from('ingest_jobs')
        .select(JOB_COLUMNS)
        .eq('id', job_id)
        .maybeSingle();
      if (!job) throw new NonRetriableError(`Ingest job ${job_id} not found`);
      if (!job.stash_path) throw new NonRetriableError('The original file is no longer available.');

      const { data: blob, error: dlErr } = await supabase.storage
        .from('ingest-staging')
        .download(job.stash_path);
      if (dlErr || !blob) throw new NonRetriableError('The original file is no longer available.');
      const fileBytes = new Uint8Array(await blob.arrayBuffer());

      try {
        await runReclassify({
          supabase,
          job: job as ReclassifyJob,
          targetType: target_type as ClassifierResultType,
          fileBytes,
        });
      } catch (err) {
        // The file genuinely isn't that type — retrying won't change that, so
        // fail terminally rather than burning the retry budget.
        if (err instanceof ReclassifyUnsupportedError) {
          throw new NonRetriableError(err.message);
        }
        throw err;
      }
    });

    await step.run('mark-completed', async () => {
      await supabase
        .from('ingest_jobs')
        .update({
          status: 'completed',
          phase_message: null,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job_id);
    });

    return { job_id };
  },
);
