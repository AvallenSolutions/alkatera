/**
 * ESG vitality composite — types + composition rules.
 *
 * Composes the existing per-domain rollups (community-impact / people-culture /
 * governance / supplier ESG / environmental 4-pillar) into a single
 * Environmental + Social + Governance score, then a weighted ESG composite.
 *
 * The math is intentionally simple — the domain scores are already smart;
 * this layer is *composition*, not novel scoring.
 */

import type {
  ClimateScoreBreakdown,
  WaterScoreBreakdown,
  CircularityScoreBreakdown,
  NatureScoreBreakdown,
} from './environmental'

export type ScoreBand =
  | 'EXCELLENT'
  | 'HEALTHY'
  | 'DEVELOPING'
  | 'EMERGING'
  | 'NEEDS ATTENTION'
  | 'AWAITING DATA'

export interface VitalityWeights {
  e: number
  s: number
  g: number
}

export const DEFAULT_VITALITY_WEIGHTS: VitalityWeights = {
  e: 0.5,
  s: 0.25,
  g: 0.25,
}

export function normaliseWeights(input: Partial<VitalityWeights> | null | undefined): VitalityWeights {
  const e = clamp01(input?.e ?? DEFAULT_VITALITY_WEIGHTS.e)
  const s = clamp01(input?.s ?? DEFAULT_VITALITY_WEIGHTS.s)
  const g = clamp01(input?.g ?? DEFAULT_VITALITY_WEIGHTS.g)
  const total = e + s + g
  if (total === 0) return DEFAULT_VITALITY_WEIGHTS
  return { e: e / total, s: s / total, g: g / total }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  if (n > 1) return 1
  return n
}

export interface EnvironmentalSubScores {
  climate: number | null
  water: number | null
  circularity: number | null
  nature: number | null
}

export interface SocialSubScores {
  community: number | null
  people_culture: number | null
  supplier_esg: number | null
}

export interface GovernanceSubScores {
  governance: number | null
  certifications: number | null
}

export interface PillarScore<T> {
  score: number | null
  has_data: boolean
  sub: T
}

/**
 * Environmental pillar carries extra `*_breakdown` fields exposing the
 * intensity / YoY sub-scores so the explainer popover can show users
 * exactly how each pillar's number was reached. Null when the legacy
 * (non-blended) path was used or when no data is available.
 */
export interface EnvironmentalPillarScore
  extends PillarScore<EnvironmentalSubScores> {
  climate_breakdown: ClimateScoreBreakdown | null
  water_breakdown: WaterScoreBreakdown | null
  circularity_breakdown: CircularityScoreBreakdown | null
  nature_breakdown: NatureScoreBreakdown | null
}

export interface VitalityComposite {
  composite: number | null
  band: ScoreBand
  weights: VitalityWeights
  e: EnvironmentalPillarScore
  s: PillarScore<SocialSubScores>
  g: PillarScore<GovernanceSubScores>
  generated_at: string
}

/**
 * Reuse of the existing water/circ/nature math from
 * components/vitality/VitalityScoreHero.tsx, lifted here so it's reusable
 * server-side without importing a 'use client' file.
 *
 * Climate is now expressed two ways:
 *  - Preferred: the route precomputes a {@link ClimateScoreBreakdown} via
 *    `buildClimateInputs` + `computeClimateScore`, and passes it in as
 *    `climate_breakdown`. The pillar trusts the breakdown verbatim — that
 *    keeps the per-unit/YoY logic in one place and out of this composer.
 *  - Legacy: the perf page (and its tests) still feed
 *    {totalEmissions, emissionsIntensity, industryBenchmark} for the old
 *    per-LCA-count ratio math. This path will be removed once the perf
 *    page migrates to the same breadown route.
 */
export interface EnvironmentalInputs {
  /** Preferred: precomputed climate breakdown from `computeClimateScore`. */
  climate_breakdown?: ClimateScoreBreakdown | null
  /** Preferred: precomputed water breakdown from `computeWaterScore`. */
  water_breakdown?: WaterScoreBreakdown | null
  /** Preferred: precomputed circularity breakdown from `computeCircularityScore`. */
  circularity_breakdown?: CircularityScoreBreakdown | null
  /** Preferred: precomputed nature breakdown from `computeNatureScore`. */
  nature_breakdown?: NatureScoreBreakdown | null
  /** Legacy climate fields, used when no climate_breakdown is provided. */
  totalEmissions?: number
  emissionsIntensity?: number
  industryBenchmark?: number
  /** Legacy water fields, used when no water_breakdown is provided. */
  waterConsumption?: number
  waterRiskLevel?: 'high' | 'medium' | 'low'
  recyclingRate?: number
  wasteToLandfill?: number
  circularityRate?: number
  landUseIntensity?: number
  biodiversityRisk?: 'high' | 'medium' | 'low'
  hasProductData?: boolean
  hasWasteData?: boolean
}

export function computeEnvironmentalPillar(
  data: EnvironmentalInputs,
): EnvironmentalPillarScore {
  // Climate — preferred path: trust the precomputed breakdown when the
  // caller provided one (even `no_data`). Legacy ratio path only fires
  // when no breakdown is supplied at all (perf page until it migrates).
  let climate: number | null = null
  let climate_breakdown: ClimateScoreBreakdown | null = null
  if (data.climate_breakdown !== undefined) {
    climate = data.climate_breakdown?.score ?? null
    climate_breakdown = data.climate_breakdown ?? null
  } else {
    const hasClimateData =
      data.totalEmissions !== undefined &&
      data.totalEmissions > 0 &&
      data.emissionsIntensity !== undefined &&
      data.industryBenchmark !== undefined &&
      data.industryBenchmark > 0
    if (hasClimateData) {
      const ratio = data.emissionsIntensity! / data.industryBenchmark!
      if (ratio <= 0.7) climate = 90
      else if (ratio <= 0.85) climate = 80
      else if (ratio <= 1.0) climate = 70
      else if (ratio <= 1.15) climate = 55
      else if (ratio <= 1.3) climate = 40
      else climate = 25
    }
  }

  // Water — preferred path: trust the precomputed breakdown when the caller
  // provided one (even `no_data`). Legacy waterRiskLevel ladder only fires
  // when no breakdown is supplied at all.
  let water: number | null = null
  let water_breakdown: WaterScoreBreakdown | null = null
  if (data.water_breakdown !== undefined) {
    water = data.water_breakdown?.score ?? null
    water_breakdown = data.water_breakdown ?? null
  } else {
    if (data.waterRiskLevel === 'low') water = 85
    else if (data.waterRiskLevel === 'medium') water = 60
    else if (data.waterRiskLevel === 'high') water = 35
  }

  // Circularity — preferred path: trust the precomputed breakdown when the
  // caller provided one (even `no_data`). Legacy ladder only fires when no
  // breakdown is supplied at all (e.g. unmigrated callers).
  let circularity: number | null = null
  let circularity_breakdown: CircularityScoreBreakdown | null = null
  if (data.circularity_breakdown !== undefined) {
    circularity = data.circularity_breakdown?.score ?? null
    circularity_breakdown = data.circularity_breakdown ?? null
  } else {
    const hasCircularityData =
      data.circularityRate !== undefined &&
      data.circularityRate > 0 &&
      data.hasWasteData !== false
    if (hasCircularityData) {
      if (data.circularityRate! >= 80) circularity = 95
      else if (data.circularityRate! >= 60) circularity = 80
      else if (data.circularityRate! >= 40) circularity = 60
      else if (data.circularityRate! >= 20) circularity = 40
      else circularity = 20
    }
  }

  // Nature — preferred path: trust the precomputed breakdown when the
  // caller provided one (even `no_data`). Legacy biodiversityRisk ladder
  // only fires when no breakdown is supplied at all.
  let nature: number | null = null
  let nature_breakdown: NatureScoreBreakdown | null = null
  if (data.nature_breakdown !== undefined) {
    nature = data.nature_breakdown?.score ?? null
    nature_breakdown = data.nature_breakdown ?? null
  } else {
    if (data.biodiversityRisk === 'low') nature = 80
    else if (data.biodiversityRisk === 'medium') nature = 55
    else if (data.biodiversityRisk === 'high') nature = 30
  }

  const sub: EnvironmentalSubScores = { climate, water, circularity, nature }
  const valid = [
    { v: climate, w: 0.30 },
    { v: water, w: 0.25 },
    { v: circularity, w: 0.25 },
    { v: nature, w: 0.20 },
  ].filter(x => x.v !== null) as Array<{ v: number; w: number }>
  let score: number | null = null
  if (valid.length > 0) {
    const totalW = valid.reduce((a, b) => a + b.w, 0)
    score = Math.round(valid.reduce((a, b) => a + b.v * (b.w / totalW), 0))
  }
  return {
    score,
    has_data: valid.length > 0,
    sub,
    climate_breakdown,
    water_breakdown,
    circularity_breakdown,
    nature_breakdown,
  }
}

export interface SocialInputs {
  /** From /api/community-impact/score (current.overall_score). */
  community_score: number | null
  /** From /api/people-culture/score (current.overall_score). */
  people_culture_score: number | null
  /** Derived: % of suppliers with submitted ESG, on a 0-100 scale. */
  supplier_esg_pct: number | null
}

export function computeSocialPillar(
  data: SocialInputs,
): PillarScore<SocialSubScores> {
  const sub: SocialSubScores = {
    community: data.community_score,
    people_culture: data.people_culture_score,
    supplier_esg: data.supplier_esg_pct,
  }
  const valid = [sub.community, sub.people_culture, sub.supplier_esg].filter(
    (v): v is number => v !== null && Number.isFinite(v),
  )
  if (valid.length === 0) return { score: null, has_data: false, sub }
  const score = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
  return { score, has_data: true, sub }
}

export interface GovernanceInputs {
  /** From /api/governance/score (current.overall_score). */
  governance_score: number | null
  /** Avg progress across active certification frameworks (0-100), or null. */
  cert_progress_pct: number | null
}

export function computeGovernancePillar(
  data: GovernanceInputs,
): PillarScore<GovernanceSubScores> {
  const sub: GovernanceSubScores = {
    governance: data.governance_score,
    certifications: data.cert_progress_pct,
  }
  // Governance overall is the dominant weight; cert is a 15% top-up.
  const g = data.governance_score
  const c = data.cert_progress_pct
  if (g === null && c === null) return { score: null, has_data: false, sub }
  if (g !== null && c !== null) {
    return { score: Math.round(g * 0.85 + c * 0.15), has_data: true, sub }
  }
  if (g !== null) return { score: Math.round(g), has_data: true, sub }
  return { score: Math.round(c!), has_data: true, sub }
}

export interface ComposeArgs {
  e: EnvironmentalPillarScore
  s: PillarScore<SocialSubScores>
  g: PillarScore<GovernanceSubScores>
  weights?: Partial<VitalityWeights> | null
}

export function composeVitality(args: ComposeArgs): VitalityComposite {
  const weights = normaliseWeights(args.weights)
  const valid = [
    { v: args.e.score, w: weights.e },
    { v: args.s.score, w: weights.s },
    { v: args.g.score, w: weights.g },
  ].filter(x => x.v !== null) as Array<{ v: number; w: number }>

  let composite: number | null = null
  if (valid.length > 0) {
    const totalW = valid.reduce((a, b) => a + b.w, 0)
    composite = Math.round(valid.reduce((a, b) => a + b.v * (b.w / totalW), 0))
  }
  return {
    composite,
    band: scoreBand(composite),
    weights,
    e: args.e,
    s: args.s,
    g: args.g,
    generated_at: new Date().toISOString(),
  }
}

export function scoreBand(score: number | null): ScoreBand {
  if (score === null) return 'AWAITING DATA'
  if (score >= 85) return 'EXCELLENT'
  if (score >= 70) return 'HEALTHY'
  if (score >= 50) return 'DEVELOPING'
  if (score >= 30) return 'EMERGING'
  return 'NEEDS ATTENTION'
}

export const BAND_DESCRIPTIONS: Record<ScoreBand, string> = {
  EXCELLENT: 'Sustainability leader across the board.',
  HEALTHY: 'Performing well across most pillars.',
  DEVELOPING: 'Good progress, with clear room to push.',
  EMERGING: 'Early stage. Focused action will move things fast.',
  'NEEDS ATTENTION': 'Significant opportunities to improve.',
  'AWAITING DATA': 'Add data to unlock your score.',
}
