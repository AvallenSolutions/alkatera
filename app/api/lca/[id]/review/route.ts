import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';

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

  // Verify user's org owns this PCF
  const { organizationId, error: orgError } = await resolveUserOrganization(client, user);
  if (orgError || !organizationId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
  }

  const { data: pcf } = await client
    .from('product_carbon_footprints')
    .select('organization_id')
    .eq('id', pcfId)
    .single();

  if (!pcf || pcf.organization_id !== organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
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

  // Verify user's org owns this PCF
  const { organizationId, error: orgError } = await resolveUserOrganization(client, user);
  if (orgError || !organizationId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
  }

  const { data: pcf, error: pcfError } = await client
    .from('product_carbon_footprints')
    .select('organization_id')
    .eq('id', pcfId)
    .single();

  if (pcfError || !pcf) {
    return NextResponse.json({ error: 'LCA not found' }, { status: 404 });
  }

  if (pcf.organization_id !== organizationId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Create review record
  const { data: review, error: reviewError } = await client
    .from('lca_critical_reviews')
    .insert({
      product_carbon_footprint_id: pcfId,
      organization_id: pcf.organization_id,
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

  // Update PCF status
  await client
    .from('product_carbon_footprints')
    .update({ status: 'ready_for_review', updated_at: new Date().toISOString() })
    .eq('id', pcfId);

  return NextResponse.json(review, { status: 201 });
}
