import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { classifyDocument, shapeIngestResult } from '@/lib/ingest/classify-document';
import { buildIngestOrgContext } from '@/lib/ingest/org-context';

/**
 * Core worker for Smart Upload's background classification path — ported
 * verbatim from `netlify/functions/ingest-auto-background.ts` onto Inngest
 * (`lib/inngest/functions/product-import.ts`, event `ingest/auto.run`).
 *
 * Downloads the already-stashed file for an `ingest_jobs` row from
 * `ingest-staging`, runs the classifier, and writes the result back onto the
 * row. The client polls `/api/ingest/auto/[jobId]` for completion. Used for
 * files too large / too many PDF pages for the synchronous inline path in
 * `lib/ingest/enqueue.ts`.
 */
export async function classifyIngestJob(params: {
  supabase: SupabaseClient;
  jobId: string;
}): Promise<void> {
  const { supabase, jobId } = params;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const updateJob = async (patch: Record<string, any>) => {
    await supabase
      .from('ingest_jobs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  };

  // classifyDocument runs on Anthropic/Claude, not Gemini, so the hard
  // requirement here is ANTHROPIC_API_KEY.
  if (!anthropicKey) {
    console.error('[ingest/auto] Missing ANTHROPIC_API_KEY');
    await updateJob({ status: 'failed', error: 'Ingest service not configured' });
    return;
  }

  try {
    const { data: job, error: jobErr } = await supabase
      .from('ingest_jobs')
      .select('id, organization_id, stash_path, file_name, file_mime')
      .eq('id', jobId)
      .maybeSingle();

    if (jobErr || !job) {
      console.error('[ingest/auto] Job not found:', jobErr?.message);
      return;
    }

    await updateJob({ status: 'extracting', phase_message: 'Reading the document…' });

    // Org context (learned document profiles + org facts) fetches in parallel
    // with the storage download; a failure or timeout degrades to null and
    // the document classifies without hints.
    const [{ data: download, error: dlErr }, orgContext] = await Promise.all([
      supabase.storage.from('ingest-staging').download(job.stash_path),
      buildIngestOrgContext(supabase, job.organization_id).catch(() => null),
    ]);
    if (dlErr || !download) {
      await updateJob({
        status: 'failed',
        error: 'Could not read the uploaded file from staging storage.',
      });
      return;
    }

    const fileBytes = new Uint8Array(await download.arrayBuffer());

    await updateJob({ phase_message: 'Identifying the document with AI…' });

    const result = await classifyDocument({
      fileBytes,
      fileName: job.file_name,
      fileMime: job.file_mime || '',
      orgContext: orgContext ?? undefined,
    });

    const shaped = shapeIngestResult(result.type, result.payload, job.stash_path, result.meta);

    await updateJob({
      status: 'completed',
      phase_message: null,
      result_type: shaped.result_type,
      result_payload: shaped.result_payload,
    });
  } catch (error: any) {
    console.error('[ingest/auto] Error:', error);
    await updateJob({
      status: 'failed',
      error: error?.message?.slice(0, 500) || 'Failed to classify document',
    });
  }
}
