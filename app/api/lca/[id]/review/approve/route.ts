import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { verifyPcfAccess } from '@/lib/lca/verify-pcf-access';
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access';

/**
 * POST /api/lca/[id]/review/approve
 * Approve a critical review
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

  // Verify the caller has access to the PCF's org before mutating its review.
  // The service-role client bypasses RLS, so this app-level check is required.
  const access = await verifyPcfAccess(client, user, pcfId);
  if (!access.ok) {
    return NextResponse.json({ error: 'Not found' }, { status: access.status });
  }

  const denied = await denyReadOnlyAdvisor(client, user, access.organizationId);
  if (denied) return denied;

  // Get the active review
  const { data: review, error: reviewError } = await client
    .from('lca_critical_reviews')
    .select('id, status')
    .eq('product_carbon_footprint_id', pcfId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reviewError || !review) {
    return NextResponse.json({ error: 'No review found' }, { status: 404 });
  }

  // Check for unresolved critical comments
  const { data: openCritical } = await client
    .from('lca_review_comments')
    .select('id')
    .eq('review_id', review.id)
    .eq('severity', 'critical')
    .eq('status', 'open');

  if (openCritical && openCritical.length > 0) {
    return NextResponse.json(
      { error: `Cannot approve: ${openCritical.length} unresolved critical comment(s)` },
      { status: 400 }
    );
  }

  // Approve the review
  const { error: updateError } = await client
    .from('lca_critical_reviews')
    .update({
      status: 'approved',
      is_approved: true,
      review_end_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', review.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Review state lives in review_status: writing 'approved' into the
  // lifecycle status column violated its CHECK constraint (silently), and
  // would have hidden the approved PCF from every status='completed'
  // consumer (multipacks, pinned factors, product pages) had it succeeded.
  const { error: statusError } = await client
    .from('product_carbon_footprints')
    .update({ review_status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', pcfId);

  if (statusError) {
    console.error('Failed to set review_status:', statusError);
    return NextResponse.json({ error: 'Review approved but its status could not be recorded. Please retry.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, status: 'approved' });
}
