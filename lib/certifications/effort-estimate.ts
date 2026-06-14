// A rough "how far are we / how long to submission-ready" estimate, so a brand
// (especially one not yet started) can decide to begin and set expectations.
// Pure + testable; reuses the roadmap buckets.

import { buildRoadmap } from './roadmap';
import type { CertificationReadiness } from './scoring';

export interface EffortEstimate {
  readyToSubmit: boolean;
  /** Quick wins: platform data already found, just needs confirming. */
  confirmCount: number;
  /** Requirements needing fresh evidence (mandatory-without-data + gaps). */
  effortfulCount: number;
  minWeeks: number;
  maxWeeks: number;
  summary: string;
}

export function estimateEffort(readiness: CertificationReadiness): EffortEstimate {
  const actions = buildRoadmap(readiness);
  const confirmCount = actions.filter((a) => a.bucket === 'confirm').length;
  const effortfulCount = actions.filter((a) => a.bucket === 'mandatory' || a.bucket === 'gap').length;

  if (readiness.isReadyToSubmit) {
    return {
      readyToSubmit: true,
      confirmCount,
      effortfulCount,
      minWeeks: 0,
      maxWeeks: 0,
      summary: "You've met every Year-0 requirement — you're ready to submit for certification.",
    };
  }

  // ~0.2 weeks to confirm found data, ~0.8 weeks per requirement needing fresh
  // evidence; widen to a band so it reads as an estimate, not a promise.
  const weeks = confirmCount * 0.2 + effortfulCount * 0.8;
  const minWeeks = Math.max(1, Math.floor(weeks * 0.7));
  const maxWeeks = Math.max(minWeeks + 1, Math.ceil(weeks * 1.3));

  const parts: string[] = [];
  if (confirmCount > 0) parts.push(`${confirmCount} quick confirmation${confirmCount === 1 ? '' : 's'} of data we already have`);
  if (effortfulCount > 0) parts.push(`${effortfulCount} requirement${effortfulCount === 1 ? '' : 's'} needing fresh evidence`);

  return {
    readyToSubmit: false,
    confirmCount,
    effortfulCount,
    minWeeks,
    maxWeeks,
    summary: `About ${minWeeks}–${maxWeeks} weeks to submission-ready: ${parts.join(', and ')}.`,
  };
}
