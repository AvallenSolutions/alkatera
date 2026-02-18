/**
 * Period calculation utilities for the Log Data page.
 * Generates available periods for monthly, quarterly, and annual cadences.
 */

export interface Period {
  start: string; // ISO date string, e.g. "2026-01-01"
  end: string;   // ISO date string, e.g. "2026-01-31"
  label: string; // Display label, e.g. "January 2026"
}

export type Cadence = 'monthly' | 'quarterly' | 'annual';

/**
 * Get the last day of a month.
 */
function lastDayOfMonth(year: number, month: number): number {
  // month is 0-indexed here (0=Jan, 11=Dec)
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Format a date as ISO date string (YYYY-MM-DD).
 */
function toISODate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Generate available periods for a given cadence.
 *
 * - Monthly: last 24 months (from current month backwards)
 * - Quarterly: last 8 quarters
 * - Annual: last 3 full years + current year
 */
export function getAvailablePeriods(cadence: Cadence): Period[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const periods: Period[] = [];

  switch (cadence) {
    case 'monthly': {
      // Generate last 24 months, most recent first
      for (let i = 0; i < 24; i++) {
        let month = currentMonth - i;
        let year = currentYear;
        while (month < 0) {
          month += 12;
          year -= 1;
        }
        const lastDay = lastDayOfMonth(year, month);
        periods.push({
          start: toISODate(year, month, 1),
          end: toISODate(year, month, lastDay),
          label: `${MONTH_NAMES[month]} ${year}`,
        });
      }
      break;
    }

    case 'quarterly': {
      // Generate last 8 quarters, most recent first
      // Current quarter: floor(currentMonth / 3)
      const currentQuarter = Math.floor(currentMonth / 3); // 0=Q1, 1=Q2, 2=Q3, 3=Q4
      for (let i = 0; i < 8; i++) {
        let q = currentQuarter - i;
        let year = currentYear;
        while (q < 0) {
          q += 4;
          year -= 1;
        }
        const startMonth = q * 3; // 0, 3, 6, 9
        const endMonth = startMonth + 2; // 2, 5, 8, 11
        const lastDay = lastDayOfMonth(year, endMonth);
        periods.push({
          start: toISODate(year, startMonth, 1),
          end: toISODate(year, endMonth, lastDay),
          label: `Q${q + 1} ${year}`,
        });
      }
      break;
    }

    case 'annual': {
      // Current year + last 3 years (4 total), most recent first
      for (let i = 0; i < 4; i++) {
        const year = currentYear - i;
        periods.push({
          start: toISODate(year, 0, 1),
          end: toISODate(year, 11, 31),
          label: `${year}`,
        });
      }
      break;
    }
  }

  return periods;
}

/**
 * Calculate the number of months a period covers.
 */
export function periodMonths(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
}

/**
 * Get the financial year label for a given date.
 * UK financial year runs April–March (e.g. FY 2025-26 = Apr 2025 to Mar 2026).
 * Calendar year used as fallback (Jan–Dec).
 */
export function getFinancialYearLabel(date: Date): string {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();

  // UK FY: if month >= April (3), it's the start of FY year/year+1
  // If month < April, it's the end of FY year-1/year
  if (month >= 3) {
    return `FY ${year}-${String(year + 1).slice(2)}`;
  }
  return `FY ${year - 1}-${String(year).slice(2)}`;
}

/**
 * Get the start and end dates of the financial year containing a given date.
 * UK financial year: April 1 to March 31.
 */
export function getFinancialYearRange(date: Date): { start: string; end: string } {
  const month = date.getMonth();
  const year = date.getFullYear();

  if (month >= 3) {
    // Apr–Dec: FY starts this April
    return {
      start: `${year}-04-01`,
      end: `${year + 1}-03-31`,
    };
  }
  // Jan–Mar: FY started last April
  return {
    start: `${year - 1}-04-01`,
    end: `${year}-03-31`,
  };
}
