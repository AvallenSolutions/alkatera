import { NextRequest, NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/ingest-learning/promote
 *
 * Promote a Smart Upload job's stashed file into the golden eval corpus
 * (ingest-eval-corpus bucket + ingest_eval_cases row). The corpus feeds the
 * offline eval harness (scripts/ingest-eval.ts); files are copied because
 * ingest-staging may be pruned later. Admin-only; corpus files are never
 * injected into any org's classifier prompt.
 *
 * Body: { jobId, expectedType?, notes? } — expectedType defaults to the
 * user-corrected type when the job was reclassified, else the final type.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  try {
    const body = await request.json().catch(() => null);
    const jobId: string | null = typeof body?.jobId === 'string' ? body.jobId : null;
    const expectedTypeOverride: string | null =
      typeof body?.expectedType === 'string' ? body.expectedType : null;
    const notes: string | null = typeof body?.notes === 'string' ? body.notes.slice(0, 500) : null;
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

    const { data: job } = await service
      .from('ingest_jobs')
      .select('id, organization_id, result_type, original_result_type, stash_path, file_name, file_mime')
      .eq('id', jobId)
      .maybeSingle();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (!job.stash_path) {
      return NextResponse.json(
        { error: 'The stashed file for this job has been pruned — nothing to promote.' },
        { status: 410 },
      );
    }

    const { data: blob, error: downloadErr } = await service.storage
      .from('ingest-staging')
      .download(job.stash_path);
    if (downloadErr || !blob) {
      return NextResponse.json(
        { error: 'The stashed file for this job has been pruned — nothing to promote.' },
        { status: 410 },
      );
    }

    // The final result_type on a reclassified job IS the user-corrected type.
    const expectedType = expectedTypeOverride ?? job.result_type ?? 'unsupported';
    const ext = (job.file_name?.split('.').pop() || 'bin').toLowerCase();
    const corpusPath = `${expectedType}/${job.id}.${ext}`;

    const buffer = Buffer.from(await blob.arrayBuffer());
    const { error: uploadErr } = await service.storage
      .from('ingest-eval-corpus')
      .upload(corpusPath, buffer, {
        contentType: job.file_mime || 'application/octet-stream',
        upsert: true,
      });
    if (uploadErr) {
      console.error('[admin/ingest-learning/promote] Upload failed:', uploadErr.message);
      return NextResponse.json({ error: 'Could not copy the file into the corpus' }, { status: 500 });
    }

    const { error: insertErr } = await service.from('ingest_eval_cases').upsert(
      {
        storage_path: corpusPath,
        file_name: job.file_name || 'upload',
        file_mime: job.file_mime,
        expected_type: expectedType,
        original_result_type: job.original_result_type ?? null,
        notes,
        source_org_id: job.organization_id,
        promoted_from_job: job.id,
        promoted_by: auth.user.id,
      },
      { onConflict: 'storage_path' },
    );
    if (insertErr) {
      console.error('[admin/ingest-learning/promote] Insert failed:', insertErr.message);
      return NextResponse.json({ error: 'Could not record the eval case' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, storagePath: corpusPath, expectedType });
  } catch (err: any) {
    console.error('[admin/ingest-learning/promote] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
