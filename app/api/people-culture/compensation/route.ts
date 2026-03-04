import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * GET /api/people-culture/compensation
 * List compensation records for the authenticated user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      console.error('[Compensation GET] Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organisation from metadata or first membership
    let organizationId = user.user_metadata?.current_organization_id;

    if (!organizationId) {
      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberError || !membership) {
        return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
      }
      organizationId = membership.organization_id;
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
      .eq('organization_id', organizationId)
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
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError) {
      console.error('[Compensation API] Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized', details: authError.message }, { status: 401 });
    }
    if (!user) {
      console.error('[Compensation API] No user found');
      return NextResponse.json({ error: 'Unauthorized', details: 'No user session' }, { status: 401 });
    }
    // Get user's current organisation from metadata or first membership
    let organizationId = user.user_metadata?.current_organization_id;
    if (!organizationId) {
      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberError) {
        console.error('[Compensation API] Error fetching membership:', memberError);
        return NextResponse.json({ error: 'Database error', details: memberError.message }, { status: 500 });
      }
      if (!membership) {
        console.error('[Compensation API] No organization membership found');
        return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
      }
      organizationId = membership.organization_id;
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
      organization_id: organizationId,
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
      console.error('[Compensation API] Error creating compensation record:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json({
        error: 'Failed to create compensation record',
        details: error.message,
        code: error.code,
        hint: error.hint,
        dbDetails: error.details,
      }, { status: 500 });
    }
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Compensation API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * PUT /api/people-culture/compensation
 * Update an existing compensation record
 */
export async function PUT(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let organizationId = user.user_metadata?.current_organization_id;
    if (!organizationId) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (!membership) {
        return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
      }
      organizationId = membership.organization_id;
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
    }

    // Build update object from allowed fields only
    const allowedFields = [
      'employee_reference', 'role_title', 'role_level', 'department',
      'employment_type', 'contract_type', 'work_location', 'work_country',
      'work_region', 'is_remote', 'annual_salary', 'hourly_rate', 'currency',
      'hours_per_week', 'bonus_amount', 'bonus_received', 'gender',
      'reporting_year', 'effective_date',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('people_employee_compensation')
      .update(updateData)
      .eq('id', body.id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error('[Compensation API] Error updating record:', error);
      return NextResponse.json({
        error: 'Failed to update compensation record',
        details: error.message,
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Compensation API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * DELETE /api/people-culture/compensation
 * Soft-delete a compensation record (sets is_active = false for audit trail)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let organizationId = user.user_metadata?.current_organization_id;
    if (!organizationId) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (!membership) {
        return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
      }
      organizationId = membership.organization_id;
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
    }

    // Soft delete — preserve for audit trail
    const { error } = await supabase
      .from('people_employee_compensation')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', body.id)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('[Compensation API] Error deleting record:', error);
      return NextResponse.json({
        error: 'Failed to delete compensation record',
        details: error.message,
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Compensation API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
