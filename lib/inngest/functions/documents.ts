import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { processDocument } from '@/lib/distributor/document-processing/processor';

/**
 * Document processing queue, on Inngest. Replaces
 * `/api/cron/process-document-queue` as the primary path. Same
 * claim + fan-out pattern as scraping; each PDF / Excel / image
 * extraction gets its own retry envelope so a single corrupted file
 * can't kill the rest of the batch.
 *
 * Note: the PDF extractor itself is bounded inside processDocument
 * (download → parse → LLM), so individual steps are reliably under
 * a minute. The win over the old cron is independent retries and
 * step-level observability — we'll be able to see exactly which
 * document failed and what its error message was, instead of having
 * to grep cron logs.
 */

const MAX_DOCS_PER_TICK = 12;
const STALE_MS = 5 * 60 * 1000;

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface DocJobRow {
  id: string;
  submission_id: string;
  brand_profile_id: string | null;
}

export const documentsQueueTick = inngest.createFunction(
  {
    id: 'documents-queue-tick',
    name: 'Documents queue: claim + fan out',
    concurrency: { limit: 1 },
    retries: 0,
    triggers: [{ event: 'documents/queue.tick' }],
  },
  async ({ step }) => {
    const supabase = service();

    const recoveredCount = await step.run('recover-stale-processing', async () => {
      const cutoff = new Date(Date.now() - STALE_MS).toISOString();
      const { data: recovered } = await supabase
        .from('document_processing_jobs')
        .update({ status: 'queued', started_at: null })
        .eq('status', 'processing')
        .lt('started_at', cutoff)
        .select('id');
      return (recovered ?? []).length;
    });

    const claimed = await step.run('claim-docs', async () => {
      const { data } = await supabase
        .from('document_processing_jobs')
        .select('id, submission_id, brand_profile_id')
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(MAX_DOCS_PER_TICK);
      const rows = (data ?? []) as DocJobRow[];
      if (rows.length === 0) return [] as DocJobRow[];
      await supabase
        .from('document_processing_jobs')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .in('id', rows.map((j) => j.id));
      return rows;
    });

    if (claimed.length === 0) {
      return { recovered_stale: recoveredCount, dispatched: 0 };
    }

    await step.sendEvent(
      'fan-out-doc-runs',
      claimed.map((job: DocJobRow) => ({
        name: 'documents/process.one',
        data: { submission_id: job.submission_id, job_id: job.id },
      })),
    );

    return { recovered_stale: recoveredCount, dispatched: claimed.length };
  },
);

export const documentsProcessOne = inngest.createFunction(
  {
    id: 'documents-process-one',
    name: 'Process one document',
    concurrency: { limit: 4 },
    retries: 2,
    triggers: [{ event: 'documents/process.one' }],
  },
  async ({ event, step }) => {
    const supabase = service();
    const eventData = event.data as { submission_id: string; job_id: string };
    const { submission_id, job_id } = eventData;

    const result = await step.run('process-document', async () => {
      try {
        const r = await processDocument({
          supabase,
          submissionId: submission_id,
          jobId: job_id,
        });
        return { ...r, threwMessage: null as string | null };
      } catch (err: unknown) {
        return {
          ok: false,
          fields_extracted: 0,
          fields_conflicted: 0,
          errors: [] as string[],
          threwMessage: err instanceof Error ? err.message : String(err),
        };
      }
    });

    await step.run('persist-job-status', async () => {
      const finalStatus =
        result.threwMessage || (!result.ok && result.fields_extracted === 0)
          ? 'error'
          : 'complete';
      const trimmedErrors = [
        ...(result.threwMessage ? [result.threwMessage] : []),
        ...result.errors.slice(0, 5),
      ].join('\n');
      await supabase
        .from('document_processing_jobs')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          fields_extracted: result.fields_extracted,
          fields_conflicted: result.fields_conflicted,
          error_message: trimmedErrors || null,
        })
        .eq('id', job_id);
    });

    return {
      job_id,
      fields_extracted: result.fields_extracted,
      ok: result.ok,
    };
  },
);
