import { describe, it, expect } from 'vitest';
import {
  mapGovernance,
  onBoardAtYearEnd,
  type GovernanceRaw,
  type GovernanceBoardMemberRow,
} from '../governance';

const member = (over: Partial<GovernanceBoardMemberRow>): GovernanceBoardMemberRow => ({
  member_name: 'Alex Example',
  role: 'Director',
  gender: null,
  is_independent: null,
  meeting_attendance_rate: null,
  appointment_date: null,
  term_end_date: null,
  is_current: true,
  ...over,
});

const emptyRaw = (year = 2025): GovernanceRaw => ({
  mission: null,
  boardMembers: [],
  policies: [],
  ethics: [],
  lobbying: [],
  stakeholders: [],
  engagements: [],
  year,
});

describe('mapGovernance', () => {
  it('returns nulls and empties (never fabricated zeros) for an empty org', () => {
    const out = mapGovernance(emptyRaw());
    expect(out.missionStatement).toBeNull();
    expect(out.isBenefitCorp).toBe(false);
    expect(out.sdgCommitments).toEqual([]);
    expect(out.climateCommitments).toEqual([]);
    expect(out.boardMembers).toEqual([]);
    expect(out.boardDiversityMetrics).toEqual({
      totalMembers: 0,
      femalePercentage: null,
      independentPercentage: null,
      averageAttendance: null,
    });
    expect(out.policies).toEqual([]);
    expect(out.policyCompleteness).toBeNull();
    expect(out.ethicsTrainingRate).toBeNull();
    expect(out.ethicsIncidents).toBeNull();
    expect(out.lobbyingActivities).toBeNull();
  });

  it('applies the contract renames: member_name→name, meeting_attendance_rate→attendanceRate, policy_name→name', () => {
    const raw = emptyRaw();
    raw.boardMembers = [
      member({
        member_name: 'Ana Silva',
        role: 'Chair',
        gender: 'female',
        is_independent: true,
        meeting_attendance_rate: 92,
      }),
    ];
    raw.policies = [
      {
        policy_name: 'Code of Ethics',
        policy_type: 'ethics',
        status: 'active',
        is_public: true,
        effective_date: '2024-01-01',
        last_reviewed_at: '2025-06-01',
      },
    ];
    const out = mapGovernance(raw);
    expect(out.boardMembers[0]).toEqual({
      name: 'Ana Silva',
      role: 'Chair',
      gender: 'female',
      isIndependent: true,
      attendanceRate: 92,
    });
    expect(out.policies[0]).toEqual({
      name: 'Code of Ethics',
      type: 'ethics',
      status: 'active',
      isPublic: true,
    });
    // policy_score→policyCompleteness, 0-100 and measured once policies exist.
    expect(out.policyCompleteness).not.toBeNull();
    expect(out.policyCompleteness!).toBeGreaterThan(1);
    expect(out.policyCompleteness!).toBeLessThanOrEqual(100);
  });

  it('reports femalePercentage as the female SHARE, not the min(male,female)/total balance ratio', () => {
    const raw = emptyRaw();
    raw.boardMembers = [
      member({ gender: 'female' }),
      member({ gender: 'female' }),
      member({ gender: 'female' }),
      member({ gender: 'male' }),
    ];
    const out = mapGovernance(raw);
    // Female share is 75%; the balance ratio would have said 25%.
    expect(out.boardDiversityMetrics.femalePercentage).toBe(75);
    expect(out.boardDiversityMetrics.totalMembers).toBe(4);
  });

  it('takes the board as at year end, not as of today', () => {
    const raw = emptyRaw(2025);
    raw.boardMembers = [
      // Served through 2025, resigned since: on the 2025 board.
      member({ member_name: 'Served All Year', term_end_date: '2026-02-01', is_current: false }),
      // Left mid-2025: not on the board at year end.
      member({ member_name: 'Left In June', term_end_date: '2025-06-30', is_current: false }),
      // Appointed after year end: not on the 2025 board even though current.
      member({ member_name: 'Joined 2026', appointment_date: '2026-01-15', is_current: true }),
      // No dates recorded: the is_current flag decides.
      member({ member_name: 'Undated Current', is_current: true }),
    ];
    const out = mapGovernance(raw);
    const names = out.boardMembers.map((m) => m.name);
    expect(names).toContain('Served All Year');
    expect(names).toContain('Undated Current');
    expect(names).not.toContain('Left In June');
    expect(names).not.toContain('Joined 2026');
  });

  it('excludes policies that only became effective after year end', () => {
    const raw = emptyRaw(2025);
    raw.policies = [
      {
        policy_name: 'Old Policy',
        policy_type: 'environmental',
        status: 'active',
        is_public: false,
        effective_date: '2023-05-01',
        last_reviewed_at: null,
      },
      {
        policy_name: 'Future Policy',
        policy_type: 'social',
        status: 'active',
        is_public: false,
        effective_date: '2026-03-01',
        last_reviewed_at: null,
      },
    ];
    const out = mapGovernance(raw);
    expect(out.policies.map((p) => p.name)).toEqual(['Old Policy']);
  });

  it('scopes ethics and lobbying to the report year, with zero as a claim only when a register exists', () => {
    const raw = emptyRaw(2025);
    raw.ethics = [
      { record_type: 'ethics_training', record_date: '2025-03-01', completion_rate: 80, status: 'completed' },
      { record_type: 'ethics_training', record_date: '2025-09-01', completion_rate: 100, status: 'completed' },
      { record_type: 'whistleblowing_case', record_date: '2025-05-01', completion_rate: null, status: 'resolved' },
      // 2024 incident must not leak into the 2025 count.
      { record_type: 'incident', record_date: '2024-11-01', completion_rate: null, status: 'closed' },
    ];
    raw.lobbying = [
      { activity_date: '2025-04-01', is_public: true },
      { activity_date: '2024-04-01', is_public: true },
    ];
    const out = mapGovernance(raw);
    expect(out.ethicsTrainingRate).toBe(90);
    expect(out.ethicsIncidents).toBe(1);
    expect(out.lobbyingActivities).toBe(1);

    // Trainings recorded but no incidents: "0 incidents" is now a real claim.
    const trainingsOnly = emptyRaw(2025);
    trainingsOnly.ethics = [
      { record_type: 'ethics_training', record_date: '2025-03-01', completion_rate: 80, status: 'completed' },
    ];
    expect(mapGovernance(trainingsOnly).ethicsIncidents).toBe(0);
  });

  it('passes mission fields through, coercing SDG commitments to numbers', () => {
    const raw = emptyRaw();
    raw.mission = {
      mission_statement: 'Make drinks regenerative.',
      vision_statement: 'A net-positive industry.',
      purpose_statement: 'People and planet.',
      is_benefit_corporation: true,
      sdg_commitments: ['3', '12', 13] as unknown as number[],
      climate_commitments: ['Net zero by 2040'],
    };
    const out = mapGovernance(raw);
    expect(out.missionStatement).toBe('Make drinks regenerative.');
    expect(out.isBenefitCorp).toBe(true);
    expect(out.sdgCommitments).toEqual([3, 12, 13]);
    expect(out.climateCommitments).toEqual(['Net zero by 2040']);
  });
});

describe('onBoardAtYearEnd', () => {
  const yearEnd = '2025-12-31';
  it('trusts dates over the is_current flag when dates exist', () => {
    expect(
      onBoardAtYearEnd(member({ appointment_date: '2020-01-01', is_current: false }), yearEnd),
    ).toBe(true);
    expect(
      onBoardAtYearEnd(member({ term_end_date: '2025-12-31', is_current: false }), yearEnd),
    ).toBe(true);
    expect(
      onBoardAtYearEnd(member({ term_end_date: '2025-12-30', is_current: true }), yearEnd),
    ).toBe(false);
  });
  it('falls back to is_current for undated rows', () => {
    expect(onBoardAtYearEnd(member({ is_current: true }), yearEnd)).toBe(true);
    expect(onBoardAtYearEnd(member({ is_current: false }), yearEnd)).toBe(false);
  });
});
