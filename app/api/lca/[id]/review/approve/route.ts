import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';

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

  // Verify the caller's org owns this PCF before mutating its review.
  // The service-role client bypasses RLS, so this app-level check is required.
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

  // Update PCF status
  await client
    .from('product_carbon_footprints')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', pcfId);

  return NextResponse.json({ success: true, status: 'approved' });
}
