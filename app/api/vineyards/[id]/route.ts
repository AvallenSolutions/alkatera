import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * GET /api/vineyards/[id]
 * Get a single vineyard by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('vineyards')
      .select('*, facilities(id, name)')
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Vineyard not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[Vineyard GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/vineyards/[id]
 * Update a vineyard
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();

    // Remove fields that shouldn't be updated directly
    const { id, organization_id, created_at, ...updateFields } = body;

    const { data, error } = await supabase
      .from('vineyards')
      .update(updateFields)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('[Vineyard PATCH] Update error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Vineyard PATCH] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/vineyards/[id]
 * Soft-delete a vineyard (set is_active = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { error } = await supabase
      .from('vineyards')
      .update({ is_active: false })
      .eq('id', params.id);

    if (error) {
      console.error('[Vineyard DELETE] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Vineyard DELETE] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
