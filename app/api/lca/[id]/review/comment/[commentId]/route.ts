import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * PUT /api/lca/[id]/review/comment/[commentId]
 * Update a review comment status (address or reject)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { commentId } = await params;
  const { client, user, error: authError } = await getSupabaseAPIClient();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { status, response } = body;

  if (!status || !['open', 'addressed', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
