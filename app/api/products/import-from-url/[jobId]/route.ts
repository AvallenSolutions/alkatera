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
    .select('id, user_id, status, phase_message, pages_analyzed, products, org_certifications, org_description, error')
    .eq('id', params.jobId)
    .maybeSingle();

  if (error || !job || job.user_id !== user.id) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({
    status: job.status,
    phaseMessage: job.phase_message,
    pagesAnalyzed: job.pages_analyzed,
    products: job.products ?? null,
    orgCertifications: job.org_certifications ?? [],
    orgDescription: job.org_description ?? null,
    error: job.error,
  });
}
