import { describe, it, expect } from 'vitest';
import { buildRoadmap } from '../roadmap';
import type { CertificationReadiness, RequirementStatus } from '../scoring';

const rs = (code: string, year: 0 | 3 | 5, status: RequirementStatus['status']): RequirementStatus => ({
  requirementId: code, code, name: code, description: null, topicArea: 'Climate Action', section: null,
  orderIndex: 0, applicableFromYear: year, status, evidenceCount: 0, verifiedCount: 0,
});

function readiness(reqs: RequirementStatus[], platformCodes: string[]): CertificationReadiness {
  return {
    hasCertification: true, frameworkId: 'f', certificationId: 'c', certificationType: 'new',
    ecgtApplicable: false, certificationStartDate: '2026-01-01', currentYearBand: 0,
    foundationComplete: false, riskToolComplete: false, isReadyToSubmit: false,
    year0ReadinessPct: 0, programmeReadinessPct: 0, blockingRequirements: [],
    requirementStatuses: reqs, topicSummaries: [],
    platformHealth: platformCodes.length ? [{ module: 'm', moduleLabel: 'M', moduleLink: '/', status: 'complete', requirementCodes: platformCodes, note: null }] : [],
  };
}

describe('buildRoadmap', () => {
  it('orders mandatory-with-data, then mandatory, then confirm, then gaps; excludes passed/future', () => {
    const reqs = [
      rs('GAP', 0, 'not_started'),       // mandatory, no platform -> mandatory
      rs('CONFIRM-Y3', 3, 'not_started'), // has platform, not mandatory -> confirm (rank 2)
      rs('MAND-DATA', 0, 'not_started'),  // mandatory + platform -> rank 0
      rs('DONE', 0, 'passed'),            // excluded
      rs('FUTURE', 5, 'future'),          // excluded
      rs('PLAIN-GAP', 3, 'not_started'),  // not mandatory, no platform -> gap (rank 3)
    ];
    const r = buildRoadmap(readiness(reqs, ['MAND-DATA', 'CONFIRM-Y3']));
    expect(r.map((a) => a.code)).toEqual(['MAND-DATA', 'GAP', 'CONFIRM-Y3', 'PLAIN-GAP']);
    expect(r[0].bucket).toBe('confirm');
    expect(r[0].mandatory).toBe(true);
    expect(r[1].bucket).toBe('mandatory');
    expect(r[3].bucket).toBe('gap');
  });

  it('treats in-progress requirements as confirm regardless of platform health', () => {
    const r = buildRoadmap(readiness([rs('INPROG', 3, 'in_progress')], []));
    expect(r[0].bucket).toBe('confirm');
  });
});
