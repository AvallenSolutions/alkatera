import { describe, it, expect } from 'vitest';
import { estimateEffort } from '../effort-estimate';
import type { CertificationReadiness, RequirementStatus } from '../scoring';

const rs = (code: string, year: 0 | 3 | 5, status: RequirementStatus['status']): RequirementStatus => ({
  requirementId: code, code, name: code, description: null, topicArea: 'Climate Action', section: null,
  orderIndex: 0, applicableFromYear: year, status, evidenceCount: 0, verifiedCount: 0, applicable: true,
});

function readiness(reqs: RequirementStatus[], ready: boolean, platformCodes: string[] = []): CertificationReadiness {
  return {
    hasCertification: true, frameworkId: 'f', certificationId: 'c', certificationType: 'new',
    ecgtApplicable: false, certificationStartDate: '2026-01-01', currentYearBand: 0,
    foundationComplete: ready, riskToolComplete: ready, isReadyToSubmit: ready,
    year0ReadinessPct: ready ? 100 : 0, programmeReadinessPct: 0,
    blockingRequirements: ready ? [] : reqs.filter((r) => r.applicableFromYear === 0 && r.status !== 'passed'),
    requirementStatuses: reqs, topicSummaries: [],
    platformHealth: platformCodes.length ? [{ module: 'm', moduleLabel: 'M', moduleLink: '/', status: 'complete', requirementCodes: platformCodes, note: null }] : [],
  };
}

describe('estimateEffort', () => {
  it('reports ready when there are no blockers', () => {
    const e = estimateEffort(readiness([rs('A', 0, 'passed')], true));
    expect(e.readyToSubmit).toBe(true);
    expect(e.minWeeks).toBe(0);
  });

  it('gives a week band split into confirmations vs fresh evidence', () => {
    const reqs = [rs('CONFIRM', 0, 'not_started'), rs('GAP1', 0, 'not_started'), rs('GAP2', 3, 'not_started')];
    const e = estimateEffort(readiness(reqs, false, ['CONFIRM']));
    expect(e.readyToSubmit).toBe(false);
    expect(e.confirmCount).toBe(1);
    expect(e.effortfulCount).toBe(2);
    expect(e.minWeeks).toBeGreaterThanOrEqual(1);
    expect(e.maxWeeks).toBeGreaterThan(e.minWeeks);
    expect(e.summary).toMatch(/weeks to submission-ready/);
  });
});
