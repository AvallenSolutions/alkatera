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

    if (!organizationId) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
    }

    // Get the most recent score
    const { data: score, error } = await supabase
      .from('governance_scores')
      .select('*')
      .eq('organization_id', organizationId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching governance score:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get score history
    const { data: history } = await supabase
      .from('governance_scores')
      .select('overall_score, calculated_at')
      .eq('organization_id', organizationId)
      .order('calculated_at', { ascending: false })
      .limit(12);

    return NextResponse.json({
      current: score || null,
      history: history || [],
    });
  } catch (error) {
    console.error('Error in GET /api/governance/score:', error);
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

    // Fetch all governance data for scoring
    const [
      { data: policies },
      { data: stakeholders },
      { data: engagements },
      { data: boardMembers },
      { data: mission },
      { data: lobbying },
      { data: ethics },
    ] = await Promise.all([
      supabase.from('governance_policies').select('*').eq('organization_id', targetOrgId),
      supabase.from('governance_stakeholders').select('*').eq('organization_id', targetOrgId),
      supabase.from('governance_stakeholder_engagements').select('*').eq('organization_id', targetOrgId),
      supabase.from('governance_board_members').select('*').eq('organization_id', targetOrgId).eq('is_current', true),
      supabase.from('governance_mission').select('*').eq('organization_id', targetOrgId).maybeSingle(),
      supabase.from('governance_lobbying').select('*').eq('organization_id', targetOrgId),
      supabase.from('governance_ethics_records').select('*').eq('organization_id', targetOrgId),
    ]);

    // Calculate scores
    const scores = calculateGovernanceScore({
      policies: policies || [],
      stakeholders: stakeholders || [],
      engagements: engagements || [],
      boardMembers: boardMembers || [],
      mission: mission,
      lobbying: lobbying || [],
      ethics: ethics || [],
    });

    // Store the score
    const { data: savedScore, error } = await supabase
      .from('governance_scores')
      .insert({
        organization_id: targetOrgId,
        overall_score: scores.overall_score,
        policy_score: scores.policy_score,
        stakeholder_score: scores.stakeholder_score,
        board_score: scores.board_score,
        ethics_score: scores.ethics_score,
        transparency_score: scores.transparency_score,
        data_completeness: scores.data_completeness,
        calculation_period_start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        calculation_period_end: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving governance score:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(savedScore, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/governance/score:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

interface GovernanceData {
  policies: any[];
  stakeholders: any[];
  engagements: any[];
  boardMembers: any[];
  mission: any;
  lobbying: any[];
  ethics: any[];
}

function calculateGovernanceScore(data: GovernanceData) {
  let totalDataPoints = 0;
  let providedDataPoints = 0;

  // =========================================
  // Policy Score (20% weight)
  // =========================================
  let policyScore = 0;
  let policyComponents = 0;

  // Active policies count
  const activePolicies = data.policies.filter(p => p.status === 'active');
  totalDataPoints++;
  if (activePolicies.length > 0) {
    // Score based on having key policy types
    const keyTypes = ['ethics', 'environmental', 'social', 'governance'];
    const coveredTypes = new Set(activePolicies.map(p => p.policy_type));
    const coverage = keyTypes.filter(t => coveredTypes.has(t)).length / keyTypes.length;
    policyScore += coverage * 100;
    policyComponents++;
    providedDataPoints++;
  }

  // Policy review compliance
  totalDataPoints++;
  if (activePolicies.length > 0) {
    const reviewedRecently = activePolicies.filter(p => {
      if (!p.last_reviewed_at) return false;
      const reviewDate = new Date(p.last_reviewed_at);
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      return reviewDate >= oneYearAgo;
    });
    policyScore += (reviewedRecently.length / activePolicies.length) * 100;
    policyComponents++;
    providedDataPoints++;
  }

  // Public policies
  totalDataPoints++;
  if (activePolicies.length > 0) {
    const publicPolicies = activePolicies.filter(p => p.is_public);
    policyScore += (publicPolicies.length / activePolicies.length) * 100;
    policyComponents++;
    providedDataPoints++;
  }

  const finalPolicyScore = policyComponents > 0 ? policyScore / policyComponents : 0;

  // =========================================
  // Stakeholder Score (20% weight)
  // =========================================
  let stakeholderScore = 0;
  let stakeholderComponents = 0;

  // Stakeholder identification
  totalDataPoints++;
  if (data.stakeholders.length > 0) {
    // Score based on coverage of key stakeholder types
    const keyTypes = ['employees', 'customers', 'suppliers', 'community', 'investors'];
    const coveredTypes = new Set(data.stakeholders.map(s => s.stakeholder_type));
    const coverage = keyTypes.filter(t => coveredTypes.has(t)).length / keyTypes.length;
    stakeholderScore += coverage * 100;
    stakeholderComponents++;
    providedDataPoints++;
  }

  // Recent engagement
  totalDataPoints++;
  const recentEngagements = data.engagements.filter(e => {
    const engagementDate = new Date(e.engagement_date);
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    return engagementDate >= threeMonthsAgo;
  });
  if (data.stakeholders.length > 0) {
    const engagedStakeholders = new Set(recentEngagements.map(e => e.stakeholder_id));
    stakeholderScore += (engagedStakeholders.size / data.stakeholders.length) * 100;
    stakeholderComponents++;
    providedDataPoints++;
  }

  const finalStakeholderScore = stakeholderComponents > 0 ? stakeholderScore / stakeholderComponents : 0;

  // =========================================
  // Board Score (25% weight)
  // =========================================
  let boardScore = 0;
  let boardComponents = 0;

  totalDataPoints++;
  if (data.boardMembers.length > 0) {
    providedDataPoints++;

    // Independence ratio (target: >50% independent)
    totalDataPoints++;
    const independentCount = data.boardMembers.filter(m => m.is_independent).length;
    const independenceRatio = independentCount / data.boardMembers.length;
    boardScore += Math.min(100, (independenceRatio / 0.5) * 100);
    boardComponents++;
    providedDataPoints++;

    // Gender diversity (target: 40-60% any gender)
    totalDataPoints++;
    const maleCount = data.boardMembers.filter(m => m.gender === 'male').length;
    const femaleCount = data.boardMembers.filter(m => m.gender === 'female').length;
    const genderRatio = Math.min(maleCount, femaleCount) / data.boardMembers.length;
    boardScore += (genderRatio / 0.5) * 100; // Max score at 50/50
    boardComponents++;
    providedDataPoints++;

    // Attendance rate
    totalDataPoints++;
    const avgAttendance = data.boardMembers.reduce((sum, m) => sum + (m.meeting_attendance_rate || 0), 0) / data.boardMembers.length;
    boardScore += avgAttendance;
    boardComponents++;
    providedDataPoints++;
  }

  const finalBoardScore = boardComponents > 0 ? boardScore / boardComponents : 0;

  // =========================================
  // Ethics Score (20% weight)
  // =========================================
  let ethicsScore = 0;
  let ethicsComponents = 0;

  // Ethics training
  totalDataPoints++;
  const currentYear = new Date().getFullYear();
  const thisYearTrainings = data.ethics.filter(e =>
    e.record_type === 'ethics_training' &&
    new Date(e.record_date).getFullYear() === currentYear
  );
  if (thisYearTrainings.length > 0) {
    const avgCompletion = thisYearTrainings.reduce((sum, t) => sum + (t.completion_rate || 0), 0) / thisYearTrainings.length;
    ethicsScore += avgCompletion;
    ethicsComponents++;
    providedDataPoints++;
  }

  // Whistleblowing system (evidence of policy or cases handled)
  totalDataPoints++;
  const hasEthicsPolicy = data.policies.some(p => p.policy_type === 'ethics' && p.status === 'active');
  const whistleblowingCases = data.ethics.filter(e => e.record_type === 'whistleblowing_case');
  if (hasEthicsPolicy) {
    ethicsScore += 50; // Base points for having policy
    // Additional points for handling cases properly
    const resolvedCases = whistleblowingCases.filter(c => c.status === 'resolved' || c.status === 'closed');
    if (whistleblowingCases.length > 0) {
      ethicsScore += (resolvedCases.length / whistleblowingCases.length) * 50;
    } else {
      ethicsScore += 50; // No cases to resolve
    }
    ethicsComponents++;
    providedDataPoints++;
  }

  const finalEthicsScore = ethicsComponents > 0 ? ethicsScore / ethicsComponents : 0;

  // =========================================
  // Transparency Score (15% weight)
  // =========================================
  let transparencyScore = 0;
  let transparencyComponents = 0;

  // Mission published
  totalDataPoints++;
  if (data.mission) {
    if (data.mission.mission_statement) {
      transparencyScore += 50;
      providedDataPoints++;
    }
    if (data.mission.is_benefit_corporation) {
      transparencyScore += 50;
    }
    transparencyComponents++;
  }

  // Lobbying disclosure
  totalDataPoints++;
  if (data.lobbying.length > 0) {
    const publicDisclosures = data.lobbying.filter(l => l.is_public);
    transparencyScore += (publicDisclosures.length / data.lobbying.length) * 100;
    transparencyComponents++;
    providedDataPoints++;
  }

  const finalTransparencyScore = transparencyComponents > 0 ? transparencyScore / transparencyComponents : 0;

  // =========================================
  // Overall Score
  // =========================================
  const overallScore =
    finalPolicyScore * 0.20 +
    finalStakeholderScore * 0.20 +
    finalBoardScore * 0.25 +
    finalEthicsScore * 0.20 +
    finalTransparencyScore * 0.15;

  const dataCompleteness = totalDataPoints > 0 ? (providedDataPoints / totalDataPoints) * 100 : 0;

  return {
    overall_score: Math.round(overallScore * 10) / 10,
    policy_score: Math.round(finalPolicyScore * 10) / 10,
    stakeholder_score: Math.round(finalStakeholderScore * 10) / 10,
    board_score: Math.round(finalBoardScore * 10) / 10,
    ethics_score: Math.round(finalEthicsScore * 10) / 10,
    transparency_score: Math.round(finalTransparencyScore * 10) / 10,
    data_completeness: Math.round(dataCompleteness * 10) / 10,
  };
}
