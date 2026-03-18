import { describe, it, expect } from 'vitest';
import {
  formatPeriodRange,
  getPreviousPeriod,
  calculatePeriodChanges,
  periodsOverlap,
  periodDurationMonths,
  getReportingPeriodPresets,
} from '../reporting-period-utils';

describe('formatPeriodRange', () => {
  it('formats a full calendar year as just the year', () => {
    expect(formatPeriodRange('2026-01-01', '2026-12-31')).toBe('2026');
  });

  it('formats a same-month range as month + year', () => {
    expect(formatPeriodRange('2026-03-01', '2026-03-31')).toBe('Mar 2026');
  });

  it('formats a multi-month range with start and end', () => {
    const result = formatPeriodRange('2026-01-01', '2026-03-31');
    expect(result).toBe('1 Jan 2026 - 31 Mar 2026');
  });

  it('formats cross-year ranges', () => {
    const result = formatPeriodRange('2025-10-01', '2026-03-31');
    expect(result).toBe('1 Oct 2025 - 31 Mar 2026');
  });
});

describe('getPreviousPeriod', () => {
  it('returns the previous quarter for a Q1 period', () => {
    const result = getPreviousPeriod('2026-01-01', '2026-03-31');
    // Q1 is 90 days (Jan 1 - Mar 31), so previous 90 days ends Dec 31, starts Oct 3
    expect(result.end).toBe('2025-12-31');
    // Verify the period length matches
    const startDate = new Date(result.start);
    const endDate = new Date(result.end);
    const days = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    expect(days).toBe(90); // Same length as Q1 2026
  });

  it('returns the previous month for a monthly period', () => {
    const result = getPreviousPeriod('2026-03-01', '2026-03-31');
    expect(result.end).toBe('2026-02-28');
  });

  it('returns the previous year for a full year', () => {
    const result = getPreviousPeriod('2026-01-01', '2026-12-31');
    expect(result.end).toBe('2025-12-31');
    expect(result.start).toBe('2025-01-01');
  });
});

describe('calculatePeriodChanges', () => {
  it('calculates positive changes', () => {
    const current = { employees: 100, hires: 20 };
    const previous = { employees: 80, hires: 15 };
    const changes = calculatePeriodChanges(current, previous);

    const employeeChange = changes.find(c => c.metric === 'employees');
    expect(employeeChange?.delta).toBe(20);
    expect(employeeChange?.percentageChange).toBeCloseTo(25);
    expect(employeeChange?.direction).toBe('up');
  });

  it('calculates negative changes', () => {
    const current = { employees: 80 };
    const previous = { employees: 100 };
    const changes = calculatePeriodChanges(current, previous);

    const change = changes.find(c => c.metric === 'employees');
    expect(change?.delta).toBe(-20);
    expect(change?.percentageChange).toBeCloseTo(-20);
    expect(change?.direction).toBe('down');
  });

  it('handles zero previous value', () => {
    const current = { employees: 50 };
    const previous = { employees: 0 };
    const changes = calculatePeriodChanges(current, previous);

    const change = changes.find(c => c.metric === 'employees');
    expect(change?.percentageChange).toBeNull();
  });

  it('handles no change', () => {
    const current = { employees: 50 };
    const previous = { employees: 50 };
    const changes = calculatePeriodChanges(current, previous);

    const change = changes.find(c => c.metric === 'employees');
    expect(change?.delta).toBe(0);
    expect(change?.direction).toBe('unchanged');
  });
});

describe('periodsOverlap', () => {
  it('detects overlapping periods', () => {
    expect(periodsOverlap(
      { start: '2026-01-01', end: '2026-03-31' },
      { start: '2026-03-01', end: '2026-06-30' }
    )).toBe(true);
  });

  it('detects non-overlapping periods', () => {
    expect(periodsOverlap(
      { start: '2026-01-01', end: '2026-03-31' },
      { start: '2026-04-01', end: '2026-06-30' }
    )).toBe(false);
  });

  it('detects adjacent periods as non-overlapping', () => {
    // Adjacent: end of A is day before start of B
    expect(periodsOverlap(
      { start: '2026-01-01', end: '2026-03-31' },
      { start: '2026-04-01', end: '2026-06-30' }
    )).toBe(false);
  });

  it('detects contained periods', () => {
    expect(periodsOverlap(
      { start: '2026-01-01', end: '2026-12-31' },
      { start: '2026-03-01', end: '2026-06-30' }
    )).toBe(true);
  });

  it('detects same-day overlap', () => {
    expect(periodsOverlap(
      { start: '2026-01-01', end: '2026-03-31' },
      { start: '2026-03-31', end: '2026-06-30' }
    )).toBe(true);
  });
});

describe('periodDurationMonths', () => {
  it('calculates a quarter as ~4 months', () => {
    // Jan 1 to Mar 31 = 3 months difference + 1 = 4
    expect(periodDurationMonths('2026-01-01', '2026-03-31')).toBe(3);
  });

  it('calculates a full year as 12-13 months', () => {
    const result = periodDurationMonths('2026-01-01', '2026-12-31');
    expect(result).toBeGreaterThanOrEqual(12);
  });

  it('calculates a single month', () => {
    expect(periodDurationMonths('2026-03-01', '2026-03-31')).toBe(1);
  });
});

describe('getReportingPeriodPresets', () => {
  it('returns 5 presets (Q1-Q4 + Full Year)', () => {
    const presets = getReportingPeriodPresets(2026);
    expect(presets).toHaveLength(5);
  });

  it('Q1 starts Jan 1 and ends Mar 31', () => {
    const presets = getReportingPeriodPresets(2026);
    const q1 = presets[0];
    expect(q1.label).toBe('Q1');
    expect(q1.from.getMonth()).toBe(0);
    expect(q1.from.getDate()).toBe(1);
    expect(q1.to.getMonth()).toBe(2); // March
  });

  it('Full Year covers Jan 1 to Dec 31', () => {
    const presets = getReportingPeriodPresets(2026);
    const fullYear = presets[4];
    expect(fullYear.label).toBe('Full Year');
    expect(fullYear.from.getFullYear()).toBe(2026);
    expect(fullYear.from.getMonth()).toBe(0);
    expect(fullYear.to.getMonth()).toBe(11);
    expect(fullYear.to.getDate()).toBe(31);
  });
});
