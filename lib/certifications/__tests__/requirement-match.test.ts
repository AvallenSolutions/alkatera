import { describe, it, expect } from 'vitest';
import { matchRequirement } from '../requirement-match';
import type { RequirementStatus, RequirementStatusValue } from '../scoring';

function req(overrides: Partial<RequirementStatus> = {}): RequirementStatus {
  return {
    requirementId: `id-${overrides.code ?? 'x'}`,
    code: 'IT5-Y0-001',
    name: 'Measure your GHG footprint',
    description: null,
    topicArea: 'Climate Action',
    section: null,
    orderIndex: 0,
    applicableFromYear: 0,
    status: 'not_started' as RequirementStatusValue,
    evidenceCount: 0,
    verifiedCount: 0,
    applicable: true,
    ...overrides,
  };
}

describe('matchRequirement', () => {
  it('returns null for an empty query or no matches', () => {
    expect(matchRequirement([req()], '   ')).toBeNull();
    expect(matchRequirement([req()], 'nonexistent topic')).toBeNull();
  });

  it('matches an exact code case-insensitively and wins over fuzzy matches', () => {
    const target = req({ code: 'IT2-Y0-001', name: 'Living wage', topicArea: 'Fair Work' });
    const other = req({ code: 'IT5-Y0-001', name: 'GHG', topicArea: 'Climate Action' });
    const m = matchRequirement([other, target], 'it2-y0-001');
    expect(m?.best.code).toBe('IT2-Y0-001');
    expect(m?.others).toHaveLength(0);
  });

  it('matches on a name substring', () => {
    const m = matchRequirement(
      [req({ code: 'IT2-Y0-001', name: 'Pay a living wage', topicArea: 'Fair Work' })],
      'living wage',
    );
    expect(m?.best.code).toBe('IT2-Y0-001');
  });

  it('matches on a topic substring and returns all candidates ranked', () => {
    const y0 = req({ code: 'IT5-Y0-001', applicableFromYear: 0, status: 'not_started' });
    const y3 = req({ code: 'IT5-Y3-002', applicableFromYear: 3, status: 'not_started' });
    const m = matchRequirement([y3, y0], 'climate');
    expect(m?.best.code).toBe('IT5-Y0-001'); // earlier year ranks first
    expect(m?.others.map((r) => r.code)).toEqual(['IT5-Y3-002']);
  });

  it('ranks unmet requirements ahead of already-passed ones', () => {
    const passed = req({ code: 'IT5-Y0-001', status: 'passed', orderIndex: 0 });
    const unmet = req({ code: 'IT5-Y0-002', status: 'not_started', orderIndex: 1 });
    const m = matchRequirement([passed, unmet], 'climate');
    expect(m?.best.code).toBe('IT5-Y0-002');
  });

  it('ignores requirements that do not apply to the org', () => {
    const excluded = req({ code: 'IT5-Y0-009', applicable: false });
    expect(matchRequirement([excluded], 'IT5-Y0-009')).toBeNull();
  });
});
