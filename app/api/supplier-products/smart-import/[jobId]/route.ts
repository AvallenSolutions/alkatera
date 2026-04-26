import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

export const runtime = 'nodejs';

/**
 * GET /api/supplier-products/smart-import/[jobId]
 *
 * Returns the job's current status, phase message, extracted products, and
 * any error. Authorisation: caller must be the job's user, or a member of
 * the job's organisation (matches the RLS policy on the table).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } },
) {
  try {
    const { client, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = params;
    if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 });

    const { data: job, error } = await (client as any)
      .from('supplier_product_import_jobs')
      .select(
        'id, supplier_id, user_id, organization_id, status, phase_message, extracted_products, error, created_at, updated_at'
      )
      .eq('id', jobId)
      .maybeSingle();

    if (error) {
      console.error('[smart-import poll] read failed:', error);
      return NextResponse.json({ error: 'Failed to read job' }, { status: 500 });
    }
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    // Authorise: owner of the job or member of the job's org.
    if (job.user_id !== user.id) {
      let isOrgMember = false;
      if (job.organization_id) {
        const { data: membership } = await (client as any)
          .from('organization_members')
          .select('id')
          .eq('organization_id', job.organization_id)
          .eq('user_id', user.id)
          .maybeSingle();
        isOrgMember = !!membership;
      }
      if (!isOrgMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      phaseMessage: job.phase_message,
      products: job.extracted_products?.products ?? [],
      unmapped: job.extracted_products?.unmapped ?? [],
      modeUsed: job.extracted_products?.mode_used ?? null,
      error: job.error,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    });
  } catch (error: any) {
    console.error('[smart-import poll] error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to read job' }, { status: 500 });
  }
}
