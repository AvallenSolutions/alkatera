import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

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
