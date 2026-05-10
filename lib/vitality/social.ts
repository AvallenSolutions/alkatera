/**
 * Social pillar scoring — redesigned to mirror the environmental pattern.
 *
 * Blended axes (locked weights):
 *   Workforce      50%  — people_culture_scores.overall_score
 *   Community      25%  — community_impact_scores.overall_score
 *   Supplier       15%  — composite of mapping coverage + cert coverage
 *                          + producer due-diligence attestations (zero
 *                          dependency on suppliers using the platform)
 *   YoY            10%  — change in the blended workforce/community/supplier
 *                          score year-on-year
 *
 * Materiality basis: ESRS S1 (own workforce) is the dominant social topic
 * for drinks producers per CSRD; community + supplier come next; YoY
 * trend is light because social numbers shift slowly.
 *
 * Locked product preferences:
 *   - Missing axes treated as 0 (no redistribution) — penalises data gaps
 *     so producers who do everything score full.
 *   - Supplier sub-score works without supplier participation: producer-
 *     declared certifications + due-diligence attestations + mapping
 *     coverage. Optional supplier-ESG-form quality bonus arrives in v2.
 */

export type SocialScoreMode = 'blended' | 'partial' | 'no_data'

export interface SocialScoreBreakdown {
  /** 0-100 final blended score, or null when no data at all. */
  score: number | null
  /** Sub-score per axis. May be 0 (data gap) or null (axis absent). */
  axes: {
    workforce_sub: number | null
    community_sub: number | null
    supplier_sub: number | null
    yoy_sub: number | null
  }
  /** Supplier sub-axis breakdown for explainer transparency. */
  supplier_breakdown: {
    mapping_coverage_pct: number | null
    certifications_coverage_pct: number | null
    attestations_pct: number | null
    suppliers_with_esg_form: number
    suppliers_total: number
  } | null
  /** Mode label for the explainer. */
  mode: SocialScoreMode
  /** Weights as exposed (always 50/25/15/10 — fixed, no redistribution). */
  weights: {
    workforce: number
    community: number
    supplier: number
    yoy: number
  }
  /** Framework citation surfaced in the UI. */
  source: { name: string }
}

const SOCIAL_WORKFORCE_WEIGHT = 0.5
const SOCIAL_COMMUNITY_WEIGHT = 0.25
const SOCIAL_SUPPLIER_WEIGHT = 0.15
const SOCIAL_YOY_WEIGHT = 0.1

const SOCIAL_SOURCE = {
  name: 'CSRD ESRS S1-S2 · SASB FB-AB · B Corp Workers/Community',
} as const

// Sub-axis weights inside the supplier sub-score.
const SUPPLIER_MAPPING_WEIGHT = 0.4
const SUPPLIER_CERTIFICATIONS_WEIGHT = 0.3
const SUPPLIER_ATTESTATIONS_WEIGHT = 0.3

import { interpolate } from './environmental'

/**
 * YoY anchors for social: lenient like nature/water — workforce, community,
 * and supplier-relationship metrics shift slowly. A 3% improvement is a
 * meaningful year, not a baseline expectation.
 */
const SOCIAL_YOY_ANCHORS: Array<[number, number]> = [
  [-3, 100],
  [-1, 90],
  [0, 80],
  [2, 60],
  [5, 40],
  [10, 20],
  [20, 5],
]

export function socialYoySubScore(deltaPct: number): number {
  if (!Number.isFinite(deltaPct)) return 0
  // Note: for SOCIAL, "improvement" means score goes UP year-on-year (vs
  // emissions where improvement = score-going-DOWN). So we invert the
  // delta: a +5% improvement in the social score is good. Anchors above
  // are written for the "bad direction" (impacts going UP); for social
  // we negate before interpolating.
  return Math.round(interpolate(-deltaPct, SOCIAL_YOY_ANCHORS))
}

/**
 * Inputs for the supplier sub-score, computed by the route from existing
 * data without requiring suppliers to log in.
 *
 * - mapping_coverage_pct: % of materials/products with a named supplier.
 *   Producer-controlled via supplier mapping in their LCA work.
 * - certifications_coverage_pct: % of supplier-products with at least one
 *   declared certification (B Corp, Fair Trade, organic, etc.).
 * - attestations_pct: % of producer due-diligence attestations declared
 *   (out of 6 total).
 */
export interface SupplierResponsibilityInputs {
  mapping_coverage_pct: number | null
  certifications_coverage_pct: number | null
  attestations_pct: number | null
  suppliers_with_esg_form: number
  suppliers_total: number
}

export function computeSupplierSubScore(
  inputs: SupplierResponsibilityInputs,
): { score: number; breakdown: SocialScoreBreakdown['supplier_breakdown'] } {
  // Missing axes treated as 0 (locked preference: penalise data gaps).
  const mapping = inputs.mapping_coverage_pct ?? 0
  const certs = inputs.certifications_coverage_pct ?? 0
  const attest = inputs.attestations_pct ?? 0

  const score = Math.round(
    mapping * SUPPLIER_MAPPING_WEIGHT +
      certs * SUPPLIER_CERTIFICATIONS_WEIGHT +
      attest * SUPPLIER_ATTESTATIONS_WEIGHT,
  )

  return {
    score,
    breakdown: {
      mapping_coverage_pct: inputs.mapping_coverage_pct,
      certifications_coverage_pct: inputs.certifications_coverage_pct,
      attestations_pct: inputs.attestations_pct,
      suppliers_with_esg_form: inputs.suppliers_with_esg_form,
      suppliers_total: inputs.suppliers_total,
    },
  }
}

export function computeSocialScore(args: {
  workforce_score: number | null
  community_score: number | null
  supplier_inputs: SupplierResponsibilityInputs | null
  yoy_total_pct: number | null
}): SocialScoreBreakdown {
  // Compute supplier first since it's a composite.
  const supplierResult = args.supplier_inputs
    ? computeSupplierSubScore(args.supplier_inputs)
    : null
  const supplierSub = supplierResult ? supplierResult.score : null
  const supplierBreakdown = supplierResult ? supplierResult.breakdown : null

  // Locked: missing axes treated as 0 (no redistribution).
  const workforce =
    args.workforce_score !== null && Number.isFinite(args.workforce_score)
      ? (args.workforce_score as number)
      : 0
  const community =
    args.community_score !== null && Number.isFinite(args.community_score)
      ? (args.community_score as number)
      : 0
  const supplier = supplierSub ?? 0
  const yoy =
    args.yoy_total_pct !== null && Number.isFinite(args.yoy_total_pct)
      ? socialYoySubScore(args.yoy_total_pct as number)
      : null

  // No-data check: if every signal we measure is genuinely null (not
  // zero), we'd rather return null than score 0. Distinguishes
  // "didn't disclose anything" from "disclosed but performance is poor".
  const allNull =
    args.workforce_score === null &&
    args.community_score === null &&
    args.supplier_inputs === null &&
    args.yoy_total_pct === null
  if (allNull) {
    return {
      score: null,
      axes: {
        workforce_sub: null,
        community_sub: null,
        supplier_sub: null,
        yoy_sub: null,
      },
      supplier_breakdown: null,
      mode: 'no_data',
      weights: {
        workforce: SOCIAL_WORKFORCE_WEIGHT,
        community: SOCIAL_COMMUNITY_WEIGHT,
        supplier: SOCIAL_SUPPLIER_WEIGHT,
        yoy: SOCIAL_YOY_WEIGHT,
      },
      source: SOCIAL_SOURCE,
    }
  }

  // YoY may be missing legitimately (first year). Drop its weight in that
  // case — *only* exception to the no-redistribution rule, since YoY data
  // simply doesn't exist for new orgs.
  let blended: number
  let mode: SocialScoreMode = 'blended'
  if (yoy === null) {
    const totalCoreWeight =
      SOCIAL_WORKFORCE_WEIGHT + SOCIAL_COMMUNITY_WEIGHT + SOCIAL_SUPPLIER_WEIGHT
    blended =
      (workforce * SOCIAL_WORKFORCE_WEIGHT +
        community * SOCIAL_COMMUNITY_WEIGHT +
        supplier * SOCIAL_SUPPLIER_WEIGHT) /
      totalCoreWeight
    mode = args.workforce_score === null || args.community_score === null || args.supplier_inputs === null
      ? 'partial'
      : 'blended'
  } else {
    blended =
      workforce * SOCIAL_WORKFORCE_WEIGHT +
      community * SOCIAL_COMMUNITY_WEIGHT +
      supplier * SOCIAL_SUPPLIER_WEIGHT +
      yoy * SOCIAL_YOY_WEIGHT
    mode = 'blended'
  }

  return {
    score: Math.round(blended),
    axes: {
      workforce_sub: args.workforce_score === null ? null : workforce,
      community_sub: args.community_score === null ? null : community,
      supplier_sub: supplierSub,
      yoy_sub: yoy,
    },
    supplier_breakdown: supplierBreakdown,
    mode,
    weights: {
      workforce: SOCIAL_WORKFORCE_WEIGHT,
      community: SOCIAL_COMMUNITY_WEIGHT,
      supplier: SOCIAL_SUPPLIER_WEIGHT,
      yoy: yoy !== null ? SOCIAL_YOY_WEIGHT : 0,
    },
    source: SOCIAL_SOURCE,
  }
}
