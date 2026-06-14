// Backward-planned schedule for a B Corp submission / recertification deadline,
// so brands working to a date know what must be done by when. Pure + testable.

export interface PlanMilestone {
  label: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  daysFromNow: number;
  done: boolean;
}

export interface DeadlinePlan {
  deadline: string;
  daysRemaining: number;
  overdue: boolean;
  milestones: PlanMilestone[];
}

const DAY = 86_400_000;

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The recertification deadline = 5 years after the cycle start. */
export function recertDeadline(certificationStartDate: string): string | null {
  const start = new Date(certificationStartDate);
  if (Number.isNaN(start.getTime())) return null;
  const d = new Date(start);
  d.setFullYear(d.getFullYear() + 5);
  return iso(d);
}

/**
 * Build the backward-planned milestone schedule from a hard deadline:
 * close blockers (-6mo), verify all evidence (-3mo), finalise the audit
 * package (-1mo), then submit on the day.
 */
export function buildDeadlinePlan(deadlineISO: string, today: Date = new Date()): DeadlinePlan | null {
  const deadline = new Date(deadlineISO);
  if (Number.isNaN(deadline.getTime())) return null;
  const dayFromNow = (d: Date) => Math.round((d.getTime() - today.getTime()) / DAY);

  const milestones: PlanMilestone[] = [
    { label: 'Close all blocking (Year 0) requirements', date: iso(addMonths(deadline, -6)), offset: -6 },
    { label: 'All evidence uploaded and verified', date: iso(addMonths(deadline, -3)), offset: -3 },
    { label: 'Audit package finalised and pre-audit checklist signed', date: iso(addMonths(deadline, -1)), offset: -1 },
    { label: 'Submit for audit', date: deadlineISO, offset: 0 },
  ].map((m) => {
    const dfn = dayFromNow(new Date(m.date));
    return { label: m.label, date: m.date, daysFromNow: dfn, done: dfn < 0 };
  });

  const daysRemaining = dayFromNow(deadline);
  return { deadline: deadlineISO, daysRemaining, overdue: daysRemaining < 0, milestones };
}
