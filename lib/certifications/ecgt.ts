// ECGT (EU Empowering Consumers for the Green Transition Directive) deadline
// logic. Pure and dependency-free so it is unit-testable and usable on both
// client and server.

/** Submission deadline to retain B Corp logo rights under ECGT. */
export const ECGT_SUBMISSION_DEADLINE = '2026-07-15';
/** ECGT enforcement begins. */
export const ECGT_ENFORCEMENT_DATE = '2026-09-27';
export const ECGT_GUIDANCE_URL =
  'https://kb.bimpactassessment.net/en/support/solutions/articles/43000764829';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type EcgtSeverity = 'amber' | 'red';

export interface EcgtStatus {
  daysRemaining: number;
  deadlinePassed: boolean;
  severity: EcgtSeverity;
  /** Not yet ready and fewer than 90 days remain. */
  atRisk: boolean;
  deadlineLabel: string;
  enforcementLabel: string;
}

function toUtcMidnight(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole days from `today` until the ECGT submission deadline (can be negative). */
export function daysUntilEcgtDeadline(today: Date = new Date()): number {
  const deadline = toUtcMidnight(new Date(ECGT_SUBMISSION_DEADLINE));
  const now = toUtcMidnight(today);
  return Math.round((deadline - now) / MS_PER_DAY);
}

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Full ECGT status. Amber when more than 60 days remain, red at 60 days or
 * fewer (including once the deadline has passed).
 */
export function getEcgtStatus(
  isReadyToSubmit: boolean,
  today: Date = new Date(),
): EcgtStatus {
  const daysRemaining = daysUntilEcgtDeadline(today);
  const deadlinePassed = daysRemaining < 0;
  const severity: EcgtSeverity = daysRemaining > 60 ? 'amber' : 'red';
  const atRisk = !isReadyToSubmit && daysRemaining < 90;
  return {
    daysRemaining,
    deadlinePassed,
    severity,
    atRisk,
    deadlineLabel: formatDeadline(ECGT_SUBMISSION_DEADLINE),
    enforcementLabel: formatDeadline(ECGT_ENFORCEMENT_DATE),
  };
}
