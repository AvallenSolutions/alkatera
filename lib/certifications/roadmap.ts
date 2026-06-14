// Turns a B Corp readiness snapshot into an ordered "what to do next" list, so
// users get a path instead of a 41-item checklist. Pure + unit-testable.

import type { CertificationReadiness, RequirementStatus } from './scoring';

export type NextActionBucket = 'confirm' | 'mandatory' | 'gap';

export interface NextAction {
  requirementId: string;
  code: string;
  name: string;
  topicArea: string;
  bucket: NextActionBucket;
  /** Year-0 (blocks submission) — surfaced with extra emphasis. */
  mandatory: boolean;
  /** Plain-English reason this is the next thing to do. */
  reason: string;
}

const BUCKET_LABEL: Record<NextActionBucket, string> = {
  confirm: 'Confirm',
  mandatory: 'Mandatory',
  gap: 'Needs evidence',
};

export function bucketLabel(b: NextActionBucket): string {
  return BUCKET_LABEL[b];
}

/**
 * Build the ordered next-actions list. Ordering, easiest-and-most-urgent first:
 *   1. Mandatory (Year 0) where we already have platform data to confirm
 *   2. Mandatory with no data yet
 *   3. Non-mandatory where platform data is ready to confirm (quick wins)
 *   4. Remaining applicable gaps
 * Already-passed and not-yet-due (future-year) requirements are excluded.
 */
export function buildRoadmap(readiness: CertificationReadiness): NextAction[] {
  // Requirement codes that have platform data available to confirm.
  const platformCodes = new Set<string>();
  for (const entry of readiness.platformHealth ?? []) {
    if (entry.status === 'complete' || entry.status === 'partial') {
      for (const code of entry.requirementCodes) platformCodes.add(code);
    }
  }

  const candidates = readiness.requirementStatuses.filter(
    (rs) => rs.applicable !== false && (rs.status === 'in_progress' || rs.status === 'not_started'),
  );

  const actions = candidates.map((rs): NextAction & { rank: number } => {
    const hasPlatform = platformCodes.has(rs.code) || rs.status === 'in_progress';
    const mandatory = rs.applicableFromYear === 0;
    let bucket: NextActionBucket;
    let reason: string;
    let rank: number;
    if (hasPlatform && mandatory) {
      bucket = 'confirm';
      reason = 'Mandatory for submission, and we already have data — just confirm it.';
      rank = 0;
    } else if (mandatory) {
      bucket = 'mandatory';
      reason = 'Mandatory before you can submit for your first certification.';
      rank = 1;
    } else if (hasPlatform) {
      bucket = 'confirm';
      reason = 'We found data for this on the platform — confirm it to pass.';
      rank = 2;
    } else {
      bucket = 'gap';
      reason = 'Needs evidence — upload a document or link your data.';
      rank = 3;
    }
    return { requirementId: rs.requirementId, code: rs.code, name: rs.name, topicArea: rs.topicArea, bucket, mandatory, reason, rank };
  });

  actions.sort((a, b) => a.rank - b.rank || a.code.localeCompare(b.code));
  return actions.map(({ rank: _rank, ...a }) => a);
}

/** The first n next-actions (default 5). */
export function topActions(readiness: CertificationReadiness, n = 5): NextAction[] {
  return buildRoadmap(readiness).slice(0, n);
}

export type { RequirementStatus };
