import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

/**
 * GET /api/people-culture/training
 * List training records for the authenticated user's organization
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
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();
    const trainingType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('people_training_records')
      .select('*', { count: 'exact' })
      .eq('organization_id', membership.organization_id)
      .eq('reporting_year', year)
      .order('completion_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (trainingType) {
      query = query.eq('training_type', trainingType);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching training records:', error);
      return NextResponse.json({ error: 'Failed to fetch training records' }, { status: 500 });
    }

    // Calculate summary
    const summary = {
      total_records: count || 0,
      total_hours: data?.reduce((sum, r) => sum + (r.total_hours || 0), 0) || 0,
      total_participants: data?.reduce((sum, r) => sum + (r.participants || 0), 0) || 0,
      by_type: {} as Record<string, number>,
    };

    // Count by type
    data?.forEach(record => {
      if (record.training_type) {
        summary.by_type[record.training_type] = (summary.by_type[record.training_type] || 0) + 1;
      }
    });

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      summary,
      year,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Training API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * POST /api/people-culture/training
 * Create a new training record
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
    if (!body.training_name) {
      return NextResponse.json({ error: 'Training name is required' }, { status: 400 });
    }
    if (!body.training_type) {
      return NextResponse.json({ error: 'Training type is required' }, { status: 400 });
    }

    // Validate training type
    const validTypes = ['mandatory', 'professional_development', 'leadership', 'dei', 'health_safety', 'sustainability', 'technical'];
    if (!validTypes.includes(body.training_type)) {
      return NextResponse.json({
        error: `Invalid training type. Must be one of: ${validTypes.join(', ')}`
      }, { status: 400 });
    }

    // Calculate total hours
    const hoursPerParticipant = body.hours_per_participant || 0;
    const participants = body.participants || 0;
    const totalHours = body.total_hours || (hoursPerParticipant * participants);

    // Prepare record data
    const recordData = {
      organization_id: membership.organization_id,
      created_by: user.id,
      training_name: body.training_name,
      training_type: body.training_type,
      description: body.description || null,
      provider_type: body.provider_type || null,
      provider_name: body.provider_name || null,
      delivery_method: body.delivery_method || null,
      hours_per_participant: hoursPerParticipant,
      total_hours: totalHours,
      participants: participants,
      eligible_employees: body.eligible_employees || null,
      start_date: body.start_date || null,
      completion_date: body.completion_date || null,
      reporting_year: body.reporting_year || new Date().getFullYear(),
      certification_awarded: body.certification_awarded || false,
      certification_name: body.certification_name || null,
      cost_per_participant: body.cost_per_participant || null,
      total_cost: body.total_cost || null,
      currency: body.currency || 'GBP',
      completion_rate: body.completion_rate || null,
      satisfaction_score: body.satisfaction_score || null,
    };

    const { data, error } = await supabase
      .from('people_training_records')
      .insert(recordData)
      .select()
      .single();

    if (error) {
      console.error('Error creating training record:', error);
      return NextResponse.json({ error: 'Failed to create training record', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Training API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
