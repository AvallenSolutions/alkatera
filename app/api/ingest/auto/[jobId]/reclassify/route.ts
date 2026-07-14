import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access';
import {
  extractWithForcedTool,
  shapeIngestResult,
  RECLASSIFY_TARGETS,
  type ClassifierResultType,
} from '@/lib/ingest/classify-document';
import { buildIngestOrgContext } from '@/lib/ingest/org-context';
import { unwrapResultPayload } from '@/lib/ingest/wire-shape';
import { docSignature } from '@/lib/ingest/doc-signature';
import { sanitiseHintValue } from '@/lib/ingest/feedback-hints';
import { bumpDocumentProfile } from '@/lib/ingest/profile-upsert';

/**
 * POST /api/ingest/auto/[jobId]/reclassify
 *
 * The "Change document type" flow. The classifier picked the wrong type, the
 * user has told us the right one; re-run extraction on the stashed file with
 * the tool for that type forced, overwrite the job's result in place, and
 * record the correction in ingest_feedback (misclassified = true) so
 * type-level errors finally feed the learning loop. The correction is written
 * HERE, server-side, so handoff types that never reach a save still teach the
 * system.
 *
 * A single forced-tool call on a ≤5MB file fits comfortably inside Netlify's
 * sync ceiling — the same budget as the inline classify path.
 */
export const maxDuration = 26;

// Types the user can reclassify to: every Claude-extractable type plus the
// two deterministic parsers.
const VALID_TARGETS = new Set<string>([
  ...Object.keys(RECLASSIFY_TARGETS),
  'bulk_xlsx',
  'smart_meter_csv',
]);

const MAX_RECLASSIFY_BYTES = 5 * 1024 * 1024;
const MAX_RECLASSIFIES_PER_JOB = 3;

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const targetType: string | null = typeof body?.targetType === 'string' ? body.targetType : null;
    if (!targetType || !VALID_TARGETS.has(targetType)) {
      return NextResponse.json({ error: 'Unknown document type' }, { status: 400 });
    }

    const { data: job } = await supabase
      .from('ingest_jobs')
      .select(
        'id, user_id, organization_id, status, result_type, result_payload, original_result_type, reclassify_count, stash_path, file_name, file_mime',
      )
      .eq('id', params.jobId)
      .maybeSingle();

    // Same ownership rule as the feedback route: a job you didn't create is
    // indistinguishable from one that doesn't exist.
    if (!job || job.user_id !== user.id) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const denied = await denyReadOnlyAdvisor(supabase, user, job.organization_id);
    if (denied) return denied;

    if (job.status !== 'completed') {
      return NextResponse.json({ error: 'This document has not finished processing yet.' }, { status: 409 });
    }
    if (targetType === job.result_type) {
      return NextResponse.json({ error: 'The document already has this type.' }, { status: 400 });
    }
    if ((job.reclassify_count ?? 0) >= MAX_RECLASSIFIES_PER_JOB) {
      return NextResponse.json(
        {
          error:
            'You have changed the type for this document three times. Upload it again, or contact support if it keeps being misread.',
        },
        { status: 429 },
      );
    }
    if (!job.stash_path) {
      return NextResponse.json(
        { error: 'The original file is no longer available. Upload it again to change the type.' },
        { status: 410 },
      );
    }

    const { data: blob, error: downloadErr } = await supabase.storage
      .from('ingest-staging')
      .download(job.stash_path);
    if (downloadErr || !blob) {
      return NextResponse.json(
        { error: 'The original file is no longer available. Upload it again to change the type.' },
        { status: 410 },
      );
    }
    const fileBytes = new Uint8Array(await blob.arrayBuffer());
    if (fileBytes.byteLength > MAX_RECLASSIFY_BYTES) {
      return NextResponse.json(
        { error: 'This file is too large to re-read inline. Upload it again and pick the type from the result.' },
        { status: 413 },
      );
    }

    // Org context hints help the forced extraction too; a failure degrades to
    // extraction without hints, exactly like the classify path.
    const orgContext = await buildIngestOrgContext(supabase, job.organization_id).catch(() => null);

    const result = await extractWithForcedTool({
      fileBytes,
      fileName: job.file_name || 'upload',
      fileMime: job.file_mime || '',
      orgContext: orgContext ?? undefined,
      targetType: targetType as ClassifierResultType,
    });

    if (result.type === 'unsupported') {
      // The forced extraction could not read the file as the chosen type
      // (e.g. smart_meter_csv on a non-meter file). Leave the job untouched.
      return NextResponse.json(
        { error: (result.payload as { reason?: string })?.reason || 'Could not re-read the document as that type.' },
        { status: 422 },
      );
    }

    const shaped = shapeIngestResult(result.type, result.payload, job.stash_path, result.meta);
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
      console.error('[ingest/reclassify] Job update failed:', updateErr.message);
      return NextResponse.json({ error: 'Could not save the new document type' }, { status: 500 });
    }

    // Record the type correction now, server-side: handoff types never fire a
    // save, and this signal is the whole point of the flow. A later save on
    // the same job updates this row with the field-level diff.
    const correctionRow = {
      job_id: job.id,
      organization_id: job.organization_id,
      user_id: user.id,
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
      // Best-effort: the reclassify itself succeeded.
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

    return NextResponse.json({
      resultType: shaped.result_type,
      result: shaped.result_payload,
    });
  } catch (err: any) {
    console.error('[ingest/reclassify] Error:', err);
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
