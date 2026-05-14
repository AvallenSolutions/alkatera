import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';

/**
 * GET /api/distributor/documents/[submissionId]
 *
 * Returns the submission row alongside its latest processing job and
 * any extracted_data summary. Scoped to the caller's distributor org;
 * a submission from another org returns 404 (defence in depth — RLS
 * would also catch it).
 */
export async function GET(_request: Request, { params }: { params: { submissionId: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const { data: submission, error } = await auth.supabase
    .from('brand_document_submissions')
    .select(
      'id, brand_profile_id, file_name, file_type, file_size_bytes, document_type, vintage_year, batch_reference, submitter_name, submitter_email, submitter_job_title, notes, processing_status, extracted_data, created_at, updated_at',
    )
    .eq('id', params.submissionId)
    .eq('distributor_org_id', auth.organization.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!submission) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: latestJob } = await auth.supabase
    .from('document_processing_jobs')
    .select('id, status, fields_extracted, fields_conflicted, error_message, started_at, completed_at, created_at')
    .eq('submission_id', submission.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ submission, latest_job: latestJob ?? null });
}
