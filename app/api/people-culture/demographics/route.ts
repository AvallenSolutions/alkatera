import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * GET /api/people-culture/demographics
 * Get workforce demographics for the authenticated user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
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
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null;
    const includeTrends = searchParams.get('trends') === 'true';

    // Build query
    let query = supabase
      .from('people_workforce_demographics')
      .select('*')
      .eq('organization_id', organizationId)
      .order('reporting_period', { ascending: false });

    if (year) {
      query = query.eq('reporting_year', year);
    }

    if (!includeTrends) {
      query = query.limit(1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching demographics:', error);
      return NextResponse.json({ error: 'Failed to fetch demographics' }, { status: 500 });
    }

    // Return latest or all for trends
    return NextResponse.json({
      data: includeTrends ? data : (data?.[0] || null),
      trends: includeTrends ? data : undefined,
    });
  } catch (error) {
    console.error('Demographics API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * POST /api/people-culture/demographics
 * Create or update workforce demographics for a reporting period
 */
export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
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

    const body = await request.json();

    // Validate required fields
    if (!body.reporting_period) {
      return NextResponse.json({ error: 'Reporting period is required' }, { status: 400 });
    }
    if (body.total_employees === undefined || body.total_employees === null) {
      return NextResponse.json({ error: 'Total employees is required' }, { status: 400 });
    }

    // Prepare record data
    const reportingDate = new Date(body.reporting_period);
    const recordData = {
      organization_id: organizationId,
      created_by: user.id,
      reporting_period: body.reporting_period,
      reporting_year: body.reporting_year || reportingDate.getFullYear(),
      total_employees: body.total_employees,
      total_fte: body.total_fte || null,
      gender_data: body.gender_data || {},
      ethnicity_data: body.ethnicity_data || {},
      age_data: body.age_data || {},
      disability_data: body.disability_data || {},
      management_breakdown: body.management_breakdown || {},
      employment_type_breakdown: body.employment_type_breakdown || {},
      new_hires: body.new_hires || 0,
      departures: body.departures || 0,
      voluntary_departures: body.voluntary_departures || 0,
      response_rate: body.response_rate || null,
      data_collection_method: body.data_collection_method || 'manual',
    };

    // Upsert (update if exists for same org/period, insert otherwise)
    const { data, error } = await supabase
      .from('people_workforce_demographics')
      .upsert(recordData, {
        onConflict: 'organization_id,reporting_period',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving demographics:', error);
      return NextResponse.json({ error: 'Failed to save demographics', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Demographics API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
