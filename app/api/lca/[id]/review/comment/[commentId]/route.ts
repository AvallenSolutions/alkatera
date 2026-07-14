import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { verifyPcfAccess } from '@/lib/lca/verify-pcf-access';
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access';

/**
 * PUT /api/lca/[id]/review/comment/[commentId]
 * Update a review comment status (address or reject)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id: pcfId, commentId } = await params;
  const { client, user, error: authError } = await getSupabaseAPIClient();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the caller has access to the PCF's org and may write to it.
  const access = await verifyPcfAccess(client, user, pcfId);
  if (!access.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: access.status });
  }

  const denied = await denyReadOnlyAdvisor(client, user, access.organizationId);
  if (denied) return denied;

  // SECURITY: the comment must belong to a review OF THIS PCF. The previous
  // version verified the caller owned the pcfId in the URL, then updated the
  // comment by id alone with the service-role client — letting a member of
  // one organisation flip another organisation's critical-review comments to
  // rejected/addressed (gaming the approval gate) by passing any PCF id of
  // their own plus a foreign comment UUID.
  const { data: comment } = await client
    .from('lca_review_comments')
    .select('id, review:lca_critical_reviews!review_id(product_carbon_footprint_id, organization_id)')
    .eq('id', commentId)
    .maybeSingle();

  const commentReview: any = (comment as any)?.review;
  if (
    !comment ||
    !commentReview ||
    commentReview.product_carbon_footprint_id !== pcfId ||
    commentReview.organization_id !== access.organizationId
  ) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }

  const body = await request.json();
  const { status, response } = body;

  if (!status || !['open', 'addressed', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  if (response && (typeof response !== 'string' || response.length > 5000)) {
    return NextResponse.json({ error: 'Response too long (max 5000 characters)' }, { status: 400 });
  }

  const updateData: any = { status };
  if (response) {
    updateData.response = response;
    updateData.responded_at = new Date().toISOString();
  }

  const { data, error } = await client
    .from('lca_review_comments')
    .update(updateData)
    .eq('id', commentId)
    .select()
    .single();

  if (error) {
    console.error('Error updating review comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json(data);
}
