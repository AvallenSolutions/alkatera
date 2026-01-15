import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * GET /api/people-culture/benefits
 * List employee benefits for the authenticated user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

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
    const benefitType = searchParams.get('type');
    const activeOnly = searchParams.get('active') !== 'false';

    // Build query
    let query = supabase
      .from('people_benefits')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .order('benefit_type')
      .order('benefit_name');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    if (benefitType) {
      query = query.eq('benefit_type', benefitType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching benefits:', error);
      return NextResponse.json({ error: 'Failed to fetch benefits' }, { status: 500 });
    }

    // Calculate summary by type
    const summary = {
      total: data?.length || 0,
      by_type: {} as Record<string, { count: number; avg_uptake: number }>,
    };

    data?.forEach(benefit => {
      if (benefit.benefit_type) {
        if (!summary.by_type[benefit.benefit_type]) {
          summary.by_type[benefit.benefit_type] = { count: 0, avg_uptake: 0 };
        }
        summary.by_type[benefit.benefit_type].count++;
        if (benefit.uptake_rate) {
          summary.by_type[benefit.benefit_type].avg_uptake += benefit.uptake_rate;
        }
      }
    });

    // Calculate averages
    Object.keys(summary.by_type).forEach(type => {
      if (summary.by_type[type].count > 0) {
        summary.by_type[type].avg_uptake /= summary.by_type[type].count;
      }
    });

    return NextResponse.json({
      data: data || [],
      summary,
    });
  } catch (error) {
    console.error('Benefits API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * POST /api/people-culture/benefits
 * Create a new benefit record
 */
export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

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
    if (!body.benefit_name) {
      return NextResponse.json({ error: 'Benefit name is required' }, { status: 400 });
    }
    if (!body.benefit_type) {
      return NextResponse.json({ error: 'Benefit type is required' }, { status: 400 });
    }

    // Validate benefit type
    const validTypes = ['health', 'pension', 'leave', 'flexible_working', 'wellness', 'financial', 'family', 'development'];
    if (!validTypes.includes(body.benefit_type)) {
      return NextResponse.json({
        error: `Invalid benefit type. Must be one of: ${validTypes.join(', ')}`
      }, { status: 400 });
    }

    // Calculate uptake rate if data provided
    let uptakeRate = body.uptake_rate;
    if (body.uptake_count && body.eligible_employee_count && body.eligible_employee_count > 0) {
      uptakeRate = (body.uptake_count / body.eligible_employee_count) * 100;
    }

    // Prepare record data
    const recordData = {
      organization_id: membership.organization_id,
      created_by: user.id,
      benefit_name: body.benefit_name,
      benefit_type: body.benefit_type,
      description: body.description || null,
      eligibility_criteria: body.eligibility_criteria || null,
      eligible_employee_count: body.eligible_employee_count || null,
      uptake_count: body.uptake_count || 0,
      uptake_rate: uptakeRate || null,
      employer_contribution: body.employer_contribution || null,
      employee_contribution: body.employee_contribution || null,
      currency: body.currency || 'GBP',
      is_active: body.is_active !== false,
      effective_from: body.effective_from || null,
      effective_to: body.effective_to || null,
      reporting_year: body.reporting_year || new Date().getFullYear(),
    };

    const { data, error } = await supabase
      .from('people_benefits')
      .insert(recordData)
      .select()
      .single();

    if (error) {
      console.error('Error creating benefit:', error);
      return NextResponse.json({ error: 'Failed to create benefit', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Benefits API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
