import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { verifyPcfAccess } from '@/lib/lca/verify-pcf-access';
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access';

/**
 * GET /api/lca/[id]/review
 * Get critical review status and details for a PCF
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pcfId } = await params;
  const { client, user, error: authError } = await getSupabaseAPIClient();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Advisor-aware access check (resolveUserOrganization locked advisors out
  // of review reads even when they had legitimate access to the client org).
  const access = await verifyPcfAccess(client, user, pcfId);
  if (!access.ok) {
    return NextResponse.json({ error: 'Not found' }, { status: access.status });
  }

  const { data: review, error } = await client
    .from('lca_critical_reviews')
    .select(`
      *,
      reviewers:lca_reviewers(*),
      comments:lca_review_comments(*, reviewer:lca_reviewers(name, email))
    `)
    .eq('product_carbon_footprint_id', pcfId)
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (error) {
    console.error('Error fetching LCA review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  if (!review) {
    return NextResponse.json({ error: 'No review found for this LCA' }, { status: 404 });
  }

  return NextResponse.json(review);
}

/**
 * POST /api/lca/[id]/review
 * Initiate a critical review for a PCF
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pcfId } = await params;
  const { client, user, error: authError } = await getSupabaseAPIClient();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { review_type, reviewers } = body;

  if (!review_type || !['internal', 'external'].includes(review_type)) {
    return NextResponse.json({ error: 'Invalid review_type' }, { status: 400 });
  }

  // Verify the caller has access to the PCF's org and may write to it
  const access = await verifyPcfAccess(client, user, pcfId);
  if (!access.ok) {
    return NextResponse.json({ error: 'LCA not found' }, { status: access.status });
  }

  const denied = await denyReadOnlyAdvisor(client, user, access.organizationId);
  if (denied) return denied;

  // Create review record
  const { data: review, error: reviewError } = await client
    .from('lca_critical_reviews')
    .insert({
      product_carbon_footprint_id: pcfId,
      organization_id: access.organizationId,
      review_type,
      status: 'pending',
      review_start_date: new Date().toISOString(),
    })
    .select()
    .single();

  if (reviewError || !review) {
    console.error('Failed to create review:', reviewError);
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }

  // Add reviewers if provided
  if (reviewers && Array.isArray(reviewers) && reviewers.length > 0) {
    const reviewerRecords = reviewers.map((r: any) => ({
      review_id: review.id,
      name: r.name,
      email: r.email || null,
      organisation: r.organisation || null,
      qualifications: r.qualifications || [],
      reviewer_type: r.reviewer_type || 'internal',
      independence_declared: r.independence_declared || false,
      conflict_of_interest_statement: r.conflict_of_interest_statement || null,
    }));

    const { error: reviewersError } = await client
      .from('lca_reviewers')
      .insert(reviewerRecords);

    if (reviewersError) {
      console.error('Failed to insert reviewers:', reviewersError);
    }
  }

  // Review state lives in its own column: writing 'ready_for_review' into
  // status violated the lifecycle CHECK constraint (silently, since the
  // error was never inspected), and would have hidden the PCF from every
  // consumer filtering on status='completed' had it succeeded.
  const { error: statusError } = await client
    .from('product_carbon_footprints')
    .update({ review_status: 'ready_for_review', updated_at: new Date().toISOString() })
    .eq('id', pcfId);

  if (statusError) {
    console.error('Failed to set review_status:', statusError);
    return NextResponse.json({ error: 'Review created but its status could not be recorded. Please retry.' }, { status: 500 });
  }

  return NextResponse.json(review, { status: 201 });
}
