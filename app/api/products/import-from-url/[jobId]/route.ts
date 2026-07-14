import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const { client, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: job, error } = await (client as any)
    .from('product_import_jobs')
    .select('id, user_id, status, phase_message, pages_analyzed, products, org_certifications, org_description, brand_metadata, error, updated_at')
    .eq('id', params.jobId)
    .maybeSingle();

  if (error || !job || job.user_id !== user.id) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Janitor: a dropped background dispatch (or a worker that died before
  // writing a terminal status) leaves the job stuck in a non-terminal state
  // forever. If it hasn't advanced in 20 minutes (past the worker's 15-min
  // budget), mark it failed so the client stops polling and can retry.
  let status = job.status;
  let jobError = job.error;
  const NON_TERMINAL = ['pending', 'scraping', 'extracting'];
  if (NON_TERMINAL.includes(status)) {
    const ageMs = Date.now() - new Date(job.updated_at).getTime();
    if (ageMs > 20 * 60 * 1000) {
      status = 'failed';
      jobError = 'The import took too long and was stopped. Please try again.';
      await (client as any)
        .from('product_import_jobs')
        .update({ status, error: jobError })
        .eq('id', job.id);
    }
  }

  return NextResponse.json({
    status,
    phaseMessage: job.phase_message,
    pagesAnalyzed: job.pages_analyzed,
    products: job.products ?? null,
    orgCertifications: job.org_certifications ?? [],
    orgDescription: job.org_description ?? null,
    brandMetadata: job.brand_metadata ?? null,
    error: jobError,
  });
}
