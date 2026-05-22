/**
 * Governance pillar scoring — same blended pattern as the others.
 *
 * Locked weights (Tim, May 2026):
 *   Practices       60%   — governance_scores.overall_score
 *                            (internal 5-axis: Policy / Stakeholder /
 *                             Board / Ethics / Transparency)
 *   Certifications  30%   — split 80/20 between earned and in-progress:
 *                            0.8 × % of pursued frameworks with
 *                              status='certified'
 *                            0.2 × avg readiness_score across
 *                              status IN ('in_progress', 'ready')
 *   Year-on-year    10%   — change in governance_scores.overall_score
 *                            year-on-year, lenient anchors mirroring
 *                            Social (positive delta = good).
 *
 * Frameworks: CSRD ESRS G1 (Business Conduct), SASB FB-AB Governance,
 * B Corp Governance impact area.
 *
 * Locked product preferences:
 *   - Missing axes treated as 0 (no redistribution) — penalises gaps.
 *   - YoY exception: when prior-year data is genuinely absent, drop the
 *     YoY weight and renormalise the other two axes.
 */

import { interpolate } from './environmental'

export type GovernanceScoreMode = 'blended' | 'partial' | 'no_data'

export interface GovernanceScoreBreakdown {
  /** 0-100 final blended score, or null when no data at all. */
  score: number | null
  /** Per-axis sub-scores (0-100). May be 0 (gap) or null (axis absent). */
  axes: {
    practices_sub: number | null
    certifications_sub: number | null
    yoy_sub: number | null
  }
  /** Internal 5-axis governance practices for explainer transparency. */
  practices_breakdown: {
    policy: number | null
    stakeholder: number | null
    board: number | null
    ethics: number | null
    transparency: number | null
  } | null
  /** Certifications breakdown for explainer transparency. */
  certifications_breakdown: {
    achieved_pct: number | null
    in_progress_avg_pct: number | null
    achieved_count: number
    in_progress_count: number
    pursued_count: number
  } | null
  /** Mode label for the explainer. */
  mode: GovernanceScoreMode
  /** Weights applied (always 60/30/10 — fixed, with YoY redistribution edge). */
  weights: {
    practices: number
    certifications: number
    yoy: number
  }
  /** Framework citation surfaced in the UI. */
  source: { name: string }
}

const GOVERNANCE_PRACTICES_WEIGHT = 0.6
const GOVERNANCE_CERTIFICATIONS_WEIGHT = 0.3
const GOVERNANCE_YOY_WEIGHT = 0.1

// Cert split — heavily weighted to earned, per Tim's lock-in.
const CERT_ACHIEVED_WEIGHT = 0.8
const CERT_IN_PROGRESS_WEIGHT = 0.2

const GOVERNANCE_SOURCE = {
  name: 'CSRD ESRS G1 · SASB FB-AB Governance · B Corp Governance',
} as const

/**
 * YoY anchors — lenient like Social. Inputs are *positive deltas mean
 * score went up year-on-year* (which is good for governance).
 */
const GOVERNANCE_YOY_ANCHORS: Array<[number, number]> = [
  [-3, 100],
  [-1, 90],
  [0, 80],
  [2, 60],
  [5, 40],
  [10, 20],
  [20, 5],
]

export function governanceYoySubScore(deltaPct: number): number {
  if (!Number.isFinite(deltaPct)) return 0
  // Negate the delta because anchors are written for the "bad direction"
  // (going down). Positive delta on governance score = improvement.
  return Math.round(interpolate(-deltaPct, GOVERNANCE_YOY_ANCHORS))
}

/**
 * Inputs for the certifications sub-score, computed by the route from
 * `organization_certifications` rows.
 */
export interface CertificationsInputs {
  /** Frameworks with status='certified'. */
  achieved_count: number
  /** Frameworks with status IN ('in_progress','ready'). */
  in_progress_count: number
  /** Avg readiness_score across in-progress / ready frameworks (0-100). */
  in_progress_avg_pct: number | null
}

export function computeCertificationsSubScore(
  inputs: CertificationsInputs,
): {
  score: number | null
  breakdown: GovernanceScoreBreakdown['certifications_breakdown']
} {
  const pursued = inputs.achieved_count + inputs.in_progress_count
  if (pursued === 0) {
    return {
      score: null,
      breakdown: {
        achieved_pct: null,
        in_progress_avg_pct: null,
        achieved_count: 0,
        in_progress_count: 0,
        pursued_count: 0,
      },
    }
  }
  const achieved_pct = (inputs.achieved_count / pursued) * 100
  const in_progress_avg_pct =
    inputs.in_progress_avg_pct !== null && Number.isFinite(inputs.in_progress_avg_pct)
      ? inputs.in_progress_avg_pct
      : 0

  const score = Math.round(
    achieved_pct * CERT_ACHIEVED_WEIGHT +
      in_progress_avg_pct * CERT_IN_PROGRESS_WEIGHT,
  )
  return {
    score,
    breakdown: {
      achieved_pct: Math.round(achieved_pct),
      in_progress_avg_pct: Math.round(in_progress_avg_pct),
      achieved_count: inputs.achieved_count,
      in_progress_count: inputs.in_progress_count,
      pursued_count: pursued,
    },
  }
}

export function computeGovernanceScore(args: {
  /** governance_scores.overall_score (the existing 5-axis weighted result). */
  practices_score: number | null
  /** Internal 5-axis breakdown for the explainer. */
  practices_breakdown: GovernanceScoreBreakdown['practices_breakdown']
  /** Certifications inputs from organization_certifications. */
  certifications_inputs: CertificationsInputs | null
  /** % change in governance_score YoY. Positive = improvement. */
  yoy_total_pct: number | null
}): GovernanceScoreBreakdown {
  const certResult = args.certifications_inputs
    ? computeCertificationsSubScore(args.certifications_inputs)
    : null
  const certificationsSub = certResult ? certResult.score : null
  const certificationsBreakdown = certResult ? certResult.breakdown : null

  // Locked: missing axes treated as 0 (no redistribution).
  const practices =
    args.practices_score !== null && Number.isFinite(args.practices_score)
      ? (args.practices_score as number)
      : 0
  const certifications = certificationsSub ?? 0
  const yoy =
    args.yoy_total_pct !== null && Number.isFinite(args.yoy_total_pct)
      ? governanceYoySubScore(args.yoy_total_pct as number)
      : null

  // No-data check: if every signal is genuinely null, return null.
  const allNull =
    args.practices_score === null &&
    args.certifications_inputs === null &&
    args.yoy_total_pct === null
  if (allNull) {
    return {
      score: null,
      axes: {
        practices_sub: null,
        certifications_sub: null,
        yoy_sub: null,
      },
      practices_breakdown: args.practices_breakdown,
      certifications_breakdown: null,
      mode: 'no_data',
      weights: {
        practices: GOVERNANCE_PRACTICES_WEIGHT,
        certifications: GOVERNANCE_CERTIFICATIONS_WEIGHT,
        yoy: GOVERNANCE_YOY_WEIGHT,
      },
      source: GOVERNANCE_SOURCE,
    }
  }

  // YoY exception: if prior-year data doesn't exist, drop YoY weight and
  // renormalise the other two axes.
  let blended: number
  let mode: GovernanceScoreMode = 'blended'
  if (yoy === null) {
    const totalCoreWeight =
      GOVERNANCE_PRACTICES_WEIGHT + GOVERNANCE_CERTIFICATIONS_WEIGHT
    blended =
      (practices * GOVERNANCE_PRACTICES_WEIGHT +
        certifications * GOVERNANCE_CERTIFICATIONS_WEIGHT) /
      totalCoreWeight
    mode =
      args.practices_score === null || args.certifications_inputs === null
        ? 'partial'
        : 'blended'
  } else {
    blended =
      practices * GOVERNANCE_PRACTICES_WEIGHT +
      certifications * GOVERNANCE_CERTIFICATIONS_WEIGHT +
      yoy * GOVERNANCE_YOY_WEIGHT
  }

  return {
    score: Math.round(blended),
    axes: {
      practices_sub: args.practices_score === null ? null : practices,
      certifications_sub: certificationsSub,
      yoy_sub: yoy,
    },
    practices_breakdown: args.practices_breakdown,
    certifications_breakdown: certificationsBreakdown,
    mode,
    weights: {
      practices: GOVERNANCE_PRACTICES_WEIGHT,
      certifications: GOVERNANCE_CERTIFICATIONS_WEIGHT,
      yoy: yoy !== null ? GOVERNANCE_YOY_WEIGHT : 0,
    },
    source: GOVERNANCE_SOURCE,
  }
}
