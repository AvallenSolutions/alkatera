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

// -----------------------------------------------------------------------------
// Circularity scoring
// -----------------------------------------------------------------------------

/**
 * Blended Circularity sub-score.
 *
 * Circularity is intrinsically a *quality* metric — a brewery can't be
 * "less circular" by generating more spent grain if all of it goes to
 * animal feed. So we blend two axes:
 *
 *  - Circular practices (60%) — equal-weighted blend of three signals,
 *    each a 0-100 ratio: recycled content of inputs, packaging
 *    recyclability of outputs, and tier-weighted operational diversion.
 *
 *  - Waste-intensity YoY (40%) — % change in waste-per-unit-produced.
 *    Volume reduction at portfolio scale is hard, so anchors are lenient.
 *
 * Tier-weighted diversion is the key insight: not all "diverted" tonnes
 * are equal. Following the EU Waste Framework Directive 2008/98/EC
 * waste hierarchy (reduce > reuse > recycle > energy recovery > dispose),
 * we weight each treatment route by quality before computing the
 * diversion sub-score. A brewery sending spent grain to animal-feed reuse
 * earns more than one sending it to waste-to-energy.
 */
export type CircularityScoreMode =
  | 'blended'
  | 'practices_only'
  | 'yoy_only'
  | 'no_data'

export interface CircularityScoreBreakdown {
  /** 0-100 final blended score, or null when no inputs are available. */
  score: number | null
  /** Sub-scores by axis. Each may be null when its data isn't available. */
  axes: {
    recycled_content_sub: number | null
    packaging_recyclability_sub: number | null
    diversion_sub: number | null
  }
  /** 0-100 sub-score from the practices side (avg of available axes). */
  practices_sub: number | null
  /** 0-100 sub-score from year-on-year waste-intensity trend. */
  intensity_yoy_sub: number | null
  /** Mode that drove the score so the UI can explain transparently. */
  mode: CircularityScoreMode
  /** Blend weights applied. */
  weights: { practices: number; yoy: number }
  /**
   * Treatment mix used for tier-weighted diversion. Each value is the
   * proportion of *total* waste routed via that method (0-1). Useful for
   * the explainer popover so users can see the breakdown.
   */
  treatment_mix: {
    reuse: number
    composting: number
    anaerobic_digestion: number
    recycling: number
    incineration_with_recovery: number
    landfill: number
    incineration_without_recovery: number
    other: number
  }
}

const CIRCULARITY_PRACTICES_WEIGHT = 0.6
const CIRCULARITY_YOY_WEIGHT = 0.4

/**
 * Tier weights from the EU Waste Framework Directive hierarchy. Reuse is
 * the highest-quality route; landfill the lowest. Multiplied by the
 * proportion of waste taking each route, then summed and × 100 to get a
 * 0-100 quality-adjusted diversion score.
 */
const TREATMENT_TIER_WEIGHTS = {
  reuse: 1.0,
  composting: 0.85,
  anaerobic_digestion: 0.85,
  recycling: 0.7,
  incineration_with_recovery: 0.4,
  landfill: 0,
  incineration_without_recovery: 0,
  other: 0.2, // Unknown destination — give a token credit since it's not landfill
} as const

/**
 * Anchors for each of the three practice axes (input ratio %).
 * 100% earns 100 (cleanly), 0% earns 5 (so missing-but-known still gets a
 * floor). Same shape for all three axes — keeps the explainer copy uniform.
 */
const CIRCULARITY_AXIS_ANCHORS: Array<[number, number]> = [
  [0, 5],
  [20, 25],
  [40, 50],
  [60, 75],
  [80, 90],
  [95, 98],
  [100, 100],
]

/**
 * Anchors for waste-intensity YoY (% change in kg waste per unit produced).
 * Lenient — a 3% reduction earns 100 because absolute waste reduction at
 * production scale is structurally hard. Increases are penalised but not
 * cliff-edged so a single growth year doesn't tank the sub-score.
 */
const CIRCULARITY_YOY_ANCHORS: Array<[number, number]> = [
  [-3, 100],
  [-1, 90],
  [0, 80],
  [2, 60],
  [5, 40],
  [10, 20],
  [20, 5],
]

export function circularityAxisSubScore(pct: number): number {
  if (!Number.isFinite(pct)) return 0
  return Math.round(interpolate(pct, CIRCULARITY_AXIS_ANCHORS))
}

export function circularityIntensityYoySubScore(deltaPct: number): number {
  if (!Number.isFinite(deltaPct)) return 0
  return Math.round(interpolate(deltaPct, CIRCULARITY_YOY_ANCHORS))
}

/**
 * Compute the tier-weighted diversion percentage from a treatment mix.
 * Each treatment route's proportion is multiplied by its quality weight
 * (per the EU waste hierarchy) then summed × 100 to give a 0-100 score.
 *
 * Example: a brewery sending 80% to reuse + 20% to landfill scores
 *   80×1.0 + 20×0 = 80
 * vs. one sending 80% to incineration-with-recovery + 20% to landfill:
 *   80×0.4 + 20×0 = 32
 * Same diversion rate, very different circular quality.
 */
export function tierWeightedDiversionPct(
  mix: CircularityScoreBreakdown['treatment_mix'],
): number {
  let weighted = 0
  for (const key of Object.keys(TREATMENT_TIER_WEIGHTS) as Array<
    keyof typeof TREATMENT_TIER_WEIGHTS
  >) {
    const proportion = mix[key] ?? 0
    weighted += proportion * TREATMENT_TIER_WEIGHTS[key]
  }
  return weighted * 100
}

export function computeCircularityScore(args: {
  recycled_content_pct: number | null
  packaging_recyclability_pct: number | null
  tier_weighted_diversion_pct: number | null
  intensity_yoy_pct: number | null
  treatment_mix: CircularityScoreBreakdown['treatment_mix']
}): CircularityScoreBreakdown {
  const recycledSub =
    args.recycled_content_pct !== null && Number.isFinite(args.recycled_content_pct)
      ? circularityAxisSubScore(args.recycled_content_pct)
      : null
  const packagingSub =
    args.packaging_recyclability_pct !== null &&
    Number.isFinite(args.packaging_recyclability_pct)
      ? circularityAxisSubScore(args.packaging_recyclability_pct)
      : null
  const diversionSub =
    args.tier_weighted_diversion_pct !== null &&
    Number.isFinite(args.tier_weighted_diversion_pct)
      ? circularityAxisSubScore(args.tier_weighted_diversion_pct)
      : null
  const yoySub =
    args.intensity_yoy_pct !== null && Number.isFinite(args.intensity_yoy_pct)
      ? circularityIntensityYoySubScore(args.intensity_yoy_pct)
      : null

  // Practices = average of available axes. Redistribute when some are missing.
  const axes: Array<number> = []
  if (recycledSub !== null) axes.push(recycledSub)
  if (packagingSub !== null) axes.push(packagingSub)
  if (diversionSub !== null) axes.push(diversionSub)
  const practicesSub =
    axes.length > 0
      ? Math.round(axes.reduce((a, b) => a + b, 0) / axes.length)
      : null

  const breakdown: Pick<CircularityScoreBreakdown, 'axes' | 'treatment_mix'> = {
    axes: {
      recycled_content_sub: recycledSub,
      packaging_recyclability_sub: packagingSub,
      diversion_sub: diversionSub,
    },
    treatment_mix: args.treatment_mix,
  }

  if (practicesSub === null && yoySub === null) {
    return {
      ...breakdown,
      score: null,
      practices_sub: null,
      intensity_yoy_sub: null,
      mode: 'no_data',
      weights: { practices: 0, yoy: 0 },
    }
  }

  if (practicesSub !== null && yoySub !== null) {
    const blended =
      practicesSub * CIRCULARITY_PRACTICES_WEIGHT +
      yoySub * CIRCULARITY_YOY_WEIGHT
    return {
      ...breakdown,
      score: Math.round(blended),
      practices_sub: practicesSub,
      intensity_yoy_sub: yoySub,
      mode: 'blended',
      weights: { practices: CIRCULARITY_PRACTICES_WEIGHT, yoy: CIRCULARITY_YOY_WEIGHT },
    }
  }

  if (practicesSub !== null) {
    return {
      ...breakdown,
      score: practicesSub,
      practices_sub: practicesSub,
      intensity_yoy_sub: null,
      mode: 'practices_only',
      weights: { practices: 1, yoy: 0 },
    }
  }

  return {
    ...breakdown,
    score: yoySub,
    practices_sub: null,
    intensity_yoy_sub: yoySub,
    mode: 'yoy_only',
    weights: { practices: 0, yoy: 1 },
  }
}

// -----------------------------------------------------------------------------
// Nature scoring
// -----------------------------------------------------------------------------

/**
 * Blended Nature sub-score using EU Environmental Footprint 3.1 methodology.
 *
 * Weights and normalisation factors come from the JRC Technical Report
 * (Sala et al., 2021, DOI 10.2760/14875) — the EU's official PEF
 * methodology, recognised by TNFD as a quantitative pressure framework.
 *
 * Four axes, each scored 0-100 against the calibrated thresholds in
 * NATURE_PERFORMANCE_THRESHOLDS, then weighted-averaged using EF 3.1
 * weights re-normalised to sum to 1.0 within the nature pillar:
 *
 *   Land Use:                 7.94% / 18.82% = 42.2%
 *   Terrestrial Acidification: 6.21% / 18.82% = 33.0%
 *   Freshwater Eutrophication: 2.80% / 18.82% = 14.9%
 *   Terrestrial Ecotoxicity:   1.87% / 18.82% =  9.9%
 *
 * Acidification weighting under EF 3.1 captures non-biodiversity damage
 * (forest dieback, soil chemistry, building corrosion, respiratory health
 * via SO₂/NOx precursors) — that's why it scores higher than pure
 * biodiversity-loss framing would suggest.
 *
 * YoY is optional with weight redistribution — nature LCA impacts shift
 * slowly (tied to ingredient sourcing) so a flat year shouldn't penalise.
 */
export type NatureScoreMode =
  | 'blended'
  | 'practices_only'
  | 'yoy_only'
  | 'positive_only'
  | 'no_data'

export interface NatureScoreBreakdown {
  /** 0-100 final blended score, or null when no inputs are available. */
  score: number | null
  /** Per-axis sub-scores (each 0-100). Null when the axis has no data. */
  axes: {
    land_use_sub: number | null
    terrestrial_acidification_sub: number | null
    freshwater_eutrophication_sub: number | null
    terrestrial_ecotoxicity_sub: number | null
  }
  /** Per-axis raw per-unit values (kept for the explainer popover). */
  per_unit: {
    land_use: number | null
    terrestrial_acidification: number | null
    freshwater_eutrophication: number | null
    terrestrial_ecotoxicity: number | null
  }
  /** EF 3.1 weighted practices sub-score (0-100). */
  practices_sub: number | null
  /** YoY sub-score (0-100). Null when prior-year data is absent. */
  yoy_sub: number | null
  /**
   * Nature-positive sub-score (0-100) from declared restoration / habitat
   * creation hectares per unit produced, type-weighted. Null when no
   * nature_actions data is available. When non-null, takes 20% of the
   * blend (practices 50%, yoy 30%, positive 20%); redistributes when any
   * axis is missing.
   */
  nature_positive_sub: number | null
  /** Total effective hectares (hectares × type weight) backing the positive sub-score. */
  effective_hectares: number | null
  /**
   * V2-b — country biodiversity context applied to the land_use sub-score.
   * The multiplier is a mass-weighted average across material origins,
   * sourced from the country_biodiversity_factors table (Conservation
   * International hotspots). 1.0 means no penalty/bonus; >1 means a
   * biodiversity-hotspot-heavy supply chain. The land_use per-unit value
   * is multiplied by this *before* banding against EF 3.1 thresholds.
   * Null when no material origin data is available.
   */
  country_biodiversity_multiplier: number | null
  /** Country breakdown for the explainer popover. */
  country_mix: Array<{
    country_code: string
    country_name: string
    share_pct: number
    multiplier: number
    hotspot_names: string[] | null
  }> | null
  /**
   * V2-c — TNFD/ENCORE dependency disclosure score (0-100). Rewards
   * coverage of drinks-material ecosystem services (freshwater, soil,
   * climate, pollination, etc.) plus depth of analysis for high/critical
   * dependencies. Null when no dependencies declared.
   *
   * Applied as a small modifier on the core score: final = 0.9 × core + 0.1 × deps_sub.
   * (Scored disclosure quality, not volume — declaring 'low' on every
   * box doesn't game it because the score weights *coverage of material
   * dependencies*.)
   */
  dependencies_sub: number | null
  /** Number of declared dependencies for the explainer chip. */
  dependencies_declared_count: number | null
  /** Mode that drove the score. */
  mode: NatureScoreMode
  /** Blend weights applied to whichever axes were present. */
  weights: { practices: number; yoy: number; positive: number; dependencies: number }
  /** EF 3.1 source citation surfaced in the UI for transparency. */
  source: { name: string; doi: string }
}

const NATURE_PRACTICES_WEIGHT = 0.6
const NATURE_YOY_WEIGHT = 0.4

/**
 * EF 3.1 nature category weights (Sala et al., 2021). These four sum to
 * 18.82% of the full EF 3.1 single score; we re-normalise within the
 * nature pillar so they sum to 1.0.
 */
const EF31_NATURE_WEIGHTS = {
  land_use: 0.0794,
  terrestrial_acidification: 0.0621,
  freshwater_eutrophication: 0.028,
  terrestrial_ecotoxicity: 0.0187,
} as const
const EF31_NATURE_WEIGHT_TOTAL =
  EF31_NATURE_WEIGHTS.land_use +
  EF31_NATURE_WEIGHTS.terrestrial_acidification +
  EF31_NATURE_WEIGHTS.freshwater_eutrophication +
  EF31_NATURE_WEIGHTS.terrestrial_ecotoxicity

const NATURE_SOURCE = {
  name: 'EU EF 3.1 (Sala et al., 2021)',
  doi: 'https://doi.org/10.2760/14875',
} as const

/** Per-unit thresholds (excellent / good) per axis. Values copy the existing
 * NATURE_PERFORMANCE_THRESHOLDS in lib/calculations/nature-biodiversity.ts
 * to keep this file dependency-free for the test boundary. */
const NATURE_AXIS_THRESHOLDS = {
  land_use: { excellent: 500, good: 2000 }, // m²a/unit
  terrestrial_acidification: { excellent: 1.5, good: 3.0 }, // kg SO₂/unit
  freshwater_eutrophication: { excellent: 0.3, good: 0.7 }, // kg P eq/unit
  terrestrial_ecotoxicity: { excellent: 5, good: 15 }, // kg 1,4-DCB/unit
} as const

/**
 * YoY anchors for nature: lenient like water, since shifting an LCA
 * footprint year-on-year is structurally hard.
 */
const NATURE_YOY_ANCHORS: Array<[number, number]> = [
  [-3, 100],
  [-1, 90],
  [0, 80],
  [2, 60],
  [5, 40],
  [10, 20],
  [20, 5],
]

/**
 * Nature-positive sub-score anchors. Input is *effective square metres of
 * restoration per unit produced* (hectares × type weight × 10,000 / units).
 * Calibration:
 *   0 m²/unit → 0  (no declared action)
 *   1 m²/unit → 30 (token contribution)
 *   5 m²/unit → 60 (meaningful contribution)
 *   10 m²/unit → 80 (substantial — leading practice)
 *   25 m²/unit → 95
 *   50+ m²/unit → 100 (extraordinary — likely large multi-year restoration partnership)
 *
 * For context: a 700ml whisky with 5 m² of regen-ag per bottle implies
 * the producer is sourcing from 5,000 m² (0.5 ha) per 1,000 bottles
 * across the year. That's serious commitment.
 *
 * The conservative bottom anchor (0 → 0, not 5) means orgs without
 * declared actions don't get a free baseline boost — the axis genuinely
 * rewards declared, type-weighted restoration only.
 */
const NATURE_POSITIVE_ANCHORS: Array<[number, number]> = [
  [0, 0],
  [1, 30],
  [5, 60],
  [10, 80],
  [25, 95],
  [50, 100],
]

const NATURE_POSITIVE_BLEND_WEIGHT = 0.2 // 20% when present
const NATURE_PRACTICES_WEIGHT_WITH_POSITIVE = 0.5
const NATURE_YOY_WEIGHT_WITH_POSITIVE = 0.3

/**
 * Score one nature axis against its excellent/good thresholds.
 * 0 → 100 (no impact), excellent → 90, good → 70, 2× good → 25, 4× good → 10.
 */
export function natureAxisSubScore(
  perUnitValue: number,
  thresholds: { excellent: number; good: number },
): number {
  if (!Number.isFinite(perUnitValue) || perUnitValue < 0) return 0
  return Math.round(
    interpolate(perUnitValue, [
      [0, 100],
      [thresholds.excellent, 90],
      [thresholds.good, 70],
      [thresholds.good * 2, 25],
      [thresholds.good * 4, 10],
    ]),
  )
}

export function natureYoySubScore(deltaPct: number): number {
  if (!Number.isFinite(deltaPct)) return 0
  return Math.round(interpolate(deltaPct, NATURE_YOY_ANCHORS))
}

/**
 * Score nature-positive contribution from effective m² per unit produced.
 * Effective m² = hectares × type weight × 10,000.
 */
export function naturePositiveSubScore(effectiveSquareMetresPerUnit: number): number {
  if (!Number.isFinite(effectiveSquareMetresPerUnit) || effectiveSquareMetresPerUnit < 0) {
    return 0
  }
  return Math.round(interpolate(effectiveSquareMetresPerUnit, NATURE_POSITIVE_ANCHORS))
}

export function computeNatureScore(args: {
  per_unit_impacts: {
    land_use: number | null
    terrestrial_acidification: number | null
    freshwater_eutrophication: number | null
    terrestrial_ecotoxicity: number | null
  }
  yoy_total_pct: number | null
  /** Effective m² of restoration per unit produced (type-weighted). Null when no nature_actions data. */
  effective_sq_m_per_unit?: number | null
  /** Total effective hectares for transparency in the breakdown. Null when no actions. */
  effective_hectares?: number | null
  /**
   * V2-b — mass-weighted country biodiversity multiplier applied to the
   * land_use axis BEFORE banding. Default 1.0 (no adjustment). Pass null
   * if no material origin data is available — the breakdown will reflect
   * the absence transparently.
   */
  country_biodiversity_multiplier?: number | null
  /** Country mix for the explainer popover. */
  country_mix?: NatureScoreBreakdown['country_mix']
  /**
   * V2-c — precomputed dependencies sub-score (0-100) from
   * `computeDependenciesSubScore`. Null when no declarations. Applied as
   * a 10% modifier to the core blended score: final = 0.9 × core + 0.1 × deps.
   */
  dependencies_sub?: number | null
  /** Number of dependency declarations for the breakdown chip. */
  dependencies_declared_count?: number | null
}): NatureScoreBreakdown {
  const land = args.per_unit_impacts.land_use
  const acid = args.per_unit_impacts.terrestrial_acidification
  const eutr = args.per_unit_impacts.freshwater_eutrophication
  const ecot = args.per_unit_impacts.terrestrial_ecotoxicity

  // Apply country biodiversity multiplier to land_use only. Multiplier > 1
  // makes the effective land use larger, lowering the sub-score against
  // unchanged EF 3.1 thresholds. v3 will replace this country-level
  // approximation with sub-country spatial lookup.
  const countryMultiplier =
    args.country_biodiversity_multiplier !== null &&
    args.country_biodiversity_multiplier !== undefined &&
    Number.isFinite(args.country_biodiversity_multiplier) &&
    args.country_biodiversity_multiplier > 0
      ? (args.country_biodiversity_multiplier as number)
      : null
  const effectiveLand =
    land !== null && Number.isFinite(land) && countryMultiplier !== null
      ? land * countryMultiplier
      : land

  const landSub =
    effectiveLand !== null && Number.isFinite(effectiveLand)
      ? natureAxisSubScore(effectiveLand, NATURE_AXIS_THRESHOLDS.land_use)
      : null
  const acidSub =
    acid !== null && Number.isFinite(acid)
      ? natureAxisSubScore(acid, NATURE_AXIS_THRESHOLDS.terrestrial_acidification)
      : null
  const eutrSub =
    eutr !== null && Number.isFinite(eutr)
      ? natureAxisSubScore(eutr, NATURE_AXIS_THRESHOLDS.freshwater_eutrophication)
      : null
  const ecotSub =
    ecot !== null && Number.isFinite(ecot)
      ? natureAxisSubScore(ecot, NATURE_AXIS_THRESHOLDS.terrestrial_ecotoxicity)
      : null

  // EF 3.1 weighted blend, redistributing weights across available axes.
  let weightedSum = 0
  let weightTotal = 0
  if (landSub !== null) {
    weightedSum += landSub * EF31_NATURE_WEIGHTS.land_use
    weightTotal += EF31_NATURE_WEIGHTS.land_use
  }
  if (acidSub !== null) {
    weightedSum += acidSub * EF31_NATURE_WEIGHTS.terrestrial_acidification
    weightTotal += EF31_NATURE_WEIGHTS.terrestrial_acidification
  }
  if (eutrSub !== null) {
    weightedSum += eutrSub * EF31_NATURE_WEIGHTS.freshwater_eutrophication
    weightTotal += EF31_NATURE_WEIGHTS.freshwater_eutrophication
  }
  if (ecotSub !== null) {
    weightedSum += ecotSub * EF31_NATURE_WEIGHTS.terrestrial_ecotoxicity
    weightTotal += EF31_NATURE_WEIGHTS.terrestrial_ecotoxicity
  }
  const practicesSub =
    weightTotal > 0 ? Math.round(weightedSum / weightTotal) : null

  const yoySub =
    args.yoy_total_pct !== null && Number.isFinite(args.yoy_total_pct)
      ? natureYoySubScore(args.yoy_total_pct as number)
      : null

  const positiveSub =
    args.effective_sq_m_per_unit !== null &&
    args.effective_sq_m_per_unit !== undefined &&
    Number.isFinite(args.effective_sq_m_per_unit)
      ? naturePositiveSubScore(args.effective_sq_m_per_unit as number)
      : null

  const breakdown: Pick<
    NatureScoreBreakdown,
    'axes' | 'per_unit' | 'source' | 'effective_hectares' | 'country_biodiversity_multiplier' | 'country_mix'
  > = {
    axes: {
      land_use_sub: landSub,
      terrestrial_acidification_sub: acidSub,
      freshwater_eutrophication_sub: eutrSub,
      terrestrial_ecotoxicity_sub: ecotSub,
    },
    per_unit: {
      land_use: land !== null && Number.isFinite(land) ? land : null,
      terrestrial_acidification: acid !== null && Number.isFinite(acid) ? acid : null,
      freshwater_eutrophication: eutr !== null && Number.isFinite(eutr) ? eutr : null,
      terrestrial_ecotoxicity: ecot !== null && Number.isFinite(ecot) ? ecot : null,
    },
    source: NATURE_SOURCE,
    effective_hectares:
      args.effective_hectares !== null &&
      args.effective_hectares !== undefined &&
      Number.isFinite(args.effective_hectares)
        ? (args.effective_hectares as number)
        : null,
    country_biodiversity_multiplier: countryMultiplier,
    country_mix: args.country_mix ?? null,
  }

  // Generic weighted blend across whichever axes are present. Each axis
  // declares a "presence weight" based on its base weight; we sum and
  // normalise so the final score is on 0-100.
  type AxisEntry = { sub: number; weight: number }
  const entries: AxisEntry[] = []
  const hasPositive = positiveSub !== null

  // Practices base weight depends on whether positive is present.
  const practicesBaseWeight = hasPositive
    ? NATURE_PRACTICES_WEIGHT_WITH_POSITIVE
    : NATURE_PRACTICES_WEIGHT
  const yoyBaseWeight = hasPositive
    ? NATURE_YOY_WEIGHT_WITH_POSITIVE
    : NATURE_YOY_WEIGHT

  if (practicesSub !== null) entries.push({ sub: practicesSub, weight: practicesBaseWeight })
  if (yoySub !== null) entries.push({ sub: yoySub, weight: yoyBaseWeight })
  if (positiveSub !== null) entries.push({ sub: positiveSub, weight: NATURE_POSITIVE_BLEND_WEIGHT })

  // V2-c — dependency disclosure modifier. Applied AFTER the core blend
  // because dependencies are a metadata signal, not an impact axis.
  const depsSub =
    args.dependencies_sub !== null &&
    args.dependencies_sub !== undefined &&
    Number.isFinite(args.dependencies_sub)
      ? (args.dependencies_sub as number)
      : null
  const depsDeclaredCount =
    args.dependencies_declared_count !== null &&
    args.dependencies_declared_count !== undefined &&
    Number.isFinite(args.dependencies_declared_count)
      ? (args.dependencies_declared_count as number)
      : null

  if (entries.length === 0) {
    // Edge case: only dependencies are declared (no LCAs, no actions, no YoY).
    // Score the org on disclosure alone — better than 'no data'.
    if (depsSub !== null) {
      return {
        ...breakdown,
        score: Math.round(depsSub),
        practices_sub: null,
        yoy_sub: null,
        nature_positive_sub: null,
        dependencies_sub: depsSub,
        dependencies_declared_count: depsDeclaredCount,
        mode: 'positive_only', // re-use positive_only as the "non-LCA" label
        weights: { practices: 0, yoy: 0, positive: 0, dependencies: 1 },
      }
    }
    return {
      ...breakdown,
      score: null,
      practices_sub: null,
      yoy_sub: null,
      nature_positive_sub: null,
      dependencies_sub: null,
      dependencies_declared_count: null,
      mode: 'no_data',
      weights: { practices: 0, yoy: 0, positive: 0, dependencies: 0 },
    }
  }

  const totalWeight = entries.reduce((a, e) => a + e.weight, 0)
  const coreBlended = entries.reduce((a, e) => a + e.sub * (e.weight / totalWeight), 0)

  // Apply dependencies as a 10% modifier on top of the core blend.
  const finalBlended =
    depsSub !== null ? 0.9 * coreBlended + 0.1 * depsSub : coreBlended

  // Mode label — describes what's *missing* so the explainer can be honest
  // about what the score is built from.
  let mode: NatureScoreMode
  if (practicesSub !== null && yoySub !== null) mode = 'blended'
  else if (practicesSub !== null && positiveSub !== null && yoySub === null) mode = 'blended'
  else if (yoySub !== null && positiveSub !== null && practicesSub === null) mode = 'blended'
  else if (practicesSub !== null) mode = 'practices_only'
  else if (yoySub !== null) mode = 'yoy_only'
  else mode = 'positive_only'

  // Weights to expose. The core axes' weights are scaled by 0.9 if deps
  // are present (since they only get 90% of the final). Deps takes 0.1
  // when present, 0 when absent.
  const coreScale = depsSub !== null ? 0.9 : 1.0
  const exposedWeights = {
    practices:
      practicesSub !== null
        ? (practicesBaseWeight / totalWeight) * coreScale
        : 0,
    yoy: yoySub !== null ? (yoyBaseWeight / totalWeight) * coreScale : 0,
    positive:
      positiveSub !== null
        ? (NATURE_POSITIVE_BLEND_WEIGHT / totalWeight) * coreScale
        : 0,
    dependencies: depsSub !== null ? 0.1 : 0,
  }

  return {
    ...breakdown,
    score: Math.round(finalBlended),
    practices_sub: practicesSub,
    yoy_sub: yoySub,
    nature_positive_sub: positiveSub,
    dependencies_sub: depsSub,
    dependencies_declared_count: depsDeclaredCount,
    mode,
    weights: exposedWeights,
  }
}

/**
 * One nature-positive action with its current period hectares and type.
 * The route assembles these from `nature_actions` joined with their most
 * recent `nature_action_flows` row (or, when no flow is logged, the
 * action's own `hectares` declaration).
 */
export interface NatureActionInput {
  /** Hectares actively delivering ecological value during the period. */
  hectares_active: number
  /** Action type — maps to a 0-1 restoration value weight. */
  action_type: string
  /** Status: only 'in_progress' or 'established' contribute to the score. */
  status: string
}

/**
 * Compute the nature-positive sub-score inputs from a list of active
 * actions and units produced. Type-weights each action's hectares,
 * sums to total effective hectares, divides by units to get effective
 * m² per unit (×10,000 for ha→m²).
 */
export function buildNaturePositiveInputs(args: {
  actions: NatureActionInput[]
  /** Restoration value weight lookup, keyed by action_type. */
  type_value_per_hectare: (action_type: string) => number
  /** Statuses that score (others are excluded). */
  scoring_statuses: Set<string>
  current_year_units: number
}): {
  effective_hectares: number | null
  effective_sq_m_per_unit: number | null
} {
  let totalEffectiveHa = 0
  let any = false
  for (const a of args.actions) {
    if (!args.scoring_statuses.has(a.status)) continue
    const ha = Number.isFinite(a.hectares_active) ? Math.max(0, a.hectares_active) : 0
    if (ha <= 0) continue
    const weight = args.type_value_per_hectare(a.action_type)
    totalEffectiveHa += ha * weight
    any = true
  }
  if (!any) return { effective_hectares: null, effective_sq_m_per_unit: null }
  const effective_sq_m_per_unit =
    args.current_year_units > 0
      ? (totalEffectiveHa * 10000) / args.current_year_units
      : null
  return {
    effective_hectares: totalEffectiveHa,
    effective_sq_m_per_unit,
  }
}

/**
 * EF 3.1 normalised + weighted nature footprint (in weighted person-
 * equivalent units). Used to compute the YoY sub-score on a single
 * combined nature footprint number rather than per-axis trends, which
 * matches how PEF reports a "single score" for nature categories.
 */
export function natureWeightedFootprint(impacts: {
  land_use: number
  terrestrial_acidification: number
  freshwater_eutrophication: number
  terrestrial_ecotoxicity: number
}): number {
  // Normalisation: divide each absolute impact by EF 3.1 per-capita
  // factors to get person-equivalents.
  const land_pe = impacts.land_use / 819000
  const acid_pe = impacts.terrestrial_acidification / 55.6
  const eutr_pe = impacts.freshwater_eutrophication / 1.61
  const ecot_pe = impacts.terrestrial_ecotoxicity / 28700
  // Weight by EF 3.1 contribution-to-single-score factors.
  return (
    land_pe * EF31_NATURE_WEIGHTS.land_use +
    acid_pe * EF31_NATURE_WEIGHTS.terrestrial_acidification +
    eutr_pe * EF31_NATURE_WEIGHTS.freshwater_eutrophication +
    ecot_pe * EF31_NATURE_WEIGHTS.terrestrial_ecotoxicity
  )
}

/**
 * Build the nature inputs from current + prior year aggregated impacts
 * and unit counts. Returns per-unit impacts (current year) for the
 * practices sub-score, and a YoY % change in the EF 3.1 weighted nature
 * footprint.
 */
export function buildNatureInputs(args: {
  current_year_impacts: AggregatedImpacts
  prior_year_impacts: AggregatedImpacts | null
  current_year_units: number
  prior_year_units: number
}): {
  per_unit_impacts: NatureScoreBreakdown['per_unit']
  yoy_total_pct: number | null
} {
  const cur = args.current_year_impacts
  const cu = args.current_year_units
  const per_unit_impacts: NatureScoreBreakdown['per_unit'] = {
    land_use: cu > 0 ? cur.land_use / cu : null,
    terrestrial_acidification: cu > 0 ? cur.terrestrial_acidification / cu : null,
    freshwater_eutrophication:
      cu > 0 ? cur.freshwater_eutrophication / cu : null,
    terrestrial_ecotoxicity: cu > 0 ? cur.terrestrial_ecotoxicity / cu : null,
  }

  let yoy_total_pct: number | null = null
  if (args.prior_year_impacts && args.prior_year_units > 0 && cu > 0) {
    const currentFp = natureWeightedFootprint({
      land_use: cur.land_use,
      terrestrial_acidification: cur.terrestrial_acidification,
      freshwater_eutrophication: cur.freshwater_eutrophication,
      terrestrial_ecotoxicity: cur.terrestrial_ecotoxicity,
    })
    const priorFp = natureWeightedFootprint({
      land_use: args.prior_year_impacts.land_use,
      terrestrial_acidification: args.prior_year_impacts.terrestrial_acidification,
      freshwater_eutrophication: args.prior_year_impacts.freshwater_eutrophication,
      terrestrial_ecotoxicity: args.prior_year_impacts.terrestrial_ecotoxicity,
    })
    if (priorFp > 0) {
      yoy_total_pct = ((currentFp - priorFp) / priorFp) * 100
    }
  }

  return { per_unit_impacts, yoy_total_pct }
}

/**
 * One waste record from facility_activity_entries used to build the
 * treatment mix. The route assembles these from the year's entries.
 */
export interface WasteEntry {
  /** Mass of this waste record in kilograms. */
  mass_kg: number
  /** Treatment method as stored in `facility_activity_entries.waste_treatment_method`. */
  treatment_method: string | null
}

/**
 * Build the four circularity inputs from raw waste entries + the org-level
 * recycled-content + recyclability averages + units produced.
 *
 * Pure — no DB calls. The route fetches and feeds in.
 */
export function buildCircularityInputs(args: {
  /** All waste entries logged for the current year (any facility). */
  current_waste: WasteEntry[]
  /** All waste entries logged for the prior year, for YoY intensity. */
  prior_waste: WasteEntry[]
  /** Total units produced in the current year (for waste intensity). */
  current_year_units: number
  /** Total units produced in the prior year (for YoY waste intensity). */
  prior_year_units: number
  /** Org-level avg recycled content of inputs (0-100). Null if unknown. */
  recycled_content_pct: number | null
  /** Org-level avg packaging recyclability (0-100). Null if unknown. */
  packaging_recyclability_pct: number | null
}): {
  recycled_content_pct: number | null
  packaging_recyclability_pct: number | null
  tier_weighted_diversion_pct: number | null
  intensity_yoy_pct: number | null
  treatment_mix: CircularityScoreBreakdown['treatment_mix']
  diagnostics: {
    current_year_waste_kg: number
    prior_year_waste_kg: number
    current_year_intensity: number | null
    prior_year_intensity: number | null
  }
} {
  const mix: CircularityScoreBreakdown['treatment_mix'] = {
    reuse: 0,
    composting: 0,
    anaerobic_digestion: 0,
    recycling: 0,
    incineration_with_recovery: 0,
    landfill: 0,
    incineration_without_recovery: 0,
    other: 0,
  }

  const validKeys = new Set(Object.keys(mix))
  let totalCurrent_kg = 0
  for (const e of args.current_waste) {
    const kg = Number.isFinite(e.mass_kg) && e.mass_kg > 0 ? e.mass_kg : 0
    if (kg <= 0) continue
    const method = (e.treatment_method ?? '').toLowerCase().trim()
    const key = validKeys.has(method) ? (method as keyof typeof mix) : 'other'
    mix[key] += kg
    totalCurrent_kg += kg
  }
  // Normalise to proportions of total.
  if (totalCurrent_kg > 0) {
    for (const key of Object.keys(mix) as Array<keyof typeof mix>) {
      mix[key] = mix[key] / totalCurrent_kg
    }
  }

  let totalPrior_kg = 0
  for (const e of args.prior_waste) {
    const kg = Number.isFinite(e.mass_kg) && e.mass_kg > 0 ? e.mass_kg : 0
    if (kg > 0) totalPrior_kg += kg
  }

  const tier_weighted_diversion_pct =
    totalCurrent_kg > 0 ? tierWeightedDiversionPct(mix) : null

  const currentIntensity =
    args.current_year_units > 0 && totalCurrent_kg > 0
      ? totalCurrent_kg / args.current_year_units
      : null
  const priorIntensity =
    args.prior_year_units > 0 && totalPrior_kg > 0
      ? totalPrior_kg / args.prior_year_units
      : null
  const intensity_yoy_pct =
    currentIntensity !== null && priorIntensity !== null && priorIntensity > 0
      ? ((currentIntensity - priorIntensity) / priorIntensity) * 100
      : null

  return {
    recycled_content_pct: args.recycled_content_pct,
    packaging_recyclability_pct: args.packaging_recyclability_pct,
    tier_weighted_diversion_pct,
    intensity_yoy_pct,
    treatment_mix: mix,
    diagnostics: {
      current_year_waste_kg: totalCurrent_kg,
      prior_year_waste_kg: totalPrior_kg,
      current_year_intensity: currentIntensity,
      prior_year_intensity: priorIntensity,
    },
  }
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
