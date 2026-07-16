import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { verifyPcfAccess } from '@/lib/lca/verify-pcf-access';
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access';

/**
 * POST /api/lca/[id]/review/statement
 * Submit the final reviewer statement
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
  const access = await verifyPcfAccess(client, user, pcfId);
  if (!access.ok) {
    return NextResponse.json({ error: 'Not found' }, { status: access.status });
  }

  const denied = await denyReadOnlyAdvisor(client, user, access.organizationId);
  if (denied) return denied;

  const body = await request.json();
  const { statement } = body;

  if (!statement) {
    return NextResponse.json({ error: 'statement is required' }, { status: 400 });
  }

  // Get the active review
  const { data: review, error: reviewError } = await client
    .from('lca_critical_reviews')
    .select('id')
    .eq('product_carbon_footprint_id', pcfId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reviewError || !review) {
    return NextResponse.json({ error: 'No review found' }, { status: 404 });
  }

  const { error: updateError } = await client
    .from('lca_critical_reviews')
    .update({
      reviewer_statement: statement,
      updated_at: new Date().toISOString(),
    })
    .eq('id', review.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
