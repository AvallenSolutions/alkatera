import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

/**
 * GET /api/people-culture/compensation
 * List compensation records for the authenticated user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organisation
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();
    const department = searchParams.get('department');
    const employmentType = searchParams.get('employment_type');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('people_employee_compensation')
      .select('*', { count: 'exact' })
      .eq('organization_id', membership.organization_id)
      .eq('reporting_year', year)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (department) {
      query = query.eq('department', department);
    }
    if (employmentType) {
      query = query.eq('employment_type', employmentType);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching compensation data:', error);
      return NextResponse.json({ error: 'Failed to fetch compensation data' }, { status: 500 });
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      limit,
      offset,
      year,
    });
  } catch (error) {
    console.error('Compensation API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * POST /api/people-culture/compensation
 * Create a new compensation record
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organisation
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.employment_type) {
      return NextResponse.json({ error: 'Employment type is required' }, { status: 400 });
    }
    if (!body.annual_salary && !body.hourly_rate) {
      return NextResponse.json({ error: 'Either annual salary or hourly rate is required' }, { status: 400 });
    }

    // Prepare record data
    const recordData = {
      organization_id: membership.organization_id,
      created_by: user.id,
      employee_reference: body.employee_reference || null,
      role_title: body.role_title || null,
      role_level: body.role_level || null,
      department: body.department || null,
      employment_type: body.employment_type,
      contract_type: body.contract_type || null,
      work_location: body.work_location || null,
      work_country: body.work_country || 'United Kingdom',
      work_region: body.work_region || null,
      is_remote: body.is_remote || false,
      annual_salary: body.annual_salary || null,
      hourly_rate: body.hourly_rate || null,
      currency: body.currency || 'GBP',
      hours_per_week: body.hours_per_week || 40,
      bonus_amount: body.bonus_amount || 0,
      bonus_received: body.bonus_received || false,
      gender: body.gender || null,
      reporting_year: body.reporting_year || new Date().getFullYear(),
      effective_date: body.effective_date || new Date().toISOString().split('T')[0],
      data_source: body.data_source || 'manual',
      is_active: true,
    };

    const { data, error } = await supabase
      .from('people_employee_compensation')
      .insert(recordData)
      .select()
      .single();

    if (error) {
      console.error('Error creating compensation record:', error);
      return NextResponse.json({ error: 'Failed to create compensation record', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Compensation API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
