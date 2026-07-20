/**
 * Governance report section fetcher.
 *
 * House pattern (lib/provenance/rollup.ts): `gatherGovernance` does ONLY
 * I/O — no auth, the caller passes an already-scoped Supabase client — and
 * `mapGovernance` is the pure, unit-testable half.
 *
 * YEAR POLICY: as-at-year-end. Governance tables carry no reporting_year:
 * the board is whoever served on 31 December of the report year (dates when
 * recorded, the is_current flag when not), policies are those effective by
 * year end, and the clock-relative parts of calculateGovernanceScore
 * (policy review recency, engagement recency, this-year trainings) run with
 * `now` pinned to year end via its injectable second argument. Ethics and
 * lobbying counts are for activity dated within the year.
 *
 * Computes LIVE from raw tables — never reads the governance_scores
 * snapshot. Renames per the report contract: member_name→name,
 * meeting_attendance_rate→attendanceRate, policy_name→name, and the score's
 * policy_score→policyCompleteness. boardDiversityMetrics.femalePercentage is
 * the FEMALE SHARE of the board (female/total), NOT the score route's
 * min(male,female)/total balance ratio. All rates 0-100; null means not yet
 * measured.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateGovernanceScore } from '@/lib/governance/score';
import type { GovernanceData } from './types';

// ============================================================================
// Raw row shapes (only the columns the mapper reads)
// ============================================================================

export interface GovernanceMissionRow {
  mission_statement: string | null;
  vision_statement: string | null;
  purpose_statement: string | null;
  is_benefit_corporation: boolean | null;
  sdg_commitments: number[] | null;
  climate_commitments: string[] | null;
}

export interface GovernanceBoardMemberRow {
  member_name: string | null;
  role: string | null;
  gender: string | null;
  is_independent: boolean | null;
  /** 0-100 in the DB. */
  meeting_attendance_rate: number | null;
  appointment_date: string | null;
  term_end_date: string | null;
  is_current: boolean | null;
}

export interface GovernancePolicyRow {
  policy_name: string | null;
  policy_type: string | null;
  status: string | null;
  is_public: boolean | null;
  effective_date: string | null;
  last_reviewed_at: string | null;
}

export interface GovernanceEthicsRow {
  record_type: string | null;
  record_date: string | null;
  completion_rate: number | null;
  status: string | null;
}

export interface GovernanceLobbyingRow {
  activity_date: string | null;
  is_public: boolean | null;
}

export interface GovernanceStakeholderRow {
  id: string;
  stakeholder_type: string | null;
}

export interface GovernanceEngagementRow {
  stakeholder_id: string | null;
  engagement_date: string | null;
}

export interface GovernanceRaw {
  mission: GovernanceMissionRow | null;
  boardMembers: GovernanceBoardMemberRow[];
  policies: GovernancePolicyRow[];
  ethics: GovernanceEthicsRow[];
  lobbying: GovernanceLobbyingRow[];
  stakeholders: GovernanceStakeholderRow[];
  engagements: GovernanceEngagementRow[];
  year: number;
}

// ============================================================================
// Pure mapper
// ============================================================================

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Was this member on the board as at 31 December of the report year?
 * Dates win when recorded; the is_current flag is the fallback for rows
 * that carry no dates at all (it describes "now", the best signal left).
 */
export function onBoardAtYearEnd(
  m: GovernanceBoardMemberRow,
  yearEndISO: string,
): boolean {
  if (m.appointment_date && m.appointment_date > yearEndISO) return false;
  if (m.term_end_date) return m.term_end_date >= yearEndISO;
  if (m.appointment_date) return true;
  return m.is_current !== false;
}

export function mapGovernance(raw: GovernanceRaw): GovernanceData {
  const yearEndISO = `${raw.year}-12-31`;
  const yearStartISO = `${raw.year}-01-01`;
  const yearEnd = new Date(`${raw.year}-12-31T23:59:59Z`);

  const board = raw.boardMembers.filter((m) => onBoardAtYearEnd(m, yearEndISO));
  // Policies effective by year end (undated ones are assumed standing).
  const policies = raw.policies.filter(
    (p) => !p.effective_date || p.effective_date <= yearEndISO,
  );

  // ---- Board diversity metrics ----
  const totalMembers = board.length;
  const femaleCount = board.filter((m) => m.gender === 'female').length;
  const independentCount = board.filter((m) => m.is_independent === true).length;
  const attendanceRates = board
    .map((m) => m.meeting_attendance_rate)
    .filter((r): r is number => r != null);

  const boardDiversityMetrics = {
    totalMembers,
    // Female SHARE of the board — deliberately not min(male,female)/total.
    femalePercentage:
      totalMembers > 0 ? round1((femaleCount / totalMembers) * 100) : null,
    independentPercentage:
      totalMembers > 0 ? round1((independentCount / totalMembers) * 100) : null,
    averageAttendance:
      attendanceRates.length > 0
        ? round1(attendanceRates.reduce((a, b) => a + b, 0) / attendanceRates.length)
        : null,
  };

  // ---- Policy completeness: the shared scorer's policy pillar, computed
  // as at year end. Null (not 0) when no policies are recorded at all. ----
  const score = calculateGovernanceScore(
    {
      policies,
      stakeholders: raw.stakeholders,
      engagements: raw.engagements,
      boardMembers: board,
      mission: raw.mission,
      lobbying: raw.lobbying,
      ethics: raw.ethics,
    },
    yearEnd,
  );
  const policyCompleteness = policies.length > 0 ? score.policy_score : null;

  // ---- Ethics, within the report year ----
  const ethicsInYear = raw.ethics.filter(
    (e) =>
      e.record_date != null &&
      e.record_date >= yearStartISO &&
      e.record_date <= yearEndISO,
  );
  const trainings = ethicsInYear.filter((e) => e.record_type === 'ethics_training');
  const trainingRates = trainings
    .map((t) => t.completion_rate)
    .filter((r): r is number => r != null);
  const ethicsTrainingRate =
    trainingRates.length > 0
      ? round1(trainingRates.reduce((a, b) => a + b, 0) / trainingRates.length)
      : null;
  // A zero is a claim: only claim "0 incidents" when the org recorded ANY
  // ethics activity in the year; a silent register is "not yet measured".
  const ethicsIncidents =
    ethicsInYear.length > 0
      ? ethicsInYear.filter((e) =>
          ['whistleblowing_case', 'incident'].includes(e.record_type ?? ''),
        ).length
      : null;

  // ---- Lobbying: activity dated within the year; null when the org has
  // never recorded lobbying at all (absence of the register ≠ zero). ----
  const lobbyingActivities =
    raw.lobbying.length > 0
      ? raw.lobbying.filter(
          (l) =>
            l.activity_date != null &&
            l.activity_date >= yearStartISO &&
            l.activity_date <= yearEndISO,
        ).length
      : null;

  return {
    missionStatement: raw.mission?.mission_statement ?? null,
    visionStatement: raw.mission?.vision_statement ?? null,
    purposeStatement: raw.mission?.purpose_statement ?? null,
    isBenefitCorp: raw.mission?.is_benefit_corporation ?? false,
    sdgCommitments: (raw.mission?.sdg_commitments ?? []).map(Number),
    climateCommitments: raw.mission?.climate_commitments ?? [],
    boardMembers: board.map((m) => ({
      name: m.member_name ?? '',
      role: m.role ?? '',
      gender: m.gender ?? null,
      isIndependent: m.is_independent ?? null,
      attendanceRate: m.meeting_attendance_rate ?? null,
    })),
    boardDiversityMetrics,
    policies: policies.map((p) => ({
      name: p.policy_name ?? '',
      type: p.policy_type ?? '',
      status: p.status ?? '',
      isPublic: p.is_public === true,
    })),
    policyCompleteness,
    ethicsTrainingRate,
    ethicsIncidents,
    lobbyingActivities,
  };
}

// ============================================================================
// Gather (I/O only)
// ============================================================================

export async function gatherGovernance(
  supabase: SupabaseClient,
  organizationId: string,
  year: number,
): Promise<GovernanceData> {
  const [mission, boardMembers, policies, ethics, lobbying, stakeholders, engagements] =
    await Promise.all([
      supabase
        .from('governance_mission')
        .select(
          'mission_statement, vision_statement, purpose_statement, is_benefit_corporation, sdg_commitments, climate_commitments',
        )
        .eq('organization_id', organizationId)
        .maybeSingle(),
      supabase
        .from('governance_board_members')
        .select(
          'member_name, role, gender, is_independent, meeting_attendance_rate, appointment_date, term_end_date, is_current',
        )
        .eq('organization_id', organizationId),
      supabase
        .from('governance_policies')
        .select('policy_name, policy_type, status, is_public, effective_date, last_reviewed_at')
        .eq('organization_id', organizationId),
      supabase
        .from('governance_ethics_records')
        .select('record_type, record_date, completion_rate, status')
        .eq('organization_id', organizationId),
      supabase
        .from('governance_lobbying')
        .select('activity_date, is_public')
        .eq('organization_id', organizationId),
      supabase
        .from('governance_stakeholders')
        .select('id, stakeholder_type')
        .eq('organization_id', organizationId),
      supabase
        .from('governance_stakeholder_engagements')
        .select('stakeholder_id, engagement_date')
        .eq('organization_id', organizationId),
    ]);

  for (const res of [mission, boardMembers, policies, ethics, lobbying, stakeholders, engagements]) {
    if (res.error) throw new Error(`gatherGovernance: ${res.error.message}`);
  }

  return mapGovernance({
    mission: (mission.data ?? null) as GovernanceMissionRow | null,
    boardMembers: (boardMembers.data ?? []) as GovernanceBoardMemberRow[],
    policies: (policies.data ?? []) as GovernancePolicyRow[],
    ethics: (ethics.data ?? []) as GovernanceEthicsRow[],
    lobbying: (lobbying.data ?? []) as GovernanceLobbyingRow[],
    stakeholders: (stakeholders.data ?? []) as GovernanceStakeholderRow[],
    engagements: (engagements.data ?? []) as GovernanceEngagementRow[],
    year,
  });
}
