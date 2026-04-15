import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';

/**
 * GET /api/arable-fields/[id]
 * Get a single arable field by ID
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

    const { organizationId, error: orgError } = await resolveUserOrganization(supabase, user);
    if (orgError || !organizationId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('arable_fields')
      .select('*, facilities(id, name)')
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Arable field not found' }, { status: 404 });
    }

    if (data.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[ArableField GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/arable-fields/[id]
 * Update an arable field
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

    const { organizationId, error: orgError } = await resolveUserOrganization(supabase, user);
    if (orgError || !organizationId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    // Verify ownership before update
    const { data: existing } = await supabase
      .from('arable_fields')
      .select('organization_id')
      .eq('id', params.id)
      .single();

    if (!existing || existing.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, organization_id, created_at, ...updateFields } = body;

    const { data, error } = await supabase
      .from('arable_fields')
      .update(updateFields)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('[ArableField PATCH] Update error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[ArableField PATCH] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/arable-fields/[id]
 * Soft-delete an arable field (set is_active = false)
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

    const { organizationId, error: orgError } = await resolveUserOrganization(supabase, user);
    if (orgError || !organizationId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    // Verify ownership before delete
    const { data: existing } = await supabase
      .from('arable_fields')
      .select('organization_id')
      .eq('id', params.id)
      .single();

    if (!existing || existing.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
      .from('arable_fields')
      .update({ is_active: false })
      .eq('id', params.id);

    if (error) {
      console.error('[ArableField DELETE] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[ArableField DELETE] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
