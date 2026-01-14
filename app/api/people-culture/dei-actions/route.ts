import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

/**
 * GET /api/people-culture/dei-actions
 * List DEI actions for the authenticated user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('people_dei_actions')
      .select('*', { count: 'exact' })
      .eq('organization_id', membership.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (category) {
      query = query.eq('action_category', category);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching DEI actions:', error);
      return NextResponse.json({ error: 'Failed to fetch DEI actions' }, { status: 500 });
    }

    // Calculate summary stats
    const summary = {
      total: count || 0,
      by_status: {
        planned: data?.filter(a => a.status === 'planned').length || 0,
        in_progress: data?.filter(a => a.status === 'in_progress').length || 0,
        completed: data?.filter(a => a.status === 'completed').length || 0,
        on_hold: data?.filter(a => a.status === 'on_hold').length || 0,
      },
    };

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      summary,
      limit,
      offset,
    });
  } catch (error) {
    console.error('DEI Actions API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * POST /api/people-culture/dei-actions
 * Create a new DEI action
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.action_name) {
      return NextResponse.json({ error: 'Action name is required' }, { status: 400 });
    }
    if (!body.action_category) {
      return NextResponse.json({ error: 'Action category is required' }, { status: 400 });
    }

    // Validate category
    const validCategories = ['recruitment', 'retention', 'development', 'culture', 'accessibility', 'policy'];
    if (!validCategories.includes(body.action_category)) {
      return NextResponse.json({
        error: `Invalid action category. Must be one of: ${validCategories.join(', ')}`
      }, { status: 400 });
    }

    // Prepare record data
    const recordData = {
      organization_id: membership.organization_id,
      created_by: user.id,
      action_name: body.action_name,
      action_category: body.action_category,
      description: body.description || null,
      target_group: body.target_group || null,
      status: body.status || 'planned',
      priority: body.priority || 'medium',
      start_date: body.start_date || null,
      target_date: body.target_date || null,
      completion_date: body.completion_date || null,
      owner_name: body.owner_name || null,
      owner_department: body.owner_department || null,
      success_metrics: body.success_metrics || null,
      outcomes_achieved: body.outcomes_achieved || null,
      evidence_links: body.evidence_links || [],
      bcorp_requirement_id: body.bcorp_requirement_id || null,
    };

    const { data, error } = await supabase
      .from('people_dei_actions')
      .insert(recordData)
      .select()
      .single();

    if (error) {
      console.error('Error creating DEI action:', error);
      return NextResponse.json({ error: 'Failed to create DEI action', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('DEI Actions API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * PUT /api/people-culture/dei-actions
 * Update an existing DEI action (id passed in body)
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Action ID is required' }, { status: 400 });
    }

    // Remove fields that shouldn't be updated
    const { id, organization_id, created_by, created_at, ...updateData } = body;

    // Add updated_at
    const recordUpdate = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('people_dei_actions')
      .update(recordUpdate)
      .eq('id', id)
      .eq('organization_id', membership.organization_id) // Ensure user can only update their org's data
      .select()
      .single();

    if (error) {
      console.error('Error updating DEI action:', error);
      return NextResponse.json({ error: 'Failed to update DEI action', details: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'DEI action not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('DEI Actions API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
