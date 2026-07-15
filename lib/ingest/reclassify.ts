import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  extractWithForcedTool,
  shapeIngestResult,
  type ClassifierResultType,
} from '@/lib/ingest/classify-document';
import { buildIngestOrgContext } from '@/lib/ingest/org-context';
import { unwrapResultPayload } from '@/lib/ingest/wire-shape';
import { docSignature } from '@/lib/ingest/doc-signature';
import { sanitiseHintValue } from '@/lib/ingest/feedback-hints';
import { bumpDocumentProfile } from '@/lib/ingest/profile-upsert';

/**
 * Files at or below this re-read synchronously inside the request (comfortably
 * within the sync ceiling). Larger files run the forced extraction in the
 * `ingest/reclassify.run` Inngest background function instead.
 */
export const MAX_SYNC_RECLASSIFY_BYTES = 5 * 1024 * 1024;

/** The job columns runReclassify needs. Both callers select exactly these. */
export interface ReclassifyJob {
  id: string;
  organization_id: string;
  user_id: string;
  result_type: string | null;
  result_payload: unknown;
  original_result_type: string | null;
  reclassify_count: number | null;
  stash_path: string | null;
  file_name: string | null;
  file_mime: string | null;
}

/**
 * The forced extraction could not read the file as the chosen type (e.g.
 * smart_meter_csv on a non-meter file). Terminal — retrying will not help, so
 * the sync route maps it to a 422 and the background function marks the job
 * failed without burning its retries.
 */
export class ReclassifyUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReclassifyUnsupportedError';
  }
}

/**
 * Re-run extraction on an already-stashed ingest file with the tool for a
 * chosen type forced, overwrite the job's result in place, and record the
 * type correction (misclassified = true) so type-level errors feed the
 * learning loop.
 *
 * Shared by the sync reclassify route (small files) and the Inngest background
 * function (large files) so both paths write identical rows. It deliberately
 * does NOT touch ingest_jobs.status — the caller owns the status lifecycle
 * (the sync path leaves it 'completed'; the background path flips
 * 'extracting' → 'completed').
 */
export async function runReclassify(opts: {
  supabase: SupabaseClient;
  job: ReclassifyJob;
  targetType: ClassifierResultType;
  fileBytes: Uint8Array;
}): Promise<{ result_type: string; result_payload: Record<string, unknown> }> {
  const { supabase, job, targetType, fileBytes } = opts;

  // Org context hints help the forced extraction too; a failure degrades to
  // extraction without hints, exactly like the classify path.
  const orgContext = await buildIngestOrgContext(supabase, job.organization_id).catch(() => null);

  const result = await extractWithForcedTool({
    fileBytes,
    fileName: job.file_name || 'upload',
    fileMime: job.file_mime || '',
    orgContext: orgContext ?? undefined,
    targetType,
  });

  if (result.type === 'unsupported') {
    throw new ReclassifyUnsupportedError(
      (result.payload as { reason?: string })?.reason ||
        'Could not re-read the document as that type.',
    );
  }

  const shaped = shapeIngestResult(result.type, result.payload, job.stash_path || '', result.meta);
  const originalType = job.original_result_type ?? job.result_type;

  const { error: updateErr } = await supabase
    .from('ingest_jobs')
    .update({
      result_type: shaped.result_type,
      result_payload: shaped.result_payload,
      original_result_type: originalType,
      reclassify_count: (job.reclassify_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);
  if (updateErr) {
    throw new Error(`Could not save the new document type: ${updateErr.message}`);
  }

  // Record the type correction now, server-side: handoff types never fire a
  // save, and this signal is the whole point of the flow. A later save on the
  // same job updates this row with the field-level diff. Best-effort — the
  // reclassify itself has already succeeded.
  const correctionRow = {
    job_id: job.id,
    organization_id: job.organization_id,
    user_id: job.user_id,
    result_type: originalType,
    corrected_result_type: shaped.result_type,
    misclassified: true,
    classifier_payload: unwrapResultPayload(job.result_type, job.result_payload),
    saved_payload: {},
    field_diff: {},
    context: {},
  };
  const { data: existing } = await supabase
    .from('ingest_feedback')
    .select('id')
    .eq('job_id', job.id)
    .maybeSingle();
  const { error: feedbackErr } = existing
    ? await supabase
        .from('ingest_feedback')
        .update({
          result_type: originalType,
          corrected_result_type: shaped.result_type,
          misclassified: true,
        })
        .eq('id', existing.id)
    : await supabase.from('ingest_feedback').insert(correctionRow);
  if (feedbackErr) {
    console.error('[ingest/reclassify] Feedback write failed:', feedbackErr.message);
  }

  // Filename-keyed learning: remember that files named like this are the
  // corrected type, so the classifier gets it right next time (injected via
  // org-context's corrected_documents block).
  const signature = docSignature(job.file_name || '');
  if (signature) {
    await bumpDocumentProfile(supabase, {
      organizationId: job.organization_id,
      matchKind: 'filename',
      supplierKey: signature,
      resultType: shaped.result_type,
      hints: {
        corrected_from: originalType,
        filename_example: sanitiseHintValue(job.file_name) ?? undefined,
      },
    }).catch((err) => console.error('[ingest/reclassify] Profile write failed:', err?.message));
  }

  return { result_type: shaped.result_type, result_payload: shaped.result_payload };
}
