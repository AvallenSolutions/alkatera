import { describe, it, expect } from 'vitest';
import { calculateGovernanceScore, type GovernanceData } from '../score';

// Pins the output of the extraction from app/api/governance/score/route.ts.
// These numbers were computed by hand from the scoring rules; if this test
// breaks, the maths changed, which is exactly what it is here to catch.

const NOW = new Date('2026-06-15T00:00:00Z');

const FULL_FIXTURE: GovernanceData = {
  policies: [
    { policy_type: 'ethics', status: 'active', last_reviewed_at: '2026-01-01', is_public: true },
    { policy_type: 'environmental', status: 'active', last_reviewed_at: '2026-01-01', is_public: true },
    { policy_type: 'social', status: 'active', last_reviewed_at: '2026-01-01', is_public: false },
    { policy_type: 'governance', status: 'active', last_reviewed_at: '2026-01-01', is_public: false },
    // Draft policy must be ignored everywhere.
    { policy_type: 'ethics', status: 'draft', last_reviewed_at: '2026-01-01', is_public: true },
  ],
  stakeholders: [
    { id: 's1', stakeholder_type: 'employees' },
    { id: 's2', stakeholder_type: 'customers' },
    { id: 's3', stakeholder_type: 'community' },
  ],
  engagements: [
    // Two recent engagements, but with the SAME stakeholder: the score counts
    // distinct engaged stakeholders, not engagement rows.
    { stakeholder_id: 's1', engagement_date: '2026-05-01' },
    { stakeholder_id: 's1', engagement_date: '2026-04-01' },
    // Outside the 90-day window relative to NOW; ignored.
    { stakeholder_id: 's2', engagement_date: '2025-01-01' },
  ],
  boardMembers: [
    { is_independent: true, gender: 'male', meeting_attendance_rate: 80 },
    { is_independent: true, gender: 'female', meeting_attendance_rate: 90 },
    { is_independent: false, gender: 'male', meeting_attendance_rate: 100 },
    { is_independent: false, gender: 'male', meeting_attendance_rate: 70 },
  ],
  mission: { mission_statement: 'Drinks without the hangover for the planet.', is_benefit_corporation: true },
  lobbying: [
    { is_public: true },
    { is_public: false },
  ],
  ethics: [
    { record_type: 'ethics_training', record_date: '2026-03-01', completion_rate: 80 },
    { record_type: 'whistleblowing_case', status: 'resolved' },
  ],
};

describe('calculateGovernanceScore', () => {
  it('pins the full-fixture output of the pre-extraction implementation', () => {
    const result = calculateGovernanceScore(FULL_FIXTURE, NOW);
    expect(result).toEqual({
      // policy: coverage 4/4 (100) + reviewed 4/4 (100) + public 2/4 (50) over 3 → 83.3
      policy_score: 83.3,
      // stakeholders: type coverage 3/5 (60) + engaged 1/3 (33.3) over 2 → 46.7
      stakeholder_score: 46.7,
      // board: independence 2/4→100 + gender min/total 0.25→50 + attendance 85 over 3 → 78.3
      board_score: 78.3,
      // ethics: training 80 + (policy 50 + resolved cases 50) over 2 → 90
      ethics_score: 90,
      // transparency: mission 100 + lobbying 1/2 public 50 over 2 → 75
      transparency_score: 75,
      // 83.33*0.20 + 46.67*0.20 + 78.33*0.25 + 90*0.20 + 75*0.15 (unrounded inputs)
      overall_score: 74.8,
      data_completeness: 100,
    });
  });

  it('returns zeros, not NaN, for an org with no governance data at all', () => {
    const result = calculateGovernanceScore(
      { policies: [], stakeholders: [], engagements: [], boardMembers: [], mission: null, lobbying: [], ethics: [] },
      NOW,
    );
    expect(result).toEqual({
      overall_score: 0,
      policy_score: 0,
      stakeholder_score: 0,
      board_score: 0,
      ethics_score: 0,
      transparency_score: 0,
      data_completeness: 0,
    });
  });

  it('measures review recency and training year against the injected clock', () => {
    // Same fixture, evaluated two years later: reviews go stale, the training
    // falls outside the calendar year, and the engagements age out.
    const later = calculateGovernanceScore(FULL_FIXTURE, new Date('2028-06-15T00:00:00Z'));
    expect(later.policy_score).toBe(50); // coverage 100 + reviewed 0 + public 50 over 3
    expect(later.stakeholder_score).toBe(30); // coverage 60 + engaged 0 over 2
    // Training gone; whistleblowing component (policy + resolved) remains alone.
    expect(later.ethics_score).toBe(100);
  });
});
