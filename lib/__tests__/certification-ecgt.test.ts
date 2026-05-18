import { describe, it, expect } from 'vitest';
import {
  daysUntilEcgtDeadline,
  getEcgtStatus,
} from '@/lib/certifications/ecgt';

describe('daysUntilEcgtDeadline', () => {
  it('counts whole days to 15 July 2026', () => {
    expect(daysUntilEcgtDeadline(new Date('2026-07-14'))).toBe(1);
    expect(daysUntilEcgtDeadline(new Date('2026-07-15'))).toBe(0);
    expect(daysUntilEcgtDeadline(new Date('2026-07-16'))).toBe(-1);
  });
});

describe('getEcgtStatus', () => {
  it('is amber when more than 60 days remain', () => {
    const s = getEcgtStatus(false, new Date('2026-05-01'));
    expect(s.severity).toBe('amber');
    expect(s.deadlinePassed).toBe(false);
  });

  it('is red at 60 days or fewer', () => {
    const s = getEcgtStatus(false, new Date('2026-06-01'));
    expect(s.severity).toBe('red');
  });

  it('is red and deadlinePassed once past the deadline', () => {
    const s = getEcgtStatus(true, new Date('2026-08-01'));
    expect(s.severity).toBe('red');
    expect(s.deadlinePassed).toBe(true);
  });

  it('flags atRisk when not ready and under 90 days remain', () => {
    expect(getEcgtStatus(false, new Date('2026-05-01')).atRisk).toBe(true);
    expect(getEcgtStatus(true, new Date('2026-05-01')).atRisk).toBe(false);
    expect(getEcgtStatus(false, new Date('2026-01-01')).atRisk).toBe(false);
  });
});
