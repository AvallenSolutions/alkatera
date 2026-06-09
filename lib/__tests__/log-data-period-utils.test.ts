import { describe, it, expect } from 'vitest';
import {
  getCustomAnnualPeriod,
  formatISODateDisplay,
  formatPeriodRangeLabel,
} from '../log-data/period-utils';

describe('getCustomAnnualPeriod', () => {
  it('builds an exactly-12-month, day-precise window (the spec example)', () => {
    const p = getCustomAnnualPeriod('2024-06-15');
    expect(p.start).toBe('2024-06-15');
    expect(p.end).toBe('2025-06-14');
    expect(p.label).toBe('15 Jun 2024 - 14 Jun 2025');
  });

  it('handles a calendar-year start', () => {
    const p = getCustomAnnualPeriod('2023-01-01');
    expect(p.start).toBe('2023-01-01');
    expect(p.end).toBe('2023-12-31');
  });

  it('handles a leap-day start (no 29 Feb the following year → ends 28 Feb)', () => {
    const p = getCustomAnnualPeriod('2024-02-29');
    expect(p.end).toBe('2025-02-28');
  });

  it('handles a start that lands the end on a month boundary', () => {
    // 1 Mar 2024 → 28 Feb 2025 (2025 is not a leap year)
    expect(getCustomAnnualPeriod('2024-03-01').end).toBe('2025-02-28');
  });

  it('does not drift across the year when the next year IS a leap year', () => {
    // 1 Mar 2023 → 29 Feb 2024 (2024 is a leap year)
    expect(getCustomAnnualPeriod('2023-03-01').end).toBe('2024-02-29');
  });
});

describe('formatISODateDisplay / formatPeriodRangeLabel', () => {
  it('formats a single ISO date', () => {
    expect(formatISODateDisplay('2024-06-15')).toBe('15 Jun 2024');
    expect(formatISODateDisplay('2025-12-01')).toBe('1 Dec 2025');
  });

  it('formats a range with a plain hyphen (no em dash)', () => {
    expect(formatPeriodRangeLabel('2024-06-15', '2025-06-14')).toBe('15 Jun 2024 - 14 Jun 2025');
  });
});
