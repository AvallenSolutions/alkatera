import {
  format,
  parseISO,
  differenceInMonths,
  differenceInDays,
  subMonths,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
} from 'date-fns';

/**
 * Format a reporting period range as a human-readable label.
 * e.g. "Jan 2026 - Mar 2026" or "2026" for full-year periods.
 */
export function formatPeriodRange(start: string, end: string): string {
  const startDate = parseISO(start);
  const endDate = parseISO(end);

  const startFormatted = format(startDate, 'd MMM yyyy');
  const endFormatted = format(endDate, 'd MMM yyyy');

  // If same month, simplify
  if (format(startDate, 'MMM yyyy') === format(endDate, 'MMM yyyy')) {
    return format(startDate, 'MMM yyyy');
  }

  // If full calendar year
  if (
    startDate.getMonth() === 0 &&
    startDate.getDate() === 1 &&
    endDate.getMonth() === 11 &&
    endDate.getDate() === 31 &&
    startDate.getFullYear() === endDate.getFullYear()
  ) {
    return startDate.getFullYear().toString();
  }

  return `${startFormatted} - ${endFormatted}`;
}

/**
 * Calculate the equivalent previous period for comparison.
 * If the current period is 3 months long, the previous period is the 3 months before it.
 */
export function getPreviousPeriod(
  start: string,
  end: string
): { start: string; end: string } {
  const startDate = parseISO(start);
  const endDate = parseISO(end);

  const durationDays = differenceInDays(endDate, startDate) + 1;
  const previousEnd = subDays(startDate, 1);
  const previousStart = subDays(previousEnd, durationDays - 1);

  return {
    start: format(previousStart, 'yyyy-MM-dd'),
    end: format(previousEnd, 'yyyy-MM-dd'),
  };
}

export interface PeriodChange {
  metric: string;
  current: number;
  previous: number;
  delta: number;
  percentageChange: number | null;
  direction: 'up' | 'down' | 'unchanged';
}

/**
 * Calculate changes between two sets of metric values.
 */
export function calculatePeriodChanges(
  current: Record<string, number>,
  previous: Record<string, number>
): PeriodChange[] {
  const changes: PeriodChange[] = [];

  for (const metric of Object.keys(current)) {
    const currentVal = current[metric] ?? 0;
    const previousVal = previous[metric] ?? 0;
    const delta = currentVal - previousVal;
    const percentageChange =
      previousVal !== 0 ? (delta / previousVal) * 100 : null;

    changes.push({
      metric,
      current: currentVal,
      previous: previousVal,
      delta,
      percentageChange,
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'unchanged',
    });
  }

  return changes;
}

/**
 * Check if two periods overlap.
 */
export function periodsOverlap(
  a: { start: string; end: string },
  b: { start: string; end: string }
): boolean {
  const aStart = parseISO(a.start);
  const aEnd = parseISO(a.end);
  const bStart = parseISO(b.start);
  const bEnd = parseISO(b.end);

  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Calculate period duration in months (approximate).
 */
export function periodDurationMonths(start: string, end: string): number {
  return differenceInMonths(parseISO(end), parseISO(start)) + 1;
}

/**
 * Generate common period presets for the given year.
 */
export function getReportingPeriodPresets(year: number) {
  return [
    {
      label: 'Q1',
      from: new Date(year, 0, 1),
      to: endOfQuarter(new Date(year, 0, 1)),
    },
    {
      label: 'Q2',
      from: new Date(year, 3, 1),
      to: endOfQuarter(new Date(year, 3, 1)),
    },
    {
      label: 'Q3',
      from: new Date(year, 6, 1),
      to: endOfQuarter(new Date(year, 6, 1)),
    },
    {
      label: 'Q4',
      from: new Date(year, 9, 1),
      to: endOfQuarter(new Date(year, 9, 1)),
    },
    {
      label: 'Full Year',
      from: new Date(year, 0, 1),
      to: new Date(year, 11, 31),
    },
  ];
}
