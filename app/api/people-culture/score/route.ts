import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * GET /api/people-culture/score
 * Get the People & Culture score for the authenticated user's organization
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
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();
    const includeHistory = searchParams.get('history') === 'true';

    // Get latest score
    let query = supabase
      .from('people_culture_scores')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .order('calculation_date', { ascending: false });

    if (!includeHistory) {
      query = query.eq('reporting_year', year).limit(1);
    }

    const { data: scores, error: scoreError } = await query;

    if (scoreError) {
      console.error('Error fetching people culture score:', scoreError);
      return NextResponse.json({ error: 'Failed to fetch score' }, { status: 500 });
    }

    // Get summary data for context
    const { data: summary, error: summaryError } = await supabase
      .from('people_culture_summary')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .single();

    if (summaryError && summaryError.code !== 'PGRST116') {
      console.error('Error fetching summary:', summaryError);
    }

    // Return data
    const latestScore = scores?.[0] || null;
    const response: Record<string, unknown> = {
      score: latestScore,
      summary: summary || null,
      year,
    };

    if (includeHistory) {
      response.history = scores || [];
    }

    // If no score exists, return empty score with calculation guidance
    if (!latestScore) {
      response.message = 'No People & Culture score calculated yet. Add compensation, demographics, and training data to generate a score.';
      response.data_status = {
        compensation: summary?.compensation_records || 0,
        demographics: summary?.total_employees || 0,
        dei_actions: summary?.dei_total_actions || 0,
        training_hours: summary?.total_training_hours || 0,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('People Culture Score API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * POST /api/people-culture/score
 * Trigger a recalculation of the People & Culture score
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
    const year = body.year || new Date().getFullYear();

    // Get summary data for calculation
    const { data: summary, error: summaryError } = await supabase
      .from('people_culture_summary')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .single();

    if (summaryError && summaryError.code !== 'PGRST116') {
      console.error('Error fetching summary for calculation:', summaryError);
      return NextResponse.json({ error: 'Failed to fetch data for score calculation' }, { status: 500 });
    }

    // Calculate scores based on available data
    // This is a simplified calculation - more sophisticated logic would be in a dedicated calculator
    const calculatePillarScore = (hasData: boolean, completeness: number): number => {
      if (!hasData) return 0;
      // Base score of 50 if data exists, scaled by completeness
      return Math.min(100, Math.round(50 + (completeness * 50)));
    };

    // Fair Work Score - based on compensation data and living wage compliance
    const compensationRecords = summary?.compensation_records || 0;
    const livingWageCompliance = summary?.living_wage_compliance || 0;
    const fairWorkScore = compensationRecords > 0
      ? Math.min(100, Math.round((livingWageCompliance / 100) * 80 + 20))
      : 0;

    // Diversity Score - based on demographics and pay gap
    const hasdemographics = (summary?.total_employees || 0) > 0;
    const payGap = Math.abs(summary?.gender_pay_gap_mean || 0);
    const payGapScore = payGap > 0 ? Math.max(0, 100 - (payGap * 2)) : 50; // Lower gap = higher score
    const diversityScore = hasdemographics
      ? Math.round((payGapScore * 0.6) + (summary?.dei_completed_actions ? 40 : 20))
      : 0;

    // Wellbeing Score - based on survey engagement and benefits
    const wellbeingScore = 50; // Default - would be calculated from survey data

    // Training Score - based on training hours per employee
    const trainingHoursPerEmployee = summary?.training_hours_per_employee || 0;
    // B Corp suggests 20+ hours per employee per year as excellent
    const trainingScore = Math.min(100, Math.round((trainingHoursPerEmployee / 20) * 100));

    // Overall score - weighted average
    const weights = { fairWork: 0.3, diversity: 0.3, wellbeing: 0.2, training: 0.2 };
    const overallScore = Math.round(
      (fairWorkScore * weights.fairWork) +
      (diversityScore * weights.diversity) +
      (wellbeingScore * weights.wellbeing) +
      (trainingScore * weights.training)
    );

    // Data completeness
    const dataCompleteness = Math.round(
      ((compensationRecords > 0 ? 25 : 0) +
       (hasdemographics ? 25 : 0) +
       ((summary?.dei_total_actions || 0) > 0 ? 25 : 0) +
       (trainingHoursPerEmployee > 0 ? 25 : 0))
    );

    // Insert or update score
    const scoreData = {
      organization_id: membership.organization_id,
      calculation_date: new Date().toISOString(),
      reporting_year: year,
      overall_score: overallScore,
      fair_work_score: fairWorkScore,
      diversity_score: diversityScore,
      wellbeing_score: wellbeingScore,
      training_score: trainingScore,
      living_wage_compliance: livingWageCompliance,
      gender_pay_gap_mean: summary?.gender_pay_gap_mean || null,
      gender_pay_gap_median: summary?.calculated_pay_gap || null,
      training_hours_per_employee: trainingHoursPerEmployee,
      data_completeness: dataCompleteness,
      calculation_metadata: {
        calculated_at: new Date().toISOString(),
        data_sources: {
          compensation_records: compensationRecords,
          total_employees: summary?.total_employees || 0,
          dei_actions: summary?.dei_total_actions || 0,
          training_hours: summary?.total_training_hours || 0,
        },
        weights,
      },
    };

    const { data, error } = await supabase
      .from('people_culture_scores')
      .insert(scoreData)
      .select()
      .single();

    if (error) {
      console.error('Error saving score:', error);
      return NextResponse.json({ error: 'Failed to save score', details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      score: data,
      message: `People & Culture score calculated: ${overallScore}/100`,
    }, { status: 201 });
  } catch (error) {
    console.error('People Culture Score calculation error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
