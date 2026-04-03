import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';

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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
