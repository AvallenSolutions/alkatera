import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';

/**
 * POST /api/lca/[id]/review/comment
 * Add a review comment to a critical review
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

  // Verify the caller's org owns this PCF before mutating its review.
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

  const body = await request.json();
  const { section, comment, severity, reviewer_id } = body;

  if (!section || !comment) {
    return NextResponse.json({ error: 'section and comment are required' }, { status: 400 });
  }

  // Get the active review for this PCF
  const { data: review, error: reviewError } = await client
    .from('lca_critical_reviews')
    .select('id, status')
    .eq('product_carbon_footprint_id', pcfId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reviewError || !review) {
    return NextResponse.json({ error: 'No active review found for this LCA' }, { status: 404 });
  }

  const { data: commentData, error: commentError } = await client
    .from('lca_review_comments')
    .insert({
      review_id: review.id,
      reviewer_id: reviewer_id || null,
      section,
      comment,
      severity: severity || 'minor',
      status: 'open',
    })
    .select()
    .single();

  if (commentError) {
    return NextResponse.json({ error: commentError.message }, { status: 500 });
  }

  // Update review status to in_progress if still pending
  if (review.status === 'pending') {
    await client
      .from('lca_critical_reviews')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', review.id);
  }

  return NextResponse.json(commentData, { status: 201 });
}
