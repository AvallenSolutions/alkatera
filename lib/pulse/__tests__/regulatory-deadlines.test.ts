/**
 * Tests for compliance calendar expansion.
 *
 * Guards against two classes of bug that would be embarrassing for a
 * regulatory-exposure widget:
 *   - Missing a deadline that's coming up (quarterly CBAM, PPT returns etc.)
 *   - Producing bogus deadlines past the window
 */

import { describe, expect, it } from 'vitest';
import { expandDeadlines, COMPLIANCE_DEADLINES } from '../regulatory-deadlines';

describe('expandDeadlines', () => {
  const REFERENCE_DATE = new Date('2026-04-15T12:00:00Z');

  it('returns every configured deadline inside a 12-month window', () => {
    const out = expandDeadlines(COMPLIANCE_DEADLINES, 12, REFERENCE_DATE);
    // Every regime should have at least one occurrence in a 12-month window.
    const regimes = new Set(out.map(d => d.regime));
    expect(regimes).toContain('uk_ets');
    expect(regimes).toContain('cbam');
    expect(regimes).toContain('plastic_tax');
    expect(regimes).toContain('epr');
    expect(regimes).toContain('csrd');
  });

  it('sorts results by due_date ascending', () => {
    const out = expandDeadlines(COMPLIANCE_DEADLINES, 12, REFERENCE_DATE);
    for (let i = 1; i < out.length; i += 1) {
      expect(out[i].due_date >= out[i - 1].due_date).toBe(true);
    }
  });

  it('computes days_away relative to the reference date', () => {
    const out = expandDeadlines(COMPLIANCE_DEADLINES, 12, REFERENCE_DATE);
    for (const d of out) {
      const actualDaysAway = Math.round(
        (new Date(d.due_date).getTime() - REFERENCE_DATE.getTime()) / 86_400_000,
      );
      // Allow off-by-one from daylight-saving boundaries.
      expect(Math.abs(d.days_away - actualDaysAway)).toBeLessThanOrEqual(1);
    }
  });

  it('includes recently-past deadlines within 30 days (grace window)', () => {
    // Deadline from 2 weeks ago should still appear.
    const out = expandDeadlines(
      [
        {
          id: 'fake_recent',
          regime: 'uk_ets',
          regime_label: 'UK ETS',
          title: 'Fake recent deadline',
          description: '',
          recurrence: 'annual',
          month: REFERENCE_DATE.getMonth() + 1,
          day: 1,
          action_href: '/',
          source: 'test',
        },
      ],
      12,
      REFERENCE_DATE,
    );
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].days_away).toBeLessThanOrEqual(0);
  });

  it('excludes deadlines beyond the end of the window', () => {
    const out = expandDeadlines(COMPLIANCE_DEADLINES, 3, REFERENCE_DATE);
    const endCutoff = new Date(REFERENCE_DATE);
    endCutoff.setMonth(endCutoff.getMonth() + 3);
    for (const d of out) {
      expect(new Date(d.due_date).getTime()).toBeLessThanOrEqual(
        endCutoff.getTime(),
      );
    }
  });

  it('handles empty deadline list', () => {
    expect(expandDeadlines([], 12, REFERENCE_DATE)).toEqual([]);
  });
});
