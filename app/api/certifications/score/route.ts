import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organization_id');
    const frameworkId = searchParams.get('framework_id');

    if (!organizationId) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
    }

    // Get score history
    let query = supabase
      .from('certification_score_history')
      .select(`
        *,
        framework:certification_frameworks(framework_name, framework_code, framework_version)
      `)
      .eq('organization_id', organizationId)
      .order('score_date', { ascending: false });

    if (frameworkId) {
      query = query.eq('framework_id', frameworkId);
    }

    const { data: scoreHistory, error: scoreError } = await query;

    if (scoreError) {
      console.error('Error fetching score history:', scoreError);
      return NextResponse.json({ error: scoreError.message }, { status: 500 });
    }

    // Get latest scores per framework
    const latestScores: Record<string, any> = {};
    (scoreHistory || []).forEach(score => {
      if (!latestScores[score.framework_id]) {
        latestScores[score.framework_id] = score;
      }
    });

    // Get organization certifications status
    const { data: certifications, error: certError } = await supabase
      .from('organization_certifications')
      .select(`
        *,
        framework:certification_frameworks(framework_name, framework_code, framework_version, passing_score)
      `)
      .eq('organization_id', organizationId);

    if (certError) {
      console.error('Error fetching certifications:', certError);
    }

    // Calculate readiness summary
    const readinessSummary = calculateReadinessSummary(
      Object.values(latestScores),
      certifications || []
    );

    return NextResponse.json({
      scoreHistory,
      latestScores: Object.values(latestScores),
      certifications,
      readinessSummary,
    });
  } catch (error) {
    console.error('Error in GET /api/certifications/score:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organization from metadata or first membership
    let organizationId = user.user_metadata?.current_organization_id;

    if (!organizationId) {
      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberError || !membership) {
        return NextResponse.json({ error: 'No organization found' }, { status: 403 });
      }
      organizationId = membership.organization_id;
    }

    const body = await request.json();
    const targetOrgId = body.organization_id || organizationId;

    if (!body.framework_id) {
      return NextResponse.json(
        { error: 'framework_id is required' },
        { status: 400 }
      );
    }

    // Calculate score from gap analyses
    const { data: gapAnalyses, error: gapError } = await supabase
      .from('certification_gap_analyses')
      .select(`
        *,
        requirement:framework_requirements(max_points, requirement_category)
      `)
      .eq('organization_id', targetOrgId)
      .eq('framework_id', body.framework_id);

    if (gapError) {
      console.error('Error fetching gap analyses:', gapError);
      return NextResponse.json({ error: gapError.message }, { status: 500 });
    }

    // Calculate scores
    const scoreBreakdown = calculateScoreBreakdown(gapAnalyses || []);

    // Get framework passing score
    const { data: framework } = await supabase
      .from('certification_frameworks')
      .select('passing_score')
      .eq('id', body.framework_id)
      .maybeSingle();

    const passingScore = framework?.passing_score || 80;

    // Insert score history record
    const { data, error } = await supabase
      .from('certification_score_history')
      .insert({
        organization_id: targetOrgId,
        framework_id: body.framework_id,
        score_date: new Date().toISOString().split('T')[0],
        overall_score: scoreBreakdown.totalScore,
        category_scores: scoreBreakdown.categoryScores,
        requirements_met: scoreBreakdown.requirementsMet,
        requirements_partial: scoreBreakdown.requirementsPartial,
        requirements_not_met: scoreBreakdown.requirementsNotMet,
        total_requirements: scoreBreakdown.requirementsMet + scoreBreakdown.requirementsPartial + scoreBreakdown.requirementsNotMet,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating score record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update organization certification with current score
    const { error: updateError } = await supabase
      .from('organization_certifications')
      .update({
        readiness_score: scoreBreakdown.totalScore,
        status: scoreBreakdown.totalScore >= passingScore ? 'ready' : 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', targetOrgId)
      .eq('framework_id', body.framework_id);

    if (updateError) {
      console.error('[Score API] Error updating certification:', updateError);
    }

    return NextResponse.json({
      ...data,
      scoreBreakdown,
      isPassingScore: scoreBreakdown.totalScore >= passingScore,
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/certifications/score:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function calculateScoreBreakdown(gapAnalyses: any[]) {
  const categoryScores: Record<string, { achieved: number; available: number; percentage: number }> = {};
  let totalAchieved = 0;
  let totalAvailable = 0;
  let requirementsMet = 0;
  let requirementsPartial = 0;
  let requirementsNotMet = 0;

  gapAnalyses.forEach(analysis => {
    const category = analysis.requirement?.requirement_category || 'Uncategorized';
    const pointsAvailable = analysis.requirement?.max_points || 0;
    const pointsAchieved = analysis.current_score || 0;

    if (!categoryScores[category]) {
      categoryScores[category] = { achieved: 0, available: 0, percentage: 0 };
    }

    categoryScores[category].achieved += pointsAchieved;
    categoryScores[category].available += pointsAvailable;
    totalAchieved += pointsAchieved;
    totalAvailable += pointsAvailable;

    if (analysis.compliance_status === 'compliant') {
      requirementsMet++;
    } else if (analysis.compliance_status === 'partial') {
      requirementsPartial++;
    } else if (analysis.compliance_status === 'non_compliant') {
      requirementsNotMet++;
    }
  });

  // Calculate percentages
  Object.keys(categoryScores).forEach(category => {
    const cat = categoryScores[category];
    cat.percentage = cat.available > 0
      ? Math.round((cat.achieved / cat.available) * 1000) / 10
      : 0;
  });

  const totalScore = totalAvailable > 0
    ? Math.round((totalAchieved / totalAvailable) * 1000) / 10
    : 0;

  return {
    totalScore,
    totalAchieved,
    totalAvailable,
    categoryScores,
    requirementsMet,
    requirementsPartial,
    requirementsNotMet,
  };
}

function calculateReadinessSummary(latestScores: any[], certifications: any[]) {
  const certified = certifications.filter(c => c.status === 'certified').length;
  const inProgress = certifications.filter(c => c.status === 'in_progress').length;
  const ready = certifications.filter(c => c.status === 'ready').length;

  const avgScore = latestScores.length > 0
    ? Math.round(latestScores.reduce((sum, s) => sum + (s.overall_score || 0), 0) / latestScores.length)
    : 0;

  return {
    totalFrameworks: certifications.length,
    certified,
    ready,
    inProgress,
    notStarted: certifications.filter(c => c.status === 'not_started').length,
    averageScore: avgScore,
  };
}
