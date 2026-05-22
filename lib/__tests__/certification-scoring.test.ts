import { describe, it, expect } from 'vitest';
import {
  deriveYearBand,
  evaluateStatus,
  computeReadiness,
  type RequirementInput,
  type CertMetaInput,
} from '@/lib/certifications/scoring';

describe('deriveYearBand', () => {
  const today = new Date('2026-05-17');

  it('returns 0 for null or undefined start date', () => {
    expect(deriveYearBand(null, today)).toBe(0);
    expect(deriveYearBand(undefined, today)).toBe(0);
  });

  it('returns 0 for a future start date', () => {
    expect(deriveYearBand('2027-01-01', today)).toBe(0);
  });

  it('returns 0 just before the 3rd anniversary', () => {
    expect(deriveYearBand('2023-05-18', today)).toBe(0);
  });

  it('returns 3 exactly on the 3rd anniversary', () => {
    expect(deriveYearBand('2023-05-17', today)).toBe(3);
  });

  it('returns 3 between years 3 and 5', () => {
    expect(deriveYearBand('2022-01-01', today)).toBe(3);
  });

  it('returns 5 exactly on the 5th anniversary', () => {
    expect(deriveYearBand('2021-05-17', today)).toBe(5);
  });

  it('returns 5 well past year 5', () => {
    expect(deriveYearBand('2015-01-01', today)).toBe(5);
  });
});

describe('evaluateStatus', () => {
  it('is future when not yet due', () => {
    expect(evaluateStatus([], 3, 0)).toBe('future');
    expect(evaluateStatus(['verified'], 5, 3)).toBe('future');
  });

  it('passes only with a verified link', () => {
    expect(evaluateStatus(['verified'], 0, 0)).toBe('passed');
    expect(evaluateStatus(['pending', 'verified'], 0, 0)).toBe('passed');
  });

  it('is in_progress for pending / needs_review / null but never passes', () => {
    expect(evaluateStatus(['pending'], 0, 0)).toBe('in_progress');
    expect(evaluateStatus(['needs_review'], 0, 0)).toBe('in_progress');
    expect(evaluateStatus([null], 0, 0)).toBe('in_progress');
  });

  it('is not_started with no usable evidence', () => {
    expect(evaluateStatus([], 0, 0)).toBe('not_started');
    expect(evaluateStatus(['rejected'], 0, 0)).toBe('not_started');
  });
});

function req(
  id: string,
  topicArea: string,
  applicableFromYear: 0 | 3 | 5,
  code = id,
): RequirementInput {
  return {
    id,
    code,
    name: id,
    description: null,
    section: null,
    topicArea,
    orderIndex: 0,
    applicableFromYear,
  };
}

const cert: CertMetaInput = {
  id: 'cert-1',
  certificationType: 'new',
  ecgtApplicable: false,
  certificationStartDate: null,
};

describe('computeReadiness', () => {
  const requirements: RequirementInput[] = [
    req('f1', 'foundation', 0, 'FR-E-001'),
    req('f2', 'foundation', 0, 'FR-R-000'),
    req('i1', 'Climate Action', 0, 'IT5-Y0-001'),
    req('i2', 'Climate Action', 3, 'IT5-Y3-001'),
  ];

  it('is not ready when a Year 0 requirement is unmet, and lists it as blocking', () => {
    const r = computeReadiness(
      requirements,
      { f1: ['verified'], f2: ['verified'] },
      cert,
    );
    expect(r.isReadyToSubmit).toBe(false);
    expect(r.blockingRequirements.map((b) => b.requirementId)).toEqual(['i1']);
  });

  it('is ready when all Year 0 requirements pass; Year 3 is future not blocking', () => {
    const r = computeReadiness(
      requirements,
      { f1: ['verified'], f2: ['verified'], i1: ['verified'] },
      cert,
    );
    expect(r.isReadyToSubmit).toBe(true);
    expect(r.blockingRequirements).toHaveLength(0);
    const year3 = r.requirementStatuses.find((s) => s.requirementId === 'i2');
    expect(year3?.status).toBe('future');
  });

  it('pending evidence never satisfies a Year 0 requirement', () => {
    const r = computeReadiness(
      requirements,
      { f1: ['verified'], f2: ['verified'], i1: ['pending'] },
      cert,
    );
    expect(r.isReadyToSubmit).toBe(false);
    expect(r.blockingRequirements.map((b) => b.requirementId)).toContain('i1');
  });

  it('foundationComplete only when every foundation requirement passes', () => {
    const partial = computeReadiness(
      requirements,
      { f1: ['verified'], f2: ['pending'] },
      cert,
    );
    expect(partial.foundationComplete).toBe(false);
    const full = computeReadiness(
      requirements,
      { f1: ['verified'], f2: ['verified'] },
      cert,
    );
    expect(full.foundationComplete).toBe(true);
  });

  it('riskToolComplete tracks the FR-R-000 requirement', () => {
    const notDone = computeReadiness(requirements, { f1: ['verified'] }, cert);
    expect(notDone.riskToolComplete).toBe(false);
    const done = computeReadiness(
      requirements,
      { f2: ['verified'] },
      cert,
    );
    expect(done.riskToolComplete).toBe(true);
  });

  it('builds topic summaries with Foundation first and per-year counts', () => {
    const r = computeReadiness(
      requirements,
      { f1: ['verified'], f2: ['verified'], i1: ['verified'] },
      cert,
    );
    expect(r.topicSummaries[0].topicArea).toBe('foundation');
    const climate = r.topicSummaries.find(
      (t) => t.topicArea === 'Climate Action',
    );
    expect(climate?.byYear[0]).toEqual({ met: 1, total: 1, applicable: true });
    expect(climate?.byYear[3]).toEqual({ met: 0, total: 1, applicable: false });
  });
});
