/**
 * periodsCovered drives Xero-vs-utility/fleet suppression: a signal row must
 * exist for EVERY month an entry covers (clamped to the reporting window), or
 * Xero invoices in uncovered months double-count against the entry's
 * full-period quantity (CODE_REVIEW_2026-06-10.md B7).
 */
import { describe, it, expect } from 'vitest';
import { periodsCovered, periodFromDate } from '../slice-mapping';

describe('periodFromDate', () => {
  it('returns YYYY-MM', () => {
    expect(periodFromDate('2025-06-15')).toBe('2025-06');
    expect(periodFromDate(null)).toBe('unknown');
  });
});

describe('periodsCovered', () => {
  const WINDOW = ['2025-01-01', '2025-12-31'] as const;

  it('covers every month of an annual bill', () => {
    const periods = periodsCovered('2025-01-01', '2025-12-31', ...WINDOW);
    expect(periods).toHaveLength(12);
    expect(periods[0]).toBe('2025-01');
    expect(periods[11]).toBe('2025-12');
  });

  it('covers a quarterly bill spanning a year boundary, clamped to the window', () => {
    const periods = periodsCovered('2024-11-15', '2025-02-14', ...WINDOW);
    expect(periods).toEqual(['2025-01', '2025-02']);
  });

  it('clamps an entry extending past the window end', () => {
    const periods = periodsCovered('2025-11-01', '2026-04-30', ...WINDOW);
    expect(periods).toEqual(['2025-11', '2025-12']);
  });

  it('a custom 12-month period starting mid-window stays inside the window', () => {
    // e.g. facility period 15 Jun 2025 – 14 Jun 2026 against a calendar window
    const periods = periodsCovered('2025-06-15', '2026-06-14', ...WINDOW);
    expect(periods[0]).toBe('2025-06');
    expect(periods[periods.length - 1]).toBe('2025-12');
    expect(periods).toHaveLength(7);
  });

  it('an entry entirely outside the window covers nothing', () => {
    expect(periodsCovered('2024-01-01', '2024-12-31', ...WINDOW)).toEqual([]);
  });

  it('a single-month entry covers exactly its month', () => {
    expect(periodsCovered('2025-06-01', '2025-06-30', ...WINDOW)).toEqual(['2025-06']);
  });

  it('missing end date falls back to the start month', () => {
    expect(periodsCovered('2025-06-15', null, ...WINDOW)).toEqual(['2025-06']);
  });

  it('missing start date returns the unknown sentinel', () => {
    expect(periodsCovered(null, '2025-06-30', ...WINDOW)).toEqual(['unknown']);
  });
});
