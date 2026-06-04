import { interpolate } from '@/lib/vitality/environmental';

/**
 * Reduction-target scoring — ambition × credibility.
 *
 * A published target is only worth crediting if it's both ambitious
 * (a steep enough cut, soon enough) AND credible (independently
 * validated, with a real baseline — not a vague "net zero someday"
 * claim). We score the two axes separately and multiply, so a wildly
 * ambitious but unverified pledge and a weak-but-validated one both
 * land in the middle, while a steep, SBTi-validated, baselined target
 * scores near the top.
 *
 *   ambition (0–100):
 *     - With an interim target ("X% by YYYY from BBBB"): convert to
 *       a per-year reduction rate and grade against Paris alignment
 *       (~4.2%/yr ≈ 70). Steeper scores higher.
 *     - Otherwise fall back to the net-zero year alone: 2030 = 100,
 *       2040 = 70, 2050 = 40.
 *
 *   credibility (0–1):
 *     - SBTi-validated         → 1.0
 *     - SBTi targets_set       → 0.9
 *     - SBTi committed         → 0.6
 *     - bare claim (no SBTi)   → 0.4
 *     - +0.1 when a baseline year is present (capped at 1.0)
 *
 * Returns null when there is no target data at all, so the climate
 * pillar redistributes weight instead of scoring a hard zero.
 */

export interface TargetInputs {
  /** Interim reduction target, e.g. 50 for "50% by 2030". */
  interimReductionPct: number | null;
  /** Year the interim target is set against, e.g. 2030. */
  interimTargetYear: number | null;
  /** Baseline year the target is measured from, e.g. 2019. */
  baselineYear: number | null;
  /** Headline net-zero / carbon-neutral target year. */
  netZeroYear: number | null;
  /** SBTi status: 'committed' | 'targets_set' | 'none' | null. */
  sbtStatus: string | null;
  /** Independently SBTi-validated. */
  sbtiValidated: boolean;
}

/** Per-year reduction rate → ambition. ~4.2%/yr is Paris-aligned for many sectors. */
const PACE_ANCHORS: Array<[number, number]> = [
  [0, 20],
  [2, 40],
  [4.2, 70],
  [7, 90],
  [10, 100],
];

/** Net-zero year → ambition (ascending x; interpolate clamps the ends). */
const NET_ZERO_ANCHORS: Array<[number, number]> = [
  [2030, 100],
  [2040, 70],
  [2050, 40],
];

export function scoreTarget(t: TargetInputs): number | null {
  // ── Ambition ──────────────────────────────────────────────
  let ambition: number | null = null;
  if (
    t.interimReductionPct != null &&
    t.interimReductionPct > 0 &&
    t.interimTargetYear != null &&
    t.baselineYear != null &&
    t.interimTargetYear > t.baselineYear
  ) {
    const years = t.interimTargetYear - t.baselineYear;
    const pctPerYear = t.interimReductionPct / years;
    ambition = interpolate(pctPerYear, PACE_ANCHORS);
  } else if (t.netZeroYear != null && t.netZeroYear > 0) {
    ambition = interpolate(t.netZeroYear, NET_ZERO_ANCHORS);
  }

  if (ambition == null) return null;

  // ── Credibility ───────────────────────────────────────────
  let credibility: number;
  if (t.sbtiValidated) credibility = 1.0;
  else if (t.sbtStatus === 'targets_set') credibility = 0.9;
  else if (t.sbtStatus === 'committed') credibility = 0.6;
  else credibility = 0.4; // a target exists but carries no external validation

  // A declared baseline year is evidence of a real, accountable plan.
  if (credibility < 1.0 && t.baselineYear != null) {
    credibility = Math.min(1.0, credibility + 0.1);
  }

  return Math.round(ambition * credibility);
}
