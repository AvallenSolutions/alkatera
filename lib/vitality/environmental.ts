/**
 * Server-side environmental pillar aggregator.
 *
 * Mirrors the math in hooks/data/useCompanyMetrics.ts so the score on
 * /rosa/ matches the score on /performance/. Both surfaces should
 * produce the same band (HEALTHY / DEVELOPING / etc) for the same org.
 *
 * The aggregator is *pure*: feed it PCF rows with their aggregated_impacts
 * blob and you get back the four inputs that computeEnvironmentalPillar
 * consumes. Data fetching lives in the route handler so this stays
 * testable without a database.
 */

import {
  getBenchmarkForCategory,
  getBenchmarkForProductType,
  getWaterBenchmarkForCategory,
  getWaterBenchmarkForProductType,
  type IndustryBenchmark,
  type WaterBenchmark,
} from '@/lib/industry-benchmarks'
import type { EnvironmentalInputs } from './composite'

export interface AggregatedImpacts {
  climate_change_gwp100: number
  water_consumption: number
  water_scarcity_aware: number
  land_use: number
  terrestrial_ecotoxicity: number
  freshwater_eutrophication: number
  terrestrial_acidification: number
  fossil_resource_scarcity: number
}

export interface PcfRowForAggregator {
  id: string
  product_id?: string | null
  product_name?: string | null
  status: string
  aggregated_impacts: AggregatedImpacts | null
  production_volume?: number | null
}

const ZERO_IMPACTS: AggregatedImpacts = {
  climate_change_gwp100: 0,
  water_consumption: 0,
  water_scarcity_aware: 0,
  land_use: 0,
  terrestrial_ecotoxicity: 0,
  freshwater_eutrophication: 0,
  terrestrial_acidification: 0,
  fossil_resource_scarcity: 0,
}

/**
 * Aggregate per-LCA impacts × production volume into a single org-level
 * total. PCFs without a production_volume are treated as 1 unit (so
 * unit-level impacts still contribute) — matches the client-side
 * fallback in useCompanyMetrics.
 */
export function aggregateImpacts(lcas: PcfRowForAggregator[]): AggregatedImpacts {
  const total: AggregatedImpacts = { ...ZERO_IMPACTS }
  for (const lca of lcas) {
    const impacts = lca.aggregated_impacts
    if (!impacts) continue
    const volume =
      lca.production_volume && lca.production_volume > 0 ? lca.production_volume : 1
    total.climate_change_gwp100 += (impacts.climate_change_gwp100 || 0) * volume
    total.water_consumption += (impacts.water_consumption || 0) * volume
    total.water_scarcity_aware += (impacts.water_scarcity_aware || 0) * volume
    total.land_use += (impacts.land_use || 0) * volume
    total.terrestrial_ecotoxicity += (impacts.terrestrial_ecotoxicity || 0) * volume
    total.freshwater_eutrophication += (impacts.freshwater_eutrophication || 0) * volume
    total.terrestrial_acidification += (impacts.terrestrial_acidification || 0) * volume
    total.fossil_resource_scarcity += (impacts.fossil_resource_scarcity || 0) * volume
  }
  return total
}

/**
 * Water risk level derived from the AWARE-weighted scarcity divided by
 * raw consumption (the average scarcity factor across the footprint).
 * Matches useCompanyMetrics.
 */
export function computeWaterRiskLevel(
  totalImpacts: AggregatedImpacts,
): 'high' | 'medium' | 'low' | undefined {
  if (totalImpacts.water_consumption <= 0) return undefined
  const avgScarcity =
    totalImpacts.water_scarcity_aware / totalImpacts.water_consumption
  if (avgScarcity > 40) return 'high'
  if (avgScarcity > 20) return 'medium'
  return 'low'
}

/**
 * Circularity percentage: recyclable EOL waste divided by total EOL
 * waste, weighted by production volume. Falls back to packaging
 * heuristics when EOL data isn't present (matches client logic).
 */
export interface PcfWithEol extends PcfRowForAggregator {
  aggregated_impacts:
    | (AggregatedImpacts & {
        end_of_life_waste_kg?: number
        recyclability_percentage?: number
        breakdown?: {
          by_material?: Array<{ name?: string; quantity?: number }>
        }
      })
    | null
}

export function computeCircularityPercentage(lcas: PcfWithEol[]): number {
  let totalWaste = 0
  let recyclableWaste = 0
  for (const lca of lcas) {
    const volume =
      lca.production_volume && lca.production_volume > 0 ? lca.production_volume : 1
    const eol = lca.aggregated_impacts?.end_of_life_waste_kg ?? 0
    const recyclability = lca.aggregated_impacts?.recyclability_percentage ?? 0
    totalWaste += eol * volume
    recyclableWaste += eol * (recyclability / 100) * volume
  }
  if (totalWaste > 0) {
    return (recyclableWaste / totalWaste) * 100
  }

  // Fallback: estimate from packaging materials.
  let totalPackagingMass = 0
  let recyclablePackaging = 0
  for (const lca of lcas) {
    const materials = lca.aggregated_impacts?.breakdown?.by_material ?? []
    for (const m of materials) {
      const name = String(m?.name ?? '').toLowerCase()
      const qty = Number(m?.quantity ?? 0)
      if (!qty) continue
      if (
        name.includes('bottle') ||
        name.includes('packaging') ||
        name.includes('label')
      ) {
        totalPackagingMass += qty
      }
      if (
        name.includes('glass') ||
        name.includes('cardboard') ||
        name.includes('paper')
      ) {
        recyclablePackaging += qty
      }
    }
  }
  return totalPackagingMass > 0
    ? (recyclablePackaging / totalPackagingMass) * 100
    : 0
}

/**
 * Compose the four inputs `computeEnvironmentalPillar` consumes, given
 * the aggregated raw signals. Pure — no DB calls.
 */
export interface ComposeEnvInputsArgs {
  lcas: PcfWithEol[]
  productType: string | null
  productCategories: Array<string | null>
}

export interface EnvSignals {
  totalEmissions: number
  emissionsIntensity: number | null
  industryBenchmark: number | null
  waterRiskLevel?: 'high' | 'medium' | 'low'
  circularityRate: number
  benchmarkInfo: {
    productType: string | null
    label: string | null
    kgCO2ePerLitre: number | null
  } | null
}

export function buildEnvironmentalSignals(args: ComposeEnvInputsArgs): EnvSignals {
  const lcas = args.lcas.filter(l => l.status === 'completed')
  const totalImpacts = aggregateImpacts(lcas)
  const waterRiskLevel = computeWaterRiskLevel(totalImpacts)
  const circularityRate = computeCircularityPercentage(lcas)

  // Per-product emissions intensity = total / number of assessed products.
  const productCount = lcas.length
  const totalEmissions = totalImpacts.climate_change_gwp100
  const emissionsIntensity =
    productCount > 0 ? totalEmissions / productCount : null

  // Pull the benchmark for the org's product type. The library returns
  // a per-litre value; we use it as a per-product proxy when no better
  // production volume data is available. The band logic still works
  // because the ratio inputs/benchmark is what matters.
  let benchmark: IndustryBenchmark | null = null
  let benchmarkInfo: EnvSignals['benchmarkInfo'] = null
  try {
    const result = getBenchmarkForProductType(args.productType, args.productCategories)
    benchmark = result?.benchmark ?? null
    if (benchmark) {
      benchmarkInfo = {
        productType: args.productType ?? result?.dominantCategory ?? null,
        label: benchmark.label ?? null,
        kgCO2ePerLitre: benchmark.kgCO2ePerLitre ?? null,
      }
    }
  } catch {
    benchmark = null
  }

  return {
    totalEmissions,
    emissionsIntensity,
    industryBenchmark: benchmark?.kgCO2ePerLitre ?? null,
    waterRiskLevel,
    circularityRate,
    benchmarkInfo,
  }
}

/**
 * Blended Climate sub-score.
 *
 * Two ingredients, blended 60/40 when both are available:
 *
 *   1. Intensity vs benchmark — emissions per unit (whole product, packaging
 *      included) compared to a portfolio-weighted industry benchmark. The
 *      benchmark is constructed as the weighted avg of
 *      (kgCO2ePerLitre × unit_size_l) across the org's products, weighted by
 *      units produced. Both numerator and denominator include packaging, so
 *      the comparison is apples-to-apples for any product mix (a brewery
 *      gets a beer-shaped benchmark, a distillery gets a spirits-shaped one,
 *      a hybrid gets a blend).
 *
 *   2. Year-on-year emissions trend — % change in total absolute emissions
 *      vs the prior year. Rewards companies that are reducing in absolute
 *      terms, not just per-unit. A 10% reduction earns full marks because
 *      that beats Paris-aligned trajectories (~7% / yr to 1.5°C).
 *
 * The function returns a structured breakdown rather than a bare number so
 * the UI can show users *exactly* how their score was calculated:
 * intensity sub-score, YoY sub-score, blend mode, weights applied. Every
 * field is exposed so the explainer popover can be fully transparent.
 *
 * Modes:
 *  - 'blended'        both inputs present → 0.6 × intensity + 0.4 × yoy
 *  - 'intensity_only' first-year orgs (no prior year) → intensity at full weight
 *  - 'yoy_only'       no benchmark coverage but trend known → yoy at full weight
 *  - 'no_data'        neither → score is null (AWAITING DATA)
 */
export type ClimateScoreMode =
  | 'blended'
  | 'intensity_only'
  | 'yoy_only'
  | 'no_data'

export interface ClimateScoreBreakdown {
  /** 0-100 final blended score, or null when no inputs are available. */
  score: number | null
  /** 0-100 sub-score from intensity-vs-benchmark, or null if not computable. */
  intensity_sub: number | null
  /** 0-100 sub-score from year-on-year emissions trend, or null if not computable. */
  yoy_sub: number | null
  /** Indicates which inputs drove the score so the UI can explain transparently. */
  mode: ClimateScoreMode
  /** Blend weights applied. Both 0 in 'no_data' mode. */
  weights: { intensity: number; yoy: number }
}

const CLIMATE_INTENSITY_WEIGHT = 0.6
const CLIMATE_YOY_WEIGHT = 0.4

/**
 * Piecewise linear interpolation between (x, y) anchor points. Anchors must
 * be sorted ascending by x. Inputs outside the range clamp to the endpoint.
 *
 * This lets us express scoring curves as a small set of meaningful anchors
 * (e.g. "ratio 1.0 → 70 points") and have every input value in between
 * resolve to a smooth 1% increment, instead of the old tier-jump steps.
 */
export function interpolate(x: number, anchors: Array<[number, number]>): number {
  if (!Number.isFinite(x) || anchors.length === 0) return 0
  if (x <= anchors[0][0]) return anchors[0][1]
  const last = anchors[anchors.length - 1]
  if (x >= last[0]) return last[1]
  for (let i = 0; i < anchors.length - 1; i++) {
    const [x0, y0] = anchors[i]
    const [x1, y1] = anchors[i + 1]
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0)
      return y0 + (y1 - y0) * t
    }
  }
  return last[1]
}

/**
 * Climate intensity sub-score anchors. Smooth 1% increments via linear
 * interpolation. Climate-positive (ratio < 0) earns the top score; ratios
 * far above benchmark plateau at 10 to avoid going off a cliff.
 */
const CLIMATE_INTENSITY_ANCHORS: Array<[number, number]> = [
  [0, 100], // carbon-neutral or net-removing
  [0.5, 95],
  [0.7, 90],
  [0.85, 80],
  [1.0, 70], // at benchmark
  [1.15, 55],
  [1.3, 40],
  [1.5, 25],
  [2.0, 10],
]

/**
 * Climate YoY sub-score anchors. A 10%+ reduction earns 100 (Paris-aligned
 * for many sectors). Increases are penalised symmetrically downward but
 * floor at 5 so a single bad year doesn't fully zero the sub-score.
 */
const CLIMATE_YOY_ANCHORS: Array<[number, number]> = [
  [-10, 100],
  [-5, 85],
  [-2, 75],
  [0, 65],
  [2, 50],
  [5, 35],
  [10, 20],
  [20, 5],
]

/**
 * Score the intensity ratio (per-unit actual / per-unit benchmark, lower is
 * better). Climate-positive (net-negative emissions, possible under FLAG
 * removals exceeding emissions) earns 100. Returns 1% increments via
 * piecewise-linear interpolation between calibrated anchors.
 */
export function climateIntensitySubScore(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0
  if (ratio < 0) return 100 // climate-positive
  return Math.round(interpolate(ratio, CLIMATE_INTENSITY_ANCHORS))
}

/**
 * Score the year-on-year delta in absolute emissions (negative = reduction).
 * A 10% reduction earns 100 because that beats Paris-aligned trajectories.
 * Returns 1% increments via piecewise-linear interpolation.
 */
export function climateYoySubScore(deltaPct: number): number {
  if (!Number.isFinite(deltaPct)) return 0
  return Math.round(interpolate(deltaPct, CLIMATE_YOY_ANCHORS))
}

export function computeClimateScore(args: {
  intensity_ratio: number | null
  yoy_delta_pct: number | null
}): ClimateScoreBreakdown {
  const hasIntensity =
    args.intensity_ratio !== null && Number.isFinite(args.intensity_ratio)
  const hasYoy =
    args.yoy_delta_pct !== null && Number.isFinite(args.yoy_delta_pct)

  if (!hasIntensity && !hasYoy) {
    return {
      score: null,
      intensity_sub: null,
      yoy_sub: null,
      mode: 'no_data',
      weights: { intensity: 0, yoy: 0 },
    }
  }

  const intensitySub = hasIntensity
    ? climateIntensitySubScore(args.intensity_ratio as number)
    : null
  const yoySub = hasYoy
    ? climateYoySubScore(args.yoy_delta_pct as number)
    : null

  if (hasIntensity && hasYoy) {
    const blended =
      (intensitySub as number) * CLIMATE_INTENSITY_WEIGHT +
      (yoySub as number) * CLIMATE_YOY_WEIGHT
    return {
      score: Math.round(blended),
      intensity_sub: intensitySub,
      yoy_sub: yoySub,
      mode: 'blended',
      weights: { intensity: CLIMATE_INTENSITY_WEIGHT, yoy: CLIMATE_YOY_WEIGHT },
    }
  }

  if (hasIntensity) {
    return {
      score: intensitySub,
      intensity_sub: intensitySub,
      yoy_sub: null,
      mode: 'intensity_only',
      weights: { intensity: 1, yoy: 0 },
    }
  }

  return {
    score: yoySub,
    intensity_sub: null,
    yoy_sub: yoySub,
    mode: 'yoy_only',
    weights: { intensity: 0, yoy: 1 },
  }
}

// -----------------------------------------------------------------------------
// Water scoring
// -----------------------------------------------------------------------------

/**
 * Blended Water sub-score.
 *
 * Same blended pattern as climate (60% intensity + 40% YoY), but with:
 *   - More lenient YoY anchors: water reduction is materially harder than
 *     carbon reduction. A 5% YoY reduction earns full marks (climate needs
 *     10%); a 1% reduction is already strongly rewarded.
 *   - Water benchmarks expressed in litres-of-water per litre-of-product
 *     (BIER 2023). The per-unit benchmark is built the same way as carbon:
 *     per-product (kgCO2 → L water) × unit_size_l, weighted by units produced.
 *   - Withdrawal, not consumption, is the metric. The route prefers facility
 *     withdrawal data when available, falling back to LCA water_consumption
 *     as a proxy.
 *
 * Scarcity (AWARE-weighted) is intentionally *not* scored. It's exposed in
 * the breakdown as context so the explainer can credit producers in stressed
 * watersheds for managing water well, without penalising them for location.
 */
export type WaterScoreMode =
  | 'blended'
  | 'intensity_only'
  | 'yoy_only'
  | 'no_data'

export interface WaterScoreBreakdown {
  /** 0-100 final blended score, or null when no inputs are available. */
  score: number | null
  /** 0-100 sub-score from intensity-vs-benchmark, or null if not computable. */
  intensity_sub: number | null
  /** 0-100 sub-score from year-on-year withdrawal trend, or null if not computable. */
  yoy_sub: number | null
  /** Mode that drove the score so the UI can explain transparently. */
  mode: WaterScoreMode
  /** Blend weights applied. Both 0 in 'no_data' mode. */
  weights: { intensity: number; yoy: number }
  /**
   * Average AWARE scarcity factor across the portfolio (m³ world-eq /
   * m³ withdrawn). Shown as *context* in the UI but does not affect score.
   * Null when there's no scarcity data at all.
   */
  avg_scarcity_factor: number | null
  /**
   * Whether the score's withdrawal data came from facility-level tracking
   * (preferred: 'facility') or fell back to LCA water_consumption ('lca').
   * Null when no withdrawal data was used (e.g. yoy-only with no current).
   */
  source: 'facility' | 'lca' | null
}

const WATER_INTENSITY_WEIGHT = 0.6
const WATER_YOY_WEIGHT = 0.4

/**
 * Water intensity sub-score anchors. Same calibration as carbon — at the
 * benchmark earns 70, half the benchmark earns 95. The "lenient" steer
 * applies to YoY only, since intensity bands are already category-relative.
 */
const WATER_INTENSITY_ANCHORS: Array<[number, number]> = [
  [0, 100],
  [0.5, 95],
  [0.7, 90],
  [0.85, 80],
  [1.0, 70],
  [1.15, 55],
  [1.3, 40],
  [1.5, 25],
  [2.0, 10],
]

/**
 * Water YoY sub-score anchors — *more lenient* than carbon. Water reduction
 * in production is structurally harder (CIP cycles, evaporation losses,
 * minimum process flows), so a 5% YoY reduction earns 100, vs carbon's 10%.
 * Increases are also scored a little less harshly so a wet year doesn't
 * collapse the score.
 */
const WATER_YOY_ANCHORS: Array<[number, number]> = [
  [-5, 100],
  [-2, 90],
  [0, 75],
  [2, 60],
  [5, 45],
  [10, 25],
  [20, 10],
]

export function waterIntensitySubScore(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0
  if (ratio < 0) return 100
  return Math.round(interpolate(ratio, WATER_INTENSITY_ANCHORS))
}

export function waterYoySubScore(deltaPct: number): number {
  if (!Number.isFinite(deltaPct)) return 0
  return Math.round(interpolate(deltaPct, WATER_YOY_ANCHORS))
}

export function computeWaterScore(args: {
  intensity_ratio: number | null
  yoy_delta_pct: number | null
  avg_scarcity_factor: number | null
  source: 'facility' | 'lca' | null
}): WaterScoreBreakdown {
  const hasIntensity =
    args.intensity_ratio !== null && Number.isFinite(args.intensity_ratio)
  const hasYoy =
    args.yoy_delta_pct !== null && Number.isFinite(args.yoy_delta_pct)
  const avg_scarcity_factor =
    args.avg_scarcity_factor !== null && Number.isFinite(args.avg_scarcity_factor)
      ? args.avg_scarcity_factor
      : null

  if (!hasIntensity && !hasYoy) {
    return {
      score: null,
      intensity_sub: null,
      yoy_sub: null,
      mode: 'no_data',
      weights: { intensity: 0, yoy: 0 },
      avg_scarcity_factor,
      source: args.source,
    }
  }

  const intensitySub = hasIntensity
    ? waterIntensitySubScore(args.intensity_ratio as number)
    : null
  const yoySub = hasYoy
    ? waterYoySubScore(args.yoy_delta_pct as number)
    : null

  if (hasIntensity && hasYoy) {
    const blended =
      (intensitySub as number) * WATER_INTENSITY_WEIGHT +
      (yoySub as number) * WATER_YOY_WEIGHT
    return {
      score: Math.round(blended),
      intensity_sub: intensitySub,
      yoy_sub: yoySub,
      mode: 'blended',
      weights: { intensity: WATER_INTENSITY_WEIGHT, yoy: WATER_YOY_WEIGHT },
      avg_scarcity_factor,
      source: args.source,
    }
  }

  if (hasIntensity) {
    return {
      score: intensitySub,
      intensity_sub: intensitySub,
      yoy_sub: null,
      mode: 'intensity_only',
      weights: { intensity: 1, yoy: 0 },
      avg_scarcity_factor,
      source: args.source,
    }
  }

  return {
    score: yoySub,
    intensity_sub: null,
    yoy_sub: yoySub,
    mode: 'yoy_only',
    weights: { intensity: 0, yoy: 1 },
    avg_scarcity_factor,
    source: args.source,
  }
}

/**
 * One row of per-product water signal needed to build the water score. The
 * route assembles these from PCFs + production_logs + products + benchmarks
 * before handing them to buildWaterInputs.
 */
export interface WaterProductRow {
  product_id: string
  product_category: string | null
  product_type: string | null
  unit_size_l: number | null
  units_produced_current: number
  units_produced_prior: number
  /**
   * Per-unit water from the LCA (m³ — convert to litres ×1000 internally).
   * Used as a fallback when org-level facility intake data isn't logged.
   * From `aggregated_impacts.water_consumption`.
   */
  per_unit_water_m3: number | null
  /**
   * Per-unit AWARE-weighted scarcity (m³ world-eq) from the LCA. Used to
   * compute the scarcity *context* for the breakdown UI (not for scoring).
   * From `aggregated_impacts.water_scarcity_aware`.
   */
  per_unit_scarcity_m3: number | null
}

export interface WaterInputsResult {
  /** Per-unit actual / per-unit benchmark (lower is better). Null if not computable. */
  intensity_ratio: number | null
  /** YoY % change in absolute withdrawal. Null if no prior-year data. */
  yoy_delta_pct: number | null
  /** Average AWARE factor across the source data. Context only — not scored. */
  avg_scarcity_factor: number | null
  /** Indicates which source backed the score: facility (preferred) or LCA fallback. */
  source: 'facility' | 'lca' | null
  /** Diagnostic breakdown for the explainer popover. */
  diagnostics: {
    current_year_intake_l: number | null
    prior_year_intake_l: number | null
    current_year_units: number
    prior_year_units: number
    per_unit_actual_l: number | null
    per_unit_benchmark_l: number | null
    products_in_benchmark: number
    products_in_actual: number
  }
}

/**
 * Build the two inputs for `computeWaterScore` from per-product LCA rows
 * plus optional facility-level annual intake totals.
 *
 * Source preference (simple-and-robust deduplication):
 *  - If `facility_intake_current_l > 0`, use facility data as the source of
 *    truth for the *actual* per-unit intake. LCA water is ignored to avoid
 *    double-counting (facility totals already include both operational and
 *    embedded water as tracked by the org).
 *  - Otherwise, fall back to LCA per-unit water (× units) summed across
 *    products with both a per-unit figure and current-year units.
 *
 * The benchmark side uses per-product BIER ratios × unit_size_l, weighted by
 * current-year units — same shape as the carbon path. A product missing
 * either a benchmark or a unit_size is excluded from the benchmark side
 * but still contributes to actual intake when LCA-fallback is in play.
 */
export function buildWaterInputs(args: {
  products: WaterProductRow[]
  /** Total facility water *intake* (withdrawal) in litres, current year. */
  facility_intake_current_l: number | null
  /** Total facility water *intake* in litres, prior year. */
  facility_intake_prior_l: number | null
  /**
   * Total facility AWARE-weighted withdrawal (litres world-eq). Used to
   * compute the scarcity context. Optional.
   */
  facility_scarcity_current_l: number | null
}): WaterInputsResult {
  const diagnostics: WaterInputsResult['diagnostics'] = {
    current_year_intake_l: null,
    prior_year_intake_l: null,
    current_year_units: 0,
    prior_year_units: 0,
    per_unit_actual_l: null,
    per_unit_benchmark_l: null,
    products_in_benchmark: 0,
    products_in_actual: 0,
  }

  let currentUnits = 0
  let priorUnits = 0
  let benchmarkNumerator = 0 // Σ (litresPerLitre × unit_size_l × units_current)
  let benchmarkDenominator = 0 // Σ units_current for products with a benchmark contribution
  let benchmarkProducts = 0
  let lcaActualCurrent_l = 0 // Σ (per_unit_water_l × units_current)
  let lcaActualPrior_l = 0 // Σ (per_unit_water_l × units_prior)
  let lcaActualProducts = 0
  let lcaScarcityNumerator = 0 // Σ (per_unit_scarcity_m3 × units_current)
  let lcaConsumption_m3 = 0 // Σ (per_unit_water_m3 × units_current) for scarcity-factor denominator

  for (const r of args.products) {
    const cur = Number.isFinite(r.units_produced_current) ? r.units_produced_current : 0
    const pri = Number.isFinite(r.units_produced_prior) ? r.units_produced_prior : 0
    currentUnits += cur
    priorUnits += pri

    // Benchmark contribution: needs both a per-product water benchmark and a unit size.
    const benchmark = pickWaterBenchmark(r.product_category, r.product_type)
    if (benchmark && r.unit_size_l && r.unit_size_l > 0 && cur > 0) {
      benchmarkNumerator += benchmark.litresPerLitre * r.unit_size_l * cur
      benchmarkDenominator += cur
      benchmarkProducts += 1
    }

    // LCA-side actual (used when facility data is absent, and for scarcity context).
    const perUnitL =
      r.per_unit_water_m3 !== null && Number.isFinite(r.per_unit_water_m3)
        ? (r.per_unit_water_m3 as number) * 1000
        : null
    if (perUnitL !== null && cur > 0) {
      lcaActualCurrent_l += perUnitL * cur
      lcaActualProducts += 1
    }
    if (perUnitL !== null && pri > 0) {
      lcaActualPrior_l += perUnitL * pri
    }
    const perUnitScarcity_m3 = r.per_unit_scarcity_m3
    if (
      perUnitScarcity_m3 !== null &&
      Number.isFinite(perUnitScarcity_m3) &&
      r.per_unit_water_m3 !== null &&
      cur > 0
    ) {
      lcaScarcityNumerator += (perUnitScarcity_m3 as number) * cur
      lcaConsumption_m3 += (r.per_unit_water_m3 as number) * cur
    }
  }

  diagnostics.current_year_units = currentUnits
  diagnostics.prior_year_units = priorUnits
  diagnostics.products_in_benchmark = benchmarkProducts
  diagnostics.products_in_actual = lcaActualProducts

  // ----- Source selection -----
  const useFacility =
    args.facility_intake_current_l !== null &&
    args.facility_intake_current_l > 0
  const source: 'facility' | 'lca' | null = useFacility
    ? 'facility'
    : lcaActualProducts > 0
      ? 'lca'
      : null

  // ----- Per-unit actual + intensity ratio -----
  let intensity_ratio: number | null = null
  if (source === 'facility' && currentUnits > 0 && benchmarkDenominator > 0) {
    const perUnitActual = (args.facility_intake_current_l as number) / currentUnits
    const perUnitBenchmark = benchmarkNumerator / benchmarkDenominator
    diagnostics.current_year_intake_l = args.facility_intake_current_l
    diagnostics.per_unit_actual_l = perUnitActual
    diagnostics.per_unit_benchmark_l = perUnitBenchmark
    if (perUnitBenchmark > 0) intensity_ratio = perUnitActual / perUnitBenchmark
  } else if (source === 'lca' && currentUnits > 0 && benchmarkDenominator > 0) {
    const perUnitActual = lcaActualCurrent_l / currentUnits
    const perUnitBenchmark = benchmarkNumerator / benchmarkDenominator
    diagnostics.current_year_intake_l = lcaActualCurrent_l
    diagnostics.per_unit_actual_l = perUnitActual
    diagnostics.per_unit_benchmark_l = perUnitBenchmark
    if (perUnitBenchmark > 0) intensity_ratio = perUnitActual / perUnitBenchmark
  } else if (source === 'facility' && currentUnits > 0) {
    diagnostics.current_year_intake_l = args.facility_intake_current_l
    diagnostics.per_unit_actual_l =
      (args.facility_intake_current_l as number) / currentUnits
  } else if (source === 'lca' && currentUnits > 0) {
    diagnostics.current_year_intake_l = lcaActualCurrent_l
    diagnostics.per_unit_actual_l = lcaActualCurrent_l / currentUnits
  }

  // ----- YoY -----
  let yoy_delta_pct: number | null = null
  if (source === 'facility') {
    const prior = args.facility_intake_prior_l
    if (prior !== null && Number.isFinite(prior) && prior > 0) {
      diagnostics.prior_year_intake_l = prior
      yoy_delta_pct =
        (((args.facility_intake_current_l as number) - prior) / prior) * 100
    }
  } else if (source === 'lca' && lcaActualPrior_l > 0) {
    diagnostics.prior_year_intake_l = lcaActualPrior_l
    yoy_delta_pct =
      ((lcaActualCurrent_l - lcaActualPrior_l) / lcaActualPrior_l) * 100
  }

  // ----- Avg scarcity factor (context only) -----
  let avg_scarcity_factor: number | null = null
  if (
    source === 'facility' &&
    args.facility_scarcity_current_l !== null &&
    args.facility_intake_current_l !== null &&
    args.facility_intake_current_l > 0
  ) {
    avg_scarcity_factor =
      args.facility_scarcity_current_l / args.facility_intake_current_l
  } else if (lcaConsumption_m3 > 0) {
    avg_scarcity_factor = lcaScarcityNumerator / lcaConsumption_m3
  }

  return { intensity_ratio, yoy_delta_pct, avg_scarcity_factor, source, diagnostics }
}

/** Resolve a per-product water benchmark, preferring category over group. */
function pickWaterBenchmark(
  category: string | null,
  productType: string | null,
): WaterBenchmark | null {
  if (category) {
    const b = getWaterBenchmarkForCategory(category)
    if (b) return b
  }
  if (productType) {
    const result = getWaterBenchmarkForProductType(productType, [])
    if (result?.benchmark) return result.benchmark
  }
  return null
}

/**
 * Convert a unit_size measurement (e.g. {value: 700, unit: 'ml'}) to litres.
 * Mirrors the SQL `bulk_volume_to_units` helper. Returns null for unparsable
 * inputs.
 */
export function unitSizeToLitres(
  value: number | null | undefined,
  unit: string | null | undefined,
): number | null {
  const v = Number(value)
  if (!Number.isFinite(v) || v <= 0) return null
  const u = String(unit ?? '').toLowerCase().trim()
  if (u === 'ml') return v / 1000
  if (u === 'l' || u === 'litre' || u === 'litres' || u === 'liter' || u === 'liters') return v
  if (u === 'cl') return v / 100
  // Default: assume litres so we don't silently drop the data.
  return v
}

/**
 * One row of per-product climate signal needed to compute the blended
 * climate score. The route assembles these from PCFs + production_logs +
 * products + benchmarks before handing them to buildClimateInputs.
 */
export interface ClimateProductRow {
  /** Product id (string keys; the route normalises). */
  product_id: string
  /** Product category (e.g. 'Whisky', 'Lager') so we can pick a benchmark. */
  product_category: string | null
  /** Product type group (fallback when category is missing). */
  product_type: string | null
  /** Per-unit size in litres (e.g. 0.7 for a 700ml bottle). */
  unit_size_l: number | null
  /** Units produced in the *current* year. */
  units_produced_current: number
  /** Units produced in the *prior* year. */
  units_produced_prior: number
  /** Per-unit cradle-to-grave emissions in kgCO2e (climate_change_gwp100). */
  per_unit_emissions_kgco2e: number | null
}

export interface ClimateInputsResult {
  /** Per-unit actual emissions / per-unit weighted benchmark. Null if no current-year data. */
  intensity_ratio: number | null
  /** YoY % change in absolute emissions (negative = reduction). Null if no prior-year data. */
  yoy_delta_pct: number | null
  /** Diagnostic breakdown for the explainer popover. Keep these alongside the inputs so the UI can show the math. */
  diagnostics: {
    current_year_emissions_kgco2e: number | null
    prior_year_emissions_kgco2e: number | null
    current_year_units: number
    prior_year_units: number
    per_unit_actual_kgco2e: number | null
    per_unit_benchmark_kgco2e: number | null
    products_in_benchmark: number
    products_in_actual: number
  }
}

/**
 * Build the two inputs for `computeClimateScore` from a set of per-product
 * climate signal rows.
 *
 * Per-unit benchmark: weighted avg of (kgCO2ePerLitre × unit_size_l) across
 * products that have BOTH a benchmark and a unit_size, weighted by current-
 * year units produced. A product without a unit_size is skipped here (it
 * can't be size-scaled), but it still counts toward emissions totals if it
 * has units + a per-unit emissions figure from its PCF.
 *
 * Per-unit actual: sum(units × per-unit emissions) / sum(units), across
 * products with both a per-unit emissions figure and units produced in the
 * current year.
 *
 * YoY delta: total_current_year / total_prior_year - 1, expressed as %.
 * Computed from the same per-unit emissions figure × units produced in
 * each year (so we're holding product-level intensity constant and only
 * tracking the change in volume × mix).
 */
export function buildClimateInputs(
  rows: ClimateProductRow[],
): ClimateInputsResult {
  const diagnostics: ClimateInputsResult['diagnostics'] = {
    current_year_emissions_kgco2e: null,
    prior_year_emissions_kgco2e: null,
    current_year_units: 0,
    prior_year_units: 0,
    per_unit_actual_kgco2e: null,
    per_unit_benchmark_kgco2e: null,
    products_in_benchmark: 0,
    products_in_actual: 0,
  }

  let currentEmissions = 0
  let priorEmissions = 0
  let currentUnits = 0
  let priorUnits = 0
  let benchmarkNumerator = 0 // Σ (kgCO2ePerLitre × unit_size_l × units_current)
  let benchmarkDenominator = 0 // Σ (units_current) for products with a benchmark contribution

  let actualProducts = 0
  let benchmarkProducts = 0
  let hasAnyCurrent = false
  let hasAnyPrior = false

  for (const r of rows) {
    const cur = Number.isFinite(r.units_produced_current) ? r.units_produced_current : 0
    const pri = Number.isFinite(r.units_produced_prior) ? r.units_produced_prior : 0
    const perUnit = r.per_unit_emissions_kgco2e
    const hasPerUnit = perUnit !== null && perUnit !== undefined && Number.isFinite(perUnit)

    currentUnits += cur
    priorUnits += pri
    if (cur > 0) hasAnyCurrent = true
    if (pri > 0) hasAnyPrior = true

    if (hasPerUnit && cur > 0) {
      currentEmissions += (perUnit as number) * cur
      actualProducts += 1
    }
    if (hasPerUnit && pri > 0) {
      priorEmissions += (perUnit as number) * pri
    }

    // Benchmark contribution: needs both a per-product benchmark and a unit size.
    const benchmark = pickBenchmark(r.product_category, r.product_type)
    if (benchmark && r.unit_size_l && r.unit_size_l > 0 && cur > 0) {
      benchmarkNumerator += benchmark.kgCO2ePerLitre * r.unit_size_l * cur
      benchmarkDenominator += cur
      benchmarkProducts += 1
    }
  }

  diagnostics.current_year_units = currentUnits
  diagnostics.prior_year_units = priorUnits
  diagnostics.products_in_actual = actualProducts
  diagnostics.products_in_benchmark = benchmarkProducts

  // Intensity ratio
  let intensity_ratio: number | null = null
  if (actualProducts > 0 && currentUnits > 0 && benchmarkDenominator > 0) {
    const perUnitActual = currentEmissions / currentUnits
    const perUnitBenchmark = benchmarkNumerator / benchmarkDenominator
    diagnostics.current_year_emissions_kgco2e = currentEmissions
    diagnostics.per_unit_actual_kgco2e = perUnitActual
    diagnostics.per_unit_benchmark_kgco2e = perUnitBenchmark
    if (perUnitBenchmark > 0) {
      intensity_ratio = perUnitActual / perUnitBenchmark
    }
  } else if (hasAnyCurrent && actualProducts > 0) {
    // We have units + emissions, but no benchmark coverage — keep diagnostics for the UI.
    diagnostics.current_year_emissions_kgco2e = currentEmissions
    diagnostics.per_unit_actual_kgco2e =
      currentUnits > 0 ? currentEmissions / currentUnits : null
  }

  // YoY delta
  let yoy_delta_pct: number | null = null
  if (hasAnyPrior && priorEmissions > 0) {
    diagnostics.prior_year_emissions_kgco2e = priorEmissions
    if (diagnostics.current_year_emissions_kgco2e === null && actualProducts > 0) {
      diagnostics.current_year_emissions_kgco2e = currentEmissions
    }
    yoy_delta_pct = ((currentEmissions - priorEmissions) / priorEmissions) * 100
  }

  return { intensity_ratio, yoy_delta_pct, diagnostics }
}

/** Resolve a per-product benchmark, preferring category over group. */
function pickBenchmark(
  category: string | null,
  productType: string | null,
): IndustryBenchmark | null {
  if (category) {
    const b = getBenchmarkForCategory(category)
    if (b) return b
  }
  if (productType) {
    const result = getBenchmarkForProductType(productType, [])
    if (result?.benchmark) return result.benchmark
  }
  return null
}

/**
 * Convert EnvSignals → EnvironmentalInputs for computeEnvironmentalPillar.
 * Drops fields we don't have (biodiversityRisk requires explicit input).
 */
export function toEnvironmentalInputs(signals: EnvSignals): EnvironmentalInputs {
  const out: EnvironmentalInputs = {}
  if (signals.totalEmissions > 0) {
    out.totalEmissions = signals.totalEmissions
  }
  if (signals.emissionsIntensity !== null && signals.industryBenchmark !== null) {
    out.emissionsIntensity = signals.emissionsIntensity
    out.industryBenchmark = signals.industryBenchmark
  }
  if (signals.waterRiskLevel) out.waterRiskLevel = signals.waterRiskLevel
  if (signals.circularityRate > 0) {
    out.circularityRate = signals.circularityRate
    out.hasWasteData = true
  }
  return out
}
