import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';

/**
 * POST /api/distributor/documents/[submissionId]/retry
 *
 * Requeues a failed document submission for processing. Only errored
 * submissions can be retried (re-running a successful one would duplicate
 * findings). Inserts a fresh queued document_processing_job — the
 * process-document-queue cron (every 2 min) picks it up and re-extracts —
 * and resets the submission status to pending. Owner / data_manager only.
 */
export async function POST(_request: Request, { params }: { params: { submissionId: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data: submission } = await auth.supabase
    .from('brand_document_submissions')
    .select('id, brand_profile_id, processing_status')
    .eq('id', params.submissionId)
    .eq('distributor_org_id', auth.organization.id)
    .maybeSingle();
  if (!submission) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const sub = submission as {
    id: string;
    brand_profile_id: string;
    processing_status: string;
  };
  if (sub.processing_status !== 'error') {
    return NextResponse.json({ error: 'not_retryable' }, { status: 409 });
  }

  const { error: jobError } = await auth.supabase.from('document_processing_jobs').insert({
    submission_id: sub.id,
    brand_profile_id: sub.brand_profile_id,
    status: 'queued',
  });
  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  await auth.supabase
    .from('brand_document_submissions')
    .update({ processing_status: 'pending' })
    .eq('id', sub.id);

  return NextResponse.json({ ok: true });
}
