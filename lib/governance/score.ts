/**
 * Governance score calculation.
 *
 * Extracted from app/api/governance/score/route.ts so the sustainability
 * report fetchers (lib/reports/sections/governance.ts) can compute a LIVE
 * score from raw tables rather than reading the persisted governance_scores
 * snapshot, which only refreshes when a user visits the governance page
 * (mirrors lib/community-impact/score.ts, extracted for the same reason).
 *
 * The maths is unchanged from the route version. `now` is injectable because
 * three components are clock-relative (policy review within a year,
 * engagements within 90 days, ethics trainings this calendar year); callers
 * outside tests omit it.
 */

export interface GovernanceData {
  policies: any[];
  stakeholders: any[];
  engagements: any[];
  boardMembers: any[];
  mission: any;
  lobbying: any[];
  ethics: any[];
}

export interface GovernanceScoreResult {
  overall_score: number;
  policy_score: number;
  stakeholder_score: number;
  board_score: number;
  ethics_score: number;
  transparency_score: number;
  data_completeness: number;
}

export function calculateGovernanceScore(
  data: GovernanceData,
  now: Date = new Date(),
): GovernanceScoreResult {
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
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
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
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
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
  const currentYear = now.getFullYear();
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
