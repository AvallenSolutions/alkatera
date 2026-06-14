import { describe, it, expect } from 'vitest';
import { computeReadiness, type RequirementInput } from '../scoring';

const req = (id: string, year: 0 | 3 | 5, topic = 'Climate Action'): RequirementInput => ({
  id, code: id, name: id, description: null, section: null, topicArea: topic, orderIndex: 0, applicableFromYear: year,
});

// foundation requirements so year-0 set is meaningful
const REQS: RequirementInput[] = [
  req('FR-1', 0, 'foundation'),
  req('FR-2', 0, 'foundation'),
  req('IT-Y0', 0),
  req('IT-Y3', 3),
  req('IT-Y5', 5),
];

describe('computeReadiness — graded readiness figures', () => {
  it('reports 0% when nothing is verified', () => {
    const r = computeReadiness(REQS, {}, { id: 'c', certificationType: 'new', ecgtApplicable: false, certificationStartDate: '2026-01-01' });
    expect(r.year0ReadinessPct).toBe(0);
    expect(r.programmeReadinessPct).toBe(0);
    expect(r.isReadyToSubmit).toBe(false);
  });

  it('counts only verified evidence towards readiness', () => {
    const evidence = { 'FR-1': ['verified'], 'FR-2': ['pending'], 'IT-Y0': ['verified'] };
    const r = computeReadiness(REQS, evidence, { id: 'c', certificationType: 'new', ecgtApplicable: false, certificationStartDate: '2026-01-01' });
    // year-0 set is FR-1, FR-2, IT-Y0 -> 2 of 3 verified
    expect(r.year0ReadinessPct).toBe(67);
    // programme is 2 of 5 verified
    expect(r.programmeReadinessPct).toBe(40);
  });

  it('year-0 readiness is 100 once all Year-0 requirements pass', () => {
    const evidence = { 'FR-1': ['verified'], 'FR-2': ['verified'], 'IT-Y0': ['verified'] };
    const r = computeReadiness(REQS, evidence, { id: 'c', certificationType: 'new', ecgtApplicable: false, certificationStartDate: '2026-01-01' });
    expect(r.isReadyToSubmit).toBe(true);
    expect(r.year0ReadinessPct).toBe(100);
    // programme still excludes the not-yet-verified Year 3/5 reqs
    expect(r.programmeReadinessPct).toBe(60);
  });
});
