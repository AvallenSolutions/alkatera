import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access';
import {
  RECLASSIFY_TARGETS,
  type ClassifierResultType,
} from '@/lib/ingest/classify-document';
import {
  runReclassify,
  ReclassifyUnsupportedError,
  MAX_SYNC_RECLASSIFY_BYTES,
} from '@/lib/ingest/reclassify';
import { inngest } from '@/lib/inngest/client';

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
 * A forced-tool call on a small file fits comfortably inside the sync ceiling,
 * so those re-read here and return the new result immediately. Larger files
 * (above MAX_SYNC_RECLASSIFY_BYTES) would blow that budget, so they are handed
 * to the `ingest/reclassify.run` Inngest background function and the client
 * polls the job — no more "too large, edit by hand" dead end.
 */
export const maxDuration = 26;

// Types the user can reclassify to: every Claude-extractable type plus the
// two deterministic parsers.
const VALID_TARGETS = new Set<string>([
  ...Object.keys(RECLASSIFY_TARGETS),
  'bulk_xlsx',
  'smart_meter_csv',
]);

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

    // Large files would blow the sync ceiling on a forced re-extraction. Hand
    // them to the Inngest background function and let the client poll the job.
    // Flip status to 'extracting' so the existing poll endpoint + dropzone UI
    // drive the wait, and so a second concurrent reclassify is blocked (the
    // 'completed' precondition above) until this one finishes.
    if (fileBytes.byteLength > MAX_SYNC_RECLASSIFY_BYTES) {
      const { error: statusErr } = await supabase
        .from('ingest_jobs')
        .update({
          status: 'extracting',
          phase_message: 'Re-reading the document…',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      if (statusErr) {
        console.error('[ingest/reclassify] Could not mark job extracting:', statusErr.message);
        return NextResponse.json({ error: 'Could not start re-reading this document' }, { status: 500 });
      }
      // Fire the background job. Missing Inngest env no-ops the send; the poll
      // endpoint's terminal-timeout rescue then marks the job failed after 3
      // minutes rather than leaving it stuck.
      await inngest.send({
        name: 'ingest/reclassify.run',
        data: { job_id: job.id, target_type: targetType },
      });
      return NextResponse.json({ jobId: job.id, background: true }, { status: 202 });
    }

    try {
      const shaped = await runReclassify({
        supabase,
        job,
        targetType: targetType as ClassifierResultType,
        fileBytes,
      });
      return NextResponse.json({
        resultType: shaped.result_type,
        result: shaped.result_payload,
      });
    } catch (err) {
      if (err instanceof ReclassifyUnsupportedError) {
        // The forced extraction could not read the file as the chosen type
        // (e.g. smart_meter_csv on a non-meter file). Leave the job untouched.
        return NextResponse.json({ error: err.message }, { status: 422 });
      }
      throw err;
    }
  } catch (err: any) {
    console.error('[ingest/reclassify] Error:', err);
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
