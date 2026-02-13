import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * Build the People & Culture summary by querying raw data tables directly.
 * This replaces the dependency on the people_culture_summary database view
 * which does not exist and was causing 500 errors.
 */
async function buildPeopleCultureSummary(
  supabase: any,
  organizationId: string,
  year: number
) {
  const [
    { data: compensation },
    { data: demographics },
    { data: deiActions },
    { data: training },
    { data: surveys },
    { data: benefits },
  ] = await Promise.all([
    supabase
      .from('people_employee_compensation')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('reporting_year', year),
    supabase
      .from('people_workforce_demographics')
      .select('*')
      .eq('organization_id', organizationId)
      .order('reporting_period', { ascending: false })
      .limit(1),
    supabase
      .from('people_dei_actions')
      .select('*')
      .eq('organization_id', organizationId),
    supabase
      .from('people_training_records')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('reporting_year', year),
    supabase
      .from('people_employee_surveys')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .order('close_date', { ascending: false })
      .limit(5),
    supabase
      .from('people_benefits')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true),
  ]);

  const compRecords = compensation || [];
  const latestDemographics = demographics?.[0] || null;
  const allDeiActions = deiActions || [];
  const trainingRecords = training || [];
  const surveyRecords = surveys || [];
  const benefitRecords = benefits || [];

  // Total employees from demographics or compensation count
  const totalEmployees = latestDemographics?.total_employees || compRecords.length || 0;

  // Compensation metrics
  const compensationCount = compRecords.length;
  const salaries = compRecords
    .map((c: any) => c.annual_salary)
    .filter((s: any) => s != null && s > 0);
  const avgSalary = salaries.length > 0
    ? salaries.reduce((a: number, b: number) => a + b, 0) / salaries.length
    : 0;

  // Gender pay gap
  const maleSalaries = compRecords
    .filter((c: any) => c.gender === 'male' && c.annual_salary > 0)
    .map((c: any) => c.annual_salary);
  const femaleSalaries = compRecords
    .filter((c: any) => c.gender === 'female' && c.annual_salary > 0)
    .map((c: any) => c.annual_salary);

  const avgMale = maleSalaries.length > 0
    ? maleSalaries.reduce((a: number, b: number) => a + b, 0) / maleSalaries.length
    : 0;
  const avgFemale = femaleSalaries.length > 0
    ? femaleSalaries.reduce((a: number, b: number) => a + b, 0) / femaleSalaries.length
    : 0;

  const genderPayGapMean = avgMale > 0
    ? ((avgMale - avgFemale) / avgMale) * 100
    : 0;

  // Median pay gap
  const sortedMale = [...maleSalaries].sort((a: number, b: number) => a - b);
  const sortedFemale = [...femaleSalaries].sort((a: number, b: number) => a - b);
  const medianMale = sortedMale.length > 0 ? sortedMale[Math.floor(sortedMale.length / 2)] : 0;
  const medianFemale = sortedFemale.length > 0 ? sortedFemale[Math.floor(sortedFemale.length / 2)] : 0;
  const calculatedPayGap = medianMale > 0
    ? ((medianMale - medianFemale) / medianMale) * 100
    : 0;

  // Living wage compliance
  let livingWageCompliance = 0;
  if (compRecords.length > 0) {
    const { data: benchmarks } = await supabase
      .from('people_living_wage_benchmarks')
      .select('*')
      .eq('is_current', true);

    if (benchmarks && benchmarks.length > 0) {
      const defaultBenchmark = benchmarks[0];
      const compliant = compRecords.filter((c: any) => {
        const salary = c.annual_salary || (c.hourly_rate ? c.hourly_rate * 2080 : 0);
        const benchmark = benchmarks.find((b: any) => b.country === c.work_country) || defaultBenchmark;
        return salary >= (benchmark.annual_rate || 0);
      });
      livingWageCompliance = (compliant.length / compRecords.length) * 100;
    } else {
      livingWageCompliance = 50;
    }
  }

  // Training metrics
  const totalTrainingHours = trainingRecords.reduce(
    (sum: number, t: any) => sum + (t.total_hours || 0), 0
  );
  const trainingHoursPerEmployee = totalEmployees > 0
    ? totalTrainingHours / totalEmployees
    : 0;

  // DEI actions
  const deiTotalActions = allDeiActions.length;
  const deiCompletedActions = allDeiActions.filter(
    (a: any) => a.status === 'completed'
  ).length;

  // Wellbeing score from surveys and benefits
  let wellbeingScore = 50;
  if (surveyRecords.length > 0) {
    const avgResponseRate = surveyRecords.reduce(
      (sum: number, s: any) => sum + (s.response_rate || 0), 0
    ) / surveyRecords.length;
    wellbeingScore = Math.min(100, Math.round(avgResponseRate));
  }
  if (benefitRecords.length > 0) {
    wellbeingScore = Math.min(100, wellbeingScore + Math.min(20, benefitRecords.length * 5));
  }

  return {
    organization_id: organizationId,
    total_employees: totalEmployees,
    gender_data: latestDemographics?.gender_data || null,
    latest_demographics_date: latestDemographics?.reporting_period || null,
    compensation_records: compensationCount,
    avg_salary: Math.round(avgSalary),
    calculated_pay_gap: Math.round(calculatedPayGap * 10) / 10,
    total_training_hours: totalTrainingHours,
    training_hours_per_employee: Math.round(trainingHoursPerEmployee * 10) / 10,
    dei_total_actions: deiTotalActions,
    dei_completed_actions: deiCompletedActions,
    living_wage_compliance: Math.round(livingWageCompliance * 10) / 10,
    gender_pay_gap_mean: Math.round(genderPayGapMean * 10) / 10,
    wellbeing_score: wellbeingScore,
  };
}

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

    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();
    const includeHistory = searchParams.get('history') === 'true';

    // Get latest score
    let query = supabase
      .from('people_culture_scores')
      .select('*')
      .eq('organization_id', organizationId)
      .order('calculation_date', { ascending: false });

    if (!includeHistory) {
      query = query.eq('reporting_year', year).limit(1);
    }

    const { data: scores, error: scoreError } = await query;

    if (scoreError) {
      console.error('Error fetching people culture score:', scoreError);
      return NextResponse.json({ error: 'Failed to fetch score' }, { status: 500 });
    }

    // Build summary from raw tables
    const summary = await buildPeopleCultureSummary(supabase, organizationId, year);

    const latestScore = scores?.[0] || null;
    const response: Record<string, unknown> = {
      score: latestScore,
      summary,
      year,
    };

    if (includeHistory) {
      response.history = scores || [];
    }

    if (!latestScore) {
      response.message = 'No People & Culture score calculated yet. Add compensation, demographics, and training data to generate a score.';
      response.data_status = {
        compensation: summary.compensation_records,
        demographics: summary.total_employees,
        dei_actions: summary.dei_total_actions,
        training_hours: summary.total_training_hours,
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
    const year = body.year || new Date().getFullYear();

    // Build summary from raw tables (not the missing view)
    const summary = await buildPeopleCultureSummary(supabase, organizationId, year);

    // Fair Work Score
    const compensationRecords = summary.compensation_records;
    const livingWageCompliance = summary.living_wage_compliance;
    const fairWorkScore = compensationRecords > 0
      ? Math.min(100, Math.round((livingWageCompliance / 100) * 80 + 20))
      : 0;

    // Diversity Score
    const hasDemographics = summary.total_employees > 0;
    const payGap = Math.abs(summary.gender_pay_gap_mean);
    const payGapScore = payGap > 0 ? Math.max(0, 100 - (payGap * 2)) : 50;
    const diversityScore = hasDemographics
      ? Math.round((payGapScore * 0.6) + (summary.dei_completed_actions > 0 ? 40 : 20))
      : 0;

    // Wellbeing Score (now calculated from real survey/benefit data)
    const wellbeingScore = summary.wellbeing_score;

    // Training Score
    const trainingHoursPerEmployee = summary.training_hours_per_employee;
    const trainingScore = Math.min(100, Math.round((trainingHoursPerEmployee / 20) * 100));

    // Overall score
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
       (hasDemographics ? 25 : 0) +
       (summary.dei_total_actions > 0 ? 25 : 0) +
       (trainingHoursPerEmployee > 0 ? 25 : 0))
    );

    const scoreData = {
      organization_id: organizationId,
      calculation_date: new Date().toISOString(),
      reporting_year: year,
      overall_score: overallScore,
      fair_work_score: fairWorkScore,
      diversity_score: diversityScore,
      wellbeing_score: wellbeingScore,
      training_score: trainingScore,
      living_wage_compliance: livingWageCompliance,
      gender_pay_gap_mean: summary.gender_pay_gap_mean || null,
      gender_pay_gap_median: summary.calculated_pay_gap || null,
      training_hours_per_employee: trainingHoursPerEmployee,
      data_completeness: dataCompleteness,
      calculation_metadata: {
        calculated_at: new Date().toISOString(),
        data_sources: {
          compensation_records: compensationRecords,
          total_employees: summary.total_employees,
          dei_actions: summary.dei_total_actions,
          training_hours: summary.total_training_hours,
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
