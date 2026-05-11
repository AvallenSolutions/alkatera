/**
 * GET /api/vitality/composite — ESG composite for the Rosa hub + /performance/ page.
 *
 * Composes:
 *   E = environmental sub-pillars (climate proxy from lca_completeness_pct + water/waste snapshots)
 *   S = community-impact + people-culture + supplier-ESG signals
 *   G = governance + certifications progress
 *
 * Reads org weighting from organizations.vitality_weights (defaults to
 * { e: 0.5, s: 0.25, g: 0.25 }). Snapshots the result idempotently per
 * (org, day) into esg_score_snapshots so the 12-week trend fills out
 * lazily on user visits — no cron needed.
 *
 * The narrative read is curated by Claude via tool_use; falls back to a
 * deterministic summary on error.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import {
  composeVitality,
  computeEnvironmentalPillar,
  computeGovernancePillar,
  computeSocialPillar,
  type SocialPillarScore,
  normaliseWeights,
  BAND_DESCRIPTIONS,
  type VitalityComposite,
  type VitalityWeights,
} from '@/lib/vitality/composite'
import {
  loadTrend,
  trendDelta,
  upsertSnapshot,
  type TrendPoint,
} from '@/lib/vitality/snapshot'
import {
  VITALITY_READ_TOOL,
  buildVitalityReadSystemPrompt,
  formatVitalityForPrompt,
  type VitalityRead,
} from '@/lib/vitality/read-prompt'
import { isOverDailyBudget, logRosaTelemetry } from '@/lib/rosa/budget'
import {
  aggregateImpacts,
  buildCircularityInputs,
  buildClimateInputs,
  buildEnvironmentalSignals,
  buildNatureInputs,
  buildNaturePositiveInputs,
  buildWaterInputs,
  computeCircularityScore,
  computeClimateScore,
  computeNatureScore,
  computeWaterScore,
  toEnvironmentalInputs,
  unitSizeToLitres,
  type ClimateProductRow,
  type NatureActionInput,
  type PcfWithEol,
  type WasteEntry,
  type WaterProductRow,
} from '@/lib/vitality/environmental'
import { destinationToTreatmentMethod } from '@/lib/byproducts/destination-types'
import {
  computeSocialScore,
  type SupplierResponsibilityInputs,
} from '@/lib/vitality/social'
import {
  computeGovernanceScore,
  type CertificationsInputs,
} from '@/lib/vitality/governance'
import {
  computeAttestationsScore,
  type SupplierAttestationType,
} from '@/lib/supplier-responsibility/attestation-types'
import { calculateCommunityImpactScore } from '@/lib/community-impact/score'
import {
  actionTypeValuePerHectare,
  SCORING_STATUSES,
} from '@/lib/nature-actions/action-types'
import {
  computeCountryMix,
  type CountryBiodiversityFactor,
  type MaterialOrigin,
} from '@/lib/nature-context/country-biodiversity'
import {
  computeDependenciesSubScore,
  type Materiality,
} from '@/lib/nature-context/dependency-types'

export const runtime = 'nodejs'
export const maxDuration = 30

const MODEL = 'claude-sonnet-4-6'
const MAX_OUTPUT_TOKENS = 800

interface ResponsePayload {
  composite: VitalityComposite
  trend: TrendPoint[]
  trend_delta: { first: number | null; last: number | null; delta_points: number | null }
  band_description: string
  read: VitalityRead | null
  source: 'curator' | 'fallback'
  generated_at: string
}

async function resolveContext(req: NextRequest) {
  const userSupabase = getSupabaseServerClient()
  const {
    data: { user },
    error: userErr,
  } = await userSupabase.auth.getUser()
  if (userErr || !user) {
    return { error: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }) }
  }
  const { data: membership } = await userSupabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!membership) {
    return { error: NextResponse.json({ error: 'No organisation' }, { status: 403 }) }
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { error: NextResponse.json({ error: 'Service role missing' }, { status: 500 }) }
  }
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return {
    userId: user.id,
    organizationId: (membership as any).organization_id as string,
    service,
  }
}

/**
 * Server-side environmental inputs. Reads completed PCFs (with their
 * aggregated_impacts blob) and uses the shared aggregator in
 * lib/vitality/environmental.ts so the score on /rosa/ matches what
 * /performance/ computes client-side via useCompanyMetrics. Same band,
 * same intuition.
 *
 * Climate is now scored via the blended `computeClimateScore` (60%
 * intensity vs benchmark + 40% YoY emissions trend), not the legacy
 * per-LCA-count ratio. We pass the breakdown verbatim so the explainer
 * popover can show users the exact sub-scores, weights, and inputs.
 */
async function buildEnvironmentalInputs(
  service: SupabaseClient,
  organizationId: string,
): Promise<Parameters<typeof computeEnvironmentalPillar>[0]> {
  const yearNow = new Date().getFullYear()
  const yearStart = `${yearNow}-01-01`
  const yearEnd = `${yearNow}-12-31`
  const priorStart = `${yearNow - 1}-01-01`
  const priorEnd = `${yearNow - 1}-12-31`

  // Query the same fields useCompanyMetrics queries on the client.
  // production_volume is NOT a column on product_carbon_footprints — it's
  // joined from production_logs / pcf_production_sites / cm_allocations.
  // Facility water: primary source is facility_activity_entries (water_intake
  // rows — the live single-entry table written by document imports and manual
  // entry). facility_water_data is kept as a legacy fallback for orgs that
  // entered water data via the old per-facility analytics form before the
  // activity-entries migration; if activity entries exist they take priority.
  const [
    pcfRows,
    productRows,
    orgRow,
    waterActivityCurrent,
    waterActivityPrior,
    facilityWaterCurrent,
    facilityWaterPrior,
    wasteCurrent,
    wastePrior,
    circularitySummary,
    byproductFlowsCurrent,
    byproductFlowsPrior,
    natureActions,
    natureActionFlowsCurrent,
    materialOrigins,
    countryFactors,
    natureDependencies,
  ] = await Promise.allSettled([
    service
      .from('product_carbon_footprints')
      .select('id, product_id, product_name, status, aggregated_impacts, csrd_compliant, updated_at')
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .not('aggregated_impacts', 'is', null)
      .limit(500),
    service
      .from('products')
      .select('id, product_type, product_category, unit_size_value, unit_size_unit')
      .eq('organization_id', organizationId)
      .limit(500),
    service
      .from('organizations')
      .select('product_type')
      .eq('id', organizationId)
      .maybeSingle(),
    // Live water intake from facility_activity_entries (primary source).
    service
      .from('facility_activity_entries')
      .select('quantity, quantity_unit, activity_date')
      .eq('organization_id', organizationId)
      .eq('activity_category', 'water_intake')
      .gte('activity_date', yearStart)
      .lte('activity_date', yearEnd),
    service
      .from('facility_activity_entries')
      .select('quantity, quantity_unit, activity_date')
      .eq('organization_id', organizationId)
      .eq('activity_category', 'water_intake')
      .gte('activity_date', priorStart)
      .lte('activity_date', priorEnd),
    // Legacy fallback: facility_water_data (pre-aggregated; used only when
    // no activity entries exist for the year).
    service
      .from('facility_water_data')
      .select('total_consumption_m3, scarcity_weighted_consumption_m3')
      .eq('organization_id', organizationId)
      .eq('reporting_year', yearNow),
    service
      .from('facility_water_data')
      .select('total_consumption_m3, scarcity_weighted_consumption_m3')
      .eq('organization_id', organizationId)
      .eq('reporting_year', yearNow - 1),
    service
      .from('facility_activity_entries')
      .select('quantity, waste_treatment_method')
      .eq('organization_id', organizationId)
      .in('activity_category', ['waste_general', 'waste_hazardous', 'waste_recycling'])
      .gte('activity_date', yearStart)
      .lte('activity_date', yearEnd),
    service
      .from('facility_activity_entries')
      .select('quantity, waste_treatment_method')
      .eq('organization_id', organizationId)
      .in('activity_category', ['waste_general', 'waste_hazardous', 'waste_recycling'])
      .gte('activity_date', priorStart)
      .lte('activity_date', priorEnd),
    service
      .from('circularity_metrics_summary')
      .select('avg_recycled_content, avg_recyclability')
      .eq('organization_id', organizationId)
      .maybeSingle(),
    // Byproduct flows merge into the circularity score's waste totals so
    // a partnership routing 12 t/month spent grain to animal feed lifts
    // the score by the same multiplier that a waste-entry with
    // treatment_method='reuse' would. Excludes flows from byproducts that
    // are already in 'ended' status so the score reflects current activity.
    service
      .from('byproduct_flows')
      .select('mass_kg, byproducts!inner(destination_type, status)')
      .eq('organization_id', organizationId)
      .gte('reporting_period_end', yearStart)
      .lte('reporting_period_end', yearEnd)
      .neq('byproducts.status', 'ended'),
    service
      .from('byproduct_flows')
      .select('mass_kg, byproducts!inner(destination_type, status)')
      .eq('organization_id', organizationId)
      .gte('reporting_period_end', priorStart)
      .lte('reporting_period_end', priorEnd),
    // Nature-positive actions — feeds the nature_positive_sub axis. We
    // pull all non-ended actions and their most-recent flow inside the
    // current year (if any). When no flow exists, the action's declared
    // hectares is used as a fallback for in_progress / established work.
    service
      .from('nature_actions')
      .select('id, action_type, hectares, status')
      .eq('organization_id', organizationId)
      .neq('status', 'ended'),
    service
      .from('nature_action_flows')
      .select('nature_action_id, reporting_period_end, hectares_active')
      .eq('organization_id', organizationId)
      .gte('reporting_period_end', yearStart)
      .lte('reporting_period_end', yearEnd)
      .order('reporting_period_end', { ascending: false }),
    // V2-b — material origins for country biodiversity multiplier.
    // Joined with the org's PCFs so we only count active products.
    service
      .from('product_carbon_footprint_materials')
      .select(
        'mass_kg, origin_country_code, product_carbon_footprints!inner(organization_id, status)',
      )
      .eq('product_carbon_footprints.organization_id', organizationId)
      .eq('product_carbon_footprints.status', 'completed')
      .not('origin_country_code', 'is', null),
    service
      .from('country_biodiversity_factors')
      .select('country_code, country_name, land_use_multiplier, hotspot_names'),
    // V2-c — dependency declarations.
    service
      .from('nature_dependencies')
      .select('dependency_type, materiality, notes')
      .eq('organization_id', organizationId),
  ])

  const valOrNull = <T>(r: PromiseSettledResult<T>): T | null =>
    r.status === 'fulfilled' ? r.value : null

  let lcas = (((valOrNull(pcfRows) as any)?.data ?? []) as PcfWithEol[]).filter(
    (l): l is PcfWithEol => Boolean(l && l.id),
  )

  const productRowsData = ((valOrNull(productRows) as any)?.data ?? []) as Array<{
    id: string | number | null
    product_type: string | null
    product_category: string | null
    unit_size_value: number | null
    unit_size_unit: string | null
  }>

  // Production-volume join chain — mirrors useCompanyMetrics priority:
  //   1. Sum of production_logs.units_produced (current year)
  //   2. Max of product_carbon_footprint_production_sites.production_volume
  //   3. Max of contract_manufacturer_allocations.client_production_volume
  //   4. 1-unit fallback so per-unit impacts still contribute
  // We also pull *prior-year* production_logs so the YoY emissions trend
  // can be computed for the climate score.
  let productionByProduct = new Map<string, number>()
  let priorProductionByProduct = new Map<string, number>()
  if (lcas.length > 0) {
    const productIds = Array.from(new Set(lcas.map(l => l.product_id).filter(Boolean) as Array<string | number>))
    const lcaIds = lcas.map(l => l.id)

    const [logsRes, priorLogsRes, sitesRes, cmRes] = await Promise.allSettled([
      productIds.length > 0
        ? service
            .from('production_logs')
            .select('product_id, units_produced')
            .eq('organization_id', organizationId)
            .gte('date', yearStart)
            .lte('date', yearEnd)
            .in('product_id', productIds as any)
        : Promise.resolve({ data: [] as Array<{ product_id: any; units_produced: number | null }>, error: null }),
      productIds.length > 0
        ? service
            .from('production_logs')
            .select('product_id, units_produced')
            .eq('organization_id', organizationId)
            .gte('date', priorStart)
            .lte('date', priorEnd)
            .in('product_id', productIds as any)
        : Promise.resolve({ data: [] as Array<{ product_id: any; units_produced: number | null }>, error: null }),
      lcaIds.length > 0
        ? service
            .from('product_carbon_footprint_production_sites')
            .select('product_carbon_footprint_id, production_volume')
            .in('product_carbon_footprint_id', lcaIds)
        : Promise.resolve({ data: [] as Array<{ product_carbon_footprint_id: string; production_volume: number | null }>, error: null }),
      productIds.length > 0
        ? service
            .from('contract_manufacturer_allocations')
            .select('product_id, client_production_volume')
            .eq('organization_id', organizationId)
            .in('product_id', productIds as any)
        : Promise.resolve({ data: [] as Array<{ product_id: any; client_production_volume: number | null }>, error: null }),
    ])

    const sitesByLca = new Map<string, number>()
    const cmByProduct = new Map<string, number>()

    const logRows = ((valOrNull(logsRes) as any)?.data ?? []) as Array<{
      product_id: string | number
      units_produced: number | null
    }>
    for (const r of logRows) {
      const key = String(r.product_id)
      const u = Number(r.units_produced ?? 0)
      if (!Number.isFinite(u) || u <= 0) continue
      productionByProduct.set(key, (productionByProduct.get(key) ?? 0) + u)
    }
    const priorLogRows = ((valOrNull(priorLogsRes) as any)?.data ?? []) as Array<{
      product_id: string | number
      units_produced: number | null
    }>
    for (const r of priorLogRows) {
      const key = String(r.product_id)
      const u = Number(r.units_produced ?? 0)
      if (!Number.isFinite(u) || u <= 0) continue
      priorProductionByProduct.set(key, (priorProductionByProduct.get(key) ?? 0) + u)
    }
    const siteRows = ((valOrNull(sitesRes) as any)?.data ?? []) as Array<{
      product_carbon_footprint_id: string
      production_volume: number | null
    }>
    for (const r of siteRows) {
      const v = Number(r.production_volume ?? 0)
      if (!Number.isFinite(v) || v <= 0) continue
      const cur = sitesByLca.get(r.product_carbon_footprint_id) ?? 0
      if (v > cur) sitesByLca.set(r.product_carbon_footprint_id, v)
    }
    const cmRows = ((valOrNull(cmRes) as any)?.data ?? []) as Array<{
      product_id: string | number
      client_production_volume: number | null
    }>
    for (const r of cmRows) {
      const v = Number(r.client_production_volume ?? 0)
      if (!Number.isFinite(v) || v <= 0) continue
      const key = String(r.product_id)
      const cur = cmByProduct.get(key) ?? 0
      if (v > cur) cmByProduct.set(key, v)
    }

    // Stamp production_volume on each PCF (used by the water/circularity
    // aggregators). The same join-chain fallback (logs → sites → cm → 1)
    // is also folded back into productionByProduct below so that the
    // per-product builders (climate/water/nature) get meaningful unit
    // counts even when an org tracks production via pcf_production_sites
    // or contract_manufacturer_allocations rather than production_logs.
    lcas = lcas.map(lca => {
      const productKey = String(lca.product_id ?? '')
      const fromLogs = productionByProduct.get(productKey) ?? 0
      if (fromLogs > 0) return { ...lca, production_volume: fromLogs }
      const fromSites = sitesByLca.get(lca.id) ?? 0
      if (fromSites > 0) return { ...lca, production_volume: fromSites }
      const fromCm = cmByProduct.get(productKey) ?? 0
      return { ...lca, production_volume: fromCm > 0 ? fromCm : 1 }
    })

    // Backfill productionByProduct with the same join-chain fallback so
    // the climate/water/nature builders see units. Prior-year stays
    // logs-only (sites/cm aren't time-stamped, so YoY would be a lie).
    for (const lca of lcas) {
      const productKey = String(lca.product_id ?? '')
      if (!productKey) continue
      if ((productionByProduct.get(productKey) ?? 0) > 0) continue
      const v = Number(lca.production_volume ?? 0)
      if (Number.isFinite(v) && v > 0) {
        productionByProduct.set(productKey, v)
      }
    }
  }

  // Build per-product climate signal rows and run the blended score. The
  // breakdown is what powers the explainer popover and the main score.
  const productById = new Map<string, (typeof productRowsData)[number]>()
  for (const p of productRowsData) {
    if (p.id !== null && p.id !== undefined) productById.set(String(p.id), p)
  }
  const completedLcas = lcas.filter(l => l.status === 'completed')
  const climateRowsByProduct = new Map<string, ClimateProductRow>()
  for (const lca of completedLcas) {
    const productKey = String(lca.product_id ?? '')
    if (!productKey) continue
    if (climateRowsByProduct.has(productKey)) continue
    const product = productById.get(productKey) ?? null
    const perUnit = lca.aggregated_impacts?.climate_change_gwp100 ?? null
    const cur = productionByProduct.get(productKey) ?? 0
    const pri = priorProductionByProduct.get(productKey) ?? 0
    climateRowsByProduct.set(productKey, {
      product_id: productKey,
      product_category: product?.product_category ?? null,
      product_type: product?.product_type ?? null,
      // Fall back to 1.0 L when unit_size isn't declared on the product.
      // Without this the benchmark denominator is 0 and the climate/water
      // score is null even when the org has perfectly good LCAs and unit
      // counts. The fallback is dimensionally a "product = 1 litre"
      // assumption — accurate enough to give producers a usable score
      // until they fill in proper unit sizes.
      unit_size_l:
        unitSizeToLitres(product?.unit_size_value, product?.unit_size_unit) ?? 1.0,
      units_produced_current: cur,
      units_produced_prior: pri,
      per_unit_emissions_kgco2e:
        perUnit !== null && Number.isFinite(perUnit) ? Number(perUnit) : null,
    })
  }
  // Org-level product_type fallback — used by the climate/water benchmark
  // pickers when products lack their own product_category / product_type.
  // Sourced from organizations.product_type, falling back to the first
  // product's product_type if the org-level field isn't set.
  const orgProductType =
    ((valOrNull(orgRow) as any)?.data?.product_type as string | null) ??
    productRowsData[0]?.product_type ??
    null

  const climateInputs = buildClimateInputs(
    Array.from(climateRowsByProduct.values()),
    orgProductType,
  )
  const climateBreakdown = computeClimateScore({
    intensity_ratio: climateInputs.intensity_ratio,
    yoy_delta_pct: climateInputs.yoy_delta_pct,
  })

  // Build per-product water signal rows (LCA fallback) and the org-level
  // facility intake totals (preferred). Same simple-and-robust dedup rule:
  // if facility data exists for the current year, it wins outright; LCA
  // water is otherwise used as the proxy.
  const waterRowsByProduct = new Map<string, WaterProductRow>()
  for (const lca of completedLcas) {
    const productKey = String(lca.product_id ?? '')
    if (!productKey) continue
    if (waterRowsByProduct.has(productKey)) continue
    const product = productById.get(productKey) ?? null
    const perUnitWater = lca.aggregated_impacts?.water_consumption ?? null
    const perUnitScarcity = lca.aggregated_impacts?.water_scarcity_aware ?? null
    const cur = productionByProduct.get(productKey) ?? 0
    const pri = priorProductionByProduct.get(productKey) ?? 0
    waterRowsByProduct.set(productKey, {
      product_id: productKey,
      product_category: product?.product_category ?? null,
      product_type: product?.product_type ?? null,
      // Fall back to 1.0 L when unit_size isn't declared on the product.
      // Without this the benchmark denominator is 0 and the climate/water
      // score is null even when the org has perfectly good LCAs and unit
      // counts. The fallback is dimensionally a "product = 1 litre"
      // assumption — accurate enough to give producers a usable score
      // until they fill in proper unit sizes.
      unit_size_l:
        unitSizeToLitres(product?.unit_size_value, product?.unit_size_unit) ?? 1.0,
      units_produced_current: cur,
      units_produced_prior: pri,
      per_unit_water_m3:
        perUnitWater !== null && Number.isFinite(perUnitWater) ? Number(perUnitWater) : null,
      per_unit_scarcity_m3:
        perUnitScarcity !== null && Number.isFinite(perUnitScarcity)
          ? Number(perUnitScarcity)
          : null,
    })
  }

  // Aggregate water intake from facility_activity_entries (primary source).
  // Units may be 'm3', 'm³', 'L', 'litre', 'litres' — normalise to m³.
  const activityWaterCurrentRows = ((valOrNull(waterActivityCurrent) as any)?.data ?? []) as Array<{
    quantity: number | null
    quantity_unit: string | null
    activity_date: string | null
  }>
  const activityWaterPriorRows = ((valOrNull(waterActivityPrior) as any)?.data ?? []) as Array<{
    quantity: number | null
    quantity_unit: string | null
    activity_date: string | null
  }>

  function toM3(qty: number | null, unit: string | null): number {
    if (qty === null || !Number.isFinite(qty) || qty <= 0) return 0
    const u = (unit ?? '').toLowerCase().trim()
    if (u === 'l' || u === 'litre' || u === 'litres' || u === 'liter' || u === 'liters') {
      return qty / 1000
    }
    return qty // assume m³ for everything else (m3, m³, cubic metres, etc.)
  }

  function sumActivityWater(rows: typeof activityWaterCurrentRows): number | null {
    if (!rows.length) return null
    let total = 0
    let any = false
    for (const r of rows) {
      const m3 = toM3(r.quantity, r.quantity_unit)
      if (m3 > 0) { total += m3; any = true }
    }
    return any ? total : null
  }

  const activityIntakeCurrent_m3 = sumActivityWater(activityWaterCurrentRows)
  const activityIntakePrior_m3 = sumActivityWater(activityWaterPriorRows)

  // Legacy facility_water_data fallback (used only when no activity entries exist).
  const facilityCurrentRows = ((valOrNull(facilityWaterCurrent) as any)?.data ?? []) as Array<{
    total_consumption_m3: number | null
    scarcity_weighted_consumption_m3: number | null
  }>
  const facilityPriorRows = ((valOrNull(facilityWaterPrior) as any)?.data ?? []) as Array<{
    total_consumption_m3: number | null
    scarcity_weighted_consumption_m3: number | null
  }>
  const sumOrNull = (rows: typeof facilityCurrentRows, key: keyof (typeof facilityCurrentRows)[number]): number | null => {
    if (!rows.length) return null
    let total = 0
    let any = false
    for (const r of rows) {
      const v = Number(r[key] ?? 0)
      if (Number.isFinite(v) && v > 0) {
        total += v
        any = true
      }
    }
    return any ? total : null
  }
  const legacyIntakeCurrent_m3 = sumOrNull(facilityCurrentRows, 'total_consumption_m3')
  const legacyIntakePrior_m3 = sumOrNull(facilityPriorRows, 'total_consumption_m3')
  const legacyScarcityCurrent_m3 = sumOrNull(facilityCurrentRows, 'scarcity_weighted_consumption_m3')

  // Prefer activity entries; fall back to legacy table.
  // Schema names the column "total_consumption_m3" but it is actually total
  // *intake* — the legacy naming predates the operational/embedded split.
  // Litres = m³ × 1000.
  const facilityIntakeCurrent_m3 = activityIntakeCurrent_m3 ?? legacyIntakeCurrent_m3
  const facilityIntakePrior_m3 = activityIntakePrior_m3 ?? legacyIntakePrior_m3
  // Scarcity weighting is only in the legacy table for now; activity entries
  // don't carry a scarcity factor yet so we keep the legacy value when available.
  const facilityScarcityCurrent_m3 = legacyScarcityCurrent_m3

  const waterInputs = buildWaterInputs({
    products: Array.from(waterRowsByProduct.values()),
    facility_intake_current_l:
      facilityIntakeCurrent_m3 !== null ? facilityIntakeCurrent_m3 * 1000 : null,
    facility_intake_prior_l:
      facilityIntakePrior_m3 !== null ? facilityIntakePrior_m3 * 1000 : null,
    facility_scarcity_current_l:
      facilityScarcityCurrent_m3 !== null ? facilityScarcityCurrent_m3 * 1000 : null,
    orgProductType,
  })
  const waterBreakdown = computeWaterScore({
    intensity_ratio: waterInputs.intensity_ratio,
    yoy_delta_pct: waterInputs.yoy_delta_pct,
    avg_scarcity_factor: waterInputs.avg_scarcity_factor,
    source: waterInputs.source,
  })

  // ---- Circularity ----
  // Tier-weighted diversion + 3-axis practices blend + waste-intensity YoY.
  // Reuses the per-product current/prior units already computed above so we
  // don't double-fetch production_logs.
  let totalCurrentUnits = 0
  let totalPriorUnits = 0
  for (const v of Array.from(productionByProduct.values())) totalCurrentUnits += v
  for (const v of Array.from(priorProductionByProduct.values())) totalPriorUnits += v

  const wasteCurrentRows = ((valOrNull(wasteCurrent) as any)?.data ?? []) as Array<{
    quantity: number | null
    waste_treatment_method: string | null
  }>
  const wastePriorRows = ((valOrNull(wastePrior) as any)?.data ?? []) as Array<{
    quantity: number | null
    waste_treatment_method: string | null
  }>
  const toWasteEntries = (rows: typeof wasteCurrentRows): WasteEntry[] =>
    rows.map(r => ({
      mass_kg: Number(r.quantity ?? 0) || 0,
      treatment_method: r.waste_treatment_method,
    }))

  // Byproduct flows: merge into the waste totals so circular partnerships
  // lift the score. Each flow becomes a synthetic waste entry whose
  // treatment_method maps to the byproduct's destination_type tier.
  type ByproductFlowRow = {
    mass_kg: number | null
    byproducts: { destination_type: string | null } | { destination_type: string | null }[] | null
  }
  const flowsToWasteEntries = (rows: ByproductFlowRow[]): WasteEntry[] =>
    rows.map(r => {
      const bp = Array.isArray(r.byproducts) ? r.byproducts[0] : r.byproducts
      const treatment = destinationToTreatmentMethod(bp?.destination_type ?? null)
      return {
        mass_kg: Number(r.mass_kg ?? 0) || 0,
        treatment_method: treatment,
      }
    })
  const byproductCurrentRows = ((valOrNull(byproductFlowsCurrent) as any)?.data ?? []) as ByproductFlowRow[]
  const byproductPriorRows = ((valOrNull(byproductFlowsPrior) as any)?.data ?? []) as ByproductFlowRow[]

  const circularityRow = ((valOrNull(circularitySummary) as any)?.data ?? null) as
    | { avg_recycled_content: number | null; avg_recyclability: number | null }
    | null
  const recycledContentPct = numOrNull(circularityRow?.avg_recycled_content)
  const packagingRecyclabilityPct = numOrNull(circularityRow?.avg_recyclability)

  const circularityInputs = buildCircularityInputs({
    current_waste: [
      ...toWasteEntries(wasteCurrentRows),
      ...flowsToWasteEntries(byproductCurrentRows),
    ],
    prior_waste: [
      ...toWasteEntries(wastePriorRows),
      ...flowsToWasteEntries(byproductPriorRows),
    ],
    current_year_units: totalCurrentUnits,
    prior_year_units: totalPriorUnits,
    recycled_content_pct: recycledContentPct,
    packaging_recyclability_pct: packagingRecyclabilityPct,
  })
  const circularityBreakdown = computeCircularityScore({
    recycled_content_pct: circularityInputs.recycled_content_pct,
    packaging_recyclability_pct: circularityInputs.packaging_recyclability_pct,
    tier_weighted_diversion_pct: circularityInputs.tier_weighted_diversion_pct,
    intensity_yoy_pct: circularityInputs.intensity_yoy_pct,
    treatment_mix: circularityInputs.treatment_mix,
  })

  // ---- Nature ----
  // Current-year aggregated impacts already use current-year production_volume
  // stamped on the lcas earlier in the function. For prior year we re-aggregate
  // with prior-year volumes swapped in, so the YoY trend reflects the same
  // per-product LCA × different annual production. This kills the /rosa/ vs
  // /performance/ parity bug — both surfaces now read this single breakdown.
  const completedForNature = lcas.filter(l => l.status === 'completed')
  const currentYearImpacts = aggregateImpacts(completedForNature)
  const priorLcas = completedForNature.map(l => {
    const priorVolume = priorProductionByProduct.get(String(l.product_id ?? '')) ?? 0
    return { ...l, production_volume: priorVolume }
  })
  const priorYearImpacts = priorLcas.some(l => (l.production_volume ?? 0) > 0)
    ? aggregateImpacts(priorLcas)
    : null
  const natureInputs = buildNatureInputs({
    current_year_impacts: currentYearImpacts,
    prior_year_impacts: priorYearImpacts,
    current_year_units: totalCurrentUnits,
    prior_year_units: totalPriorUnits,
  })

  // Nature-positive actions: type-weight hectares-actively-delivering and
  // divide by units to feed the nature_positive_sub axis. The route prefers
  // the most-recent in-year flow for each action; falls back to the action's
  // declared hectares when no flow has been logged but status is in_progress
  // or established.
  type ActionRow = {
    id: string
    action_type: string
    hectares: number | null
    status: string
  }
  type FlowRow = {
    nature_action_id: string
    reporting_period_end: string
    hectares_active: number | null
  }
  const actionRows = ((valOrNull(natureActions) as any)?.data ?? []) as ActionRow[]
  const flowRows = ((valOrNull(natureActionFlowsCurrent) as any)?.data ?? []) as FlowRow[]
  const latestFlowByAction = new Map<string, number>()
  for (const f of flowRows) {
    // Rows arrived ordered by reporting_period_end DESC, so the first hit per
    // action wins.
    if (latestFlowByAction.has(f.nature_action_id)) continue
    const v = Number(f.hectares_active ?? 0)
    if (Number.isFinite(v) && v >= 0) latestFlowByAction.set(f.nature_action_id, v)
  }
  const actionInputs: NatureActionInput[] = actionRows.map(a => ({
    hectares_active:
      latestFlowByAction.get(a.id) ?? Number(a.hectares ?? 0),
    action_type: a.action_type,
    status: a.status,
  }))
  const positiveInputs = buildNaturePositiveInputs({
    actions: actionInputs,
    type_value_per_hectare: actionTypeValuePerHectare,
    scoring_statuses: SCORING_STATUSES,
    current_year_units: totalCurrentUnits,
  })

  // V2-b — country biodiversity multiplier from material origins.
  type MaterialOriginRow = {
    mass_kg: number | null
    origin_country_code: string | null
  }
  const materialOriginRows = ((valOrNull(materialOrigins) as any)?.data ??
    []) as MaterialOriginRow[]
  const factorRows = ((valOrNull(countryFactors) as any)?.data ?? []) as Array<{
    country_code: string
    country_name: string
    land_use_multiplier: number
    hotspot_names: string[] | null
  }>
  const factorByCountry = new Map<string, CountryBiodiversityFactor>()
  for (const f of factorRows) {
    factorByCountry.set(f.country_code.toUpperCase(), {
      country_code: f.country_code.toUpperCase(),
      country_name: f.country_name,
      land_use_multiplier: Number(f.land_use_multiplier),
      hotspot_names: f.hotspot_names,
    })
  }
  const origins: MaterialOrigin[] = materialOriginRows.map(r => ({
    country_code: r.origin_country_code,
    mass_weight: Number(r.mass_kg ?? 0),
  }))
  const countryMix =
    origins.length > 0 ? computeCountryMix(origins, factorByCountry) : null

  // V2-c — dependency declarations sub-score.
  type DepRow = {
    dependency_type: string
    materiality: Materiality
    notes: string | null
  }
  const depRows = ((valOrNull(natureDependencies) as any)?.data ?? []) as DepRow[]
  const depsSub = computeDependenciesSubScore(
    depRows.map(d => ({
      dependency_type: d.dependency_type,
      materiality: d.materiality,
      has_notes: typeof d.notes === 'string' && d.notes.trim().length > 0,
    })),
  )

  const natureBreakdown = computeNatureScore({
    per_unit_impacts: natureInputs.per_unit_impacts,
    yoy_total_pct: natureInputs.yoy_total_pct,
    effective_sq_m_per_unit: positiveInputs.effective_sq_m_per_unit,
    effective_hectares: positiveInputs.effective_hectares,
    country_biodiversity_multiplier: countryMix?.weighted_multiplier ?? null,
    country_mix: countryMix?.country_breakdown ?? null,
    dependencies_sub: depsSub,
    dependencies_declared_count: depRows.length,
  })

  // Org-level fallback inputs for the legacy water/circularity aggregator.
  const productType =
    ((valOrNull(orgRow) as any)?.data?.product_type as string | null) ??
    productRowsData[0]?.product_type ??
    null
  const productCategories = productRowsData.map(p => p.product_category ?? null)

  const signals = buildEnvironmentalSignals({
    lcas,
    productType,
    productCategories,
  })
  const inputs = toEnvironmentalInputs(signals)
  return {
    ...inputs,
    climate_breakdown: climateBreakdown,
    water_breakdown: waterBreakdown,
    circularity_breakdown: circularityBreakdown,
    nature_breakdown: natureBreakdown,
  }
}

async function buildSocialInputs(
  service: SupabaseClient,
  organizationId: string,
): Promise<Parameters<typeof computeSocialPillar>[0]> {
  // Community impact: compute LIVE from raw tables. Snapshot-based reads
  // went stale whenever an org added donations/volunteering after the
  // initial auto-calc on the community-impact page. Raw-data computation
  // mirrors the API route's POST-handler logic via the shared
  // calculateCommunityImpactScore helper.
  //
  // People-culture stays on the snapshot for now (the auto-recalc gap is
  // real for it too, but the calculation requires multi-table summary
  // building that's harder to extract). YoY for both still uses the
  // historical snapshots.
  const currentYearForSocial = new Date().getFullYear()
  const [
    communityRows,
    peopleRows,
    supplierTotals,
    supplierSubmitted,
    materialsTotal,
    materialsWithSupplier,
    supplierProductsTotal,
    supplierProductsWithCerts,
    attestationRows,
    rawDonations,
    rawVolunteering,
    rawLocalImpact,
    rawEngagements,
    rawStories,
  ] = await Promise.allSettled([
    service
      .from('community_impact_scores')
      .select('overall_score, calculated_at')
      .eq('organization_id', organizationId)
      .order('calculated_at', { ascending: false })
      .limit(2),
    service
      // NB: this table uses `calculation_date` while community_impact_scores
      // uses `calculated_at` — different historic conventions per migration.
      .from('people_culture_scores')
      .select('overall_score, calculation_date')
      .eq('organization_id', organizationId)
      .order('calculation_date', { ascending: false })
      .limit(2),
    service
      .from('suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    service
      .from('supplier_esg_assessments')
      .select('id, suppliers!inner(organization_id)', { count: 'exact', head: true })
      .eq('suppliers.organization_id', organizationId)
      .not('submitted_at', 'is', null),
    // Mapping coverage: total materials across the org's completed PCFs.
    service
      .from('product_carbon_footprint_materials')
      .select(
        'id, product_carbon_footprints!inner(organization_id, status)',
        { count: 'exact', head: true },
      )
      .eq('product_carbon_footprints.organization_id', organizationId)
      .eq('product_carbon_footprints.status', 'completed'),
    service
      .from('product_carbon_footprint_materials')
      .select(
        'id, product_carbon_footprints!inner(organization_id, status)',
        { count: 'exact', head: true },
      )
      .eq('product_carbon_footprints.organization_id', organizationId)
      .eq('product_carbon_footprints.status', 'completed')
      .not('supplier_id', 'is', null),
    // Certifications coverage: supplier-products owned by this org's suppliers.
    service
      .from('supplier_products')
      .select('id, suppliers!inner(organization_id)', { count: 'exact', head: true })
      .eq('suppliers.organization_id', organizationId),
    service
      .from('supplier_products')
      .select(
        'id, certifications, suppliers!inner(organization_id)',
        { count: 'exact', head: true },
      )
      .eq('suppliers.organization_id', organizationId)
      .not('certifications', 'eq', '{}'),
    service
      .from('supplier_responsibility_attestations')
      .select('attestation_type, is_attested')
      .eq('organization_id', organizationId)
      .eq('is_attested', true),
    // Raw community-impact data for live scoring (kills stale-snapshot bug).
    service
      .from('community_donations')
      .select('*')
      .eq('organization_id', organizationId),
    service
      .from('community_volunteer_activities')
      .select('*')
      .eq('organization_id', organizationId),
    service
      .from('community_local_impact')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('reporting_year', currentYearForSocial),
    service
      .from('community_engagements')
      .select('*')
      .eq('organization_id', organizationId),
    service
      .from('community_impact_stories')
      .select('*')
      .eq('organization_id', organizationId),
  ])

  const valOrNull = <T>(r: PromiseSettledResult<T>): T | null =>
    r.status === 'fulfilled' ? r.value : null

  // --- Workforce + Community ---
  const communityList = ((valOrNull(communityRows) as any)?.data ?? []) as Array<{
    overall_score: number | null
  }>
  const peopleList = ((valOrNull(peopleRows) as any)?.data ?? []) as Array<{
    overall_score: number | null
  }>

  // Community impact: compute LIVE from raw tables instead of trusting the
  // potentially-stale snapshot. Falls back to the snapshot if raw queries
  // failed for any reason.
  const donationsData = ((valOrNull(rawDonations) as any)?.data ?? []) as any[]
  const volunteeringData = ((valOrNull(rawVolunteering) as any)?.data ?? []) as any[]
  const localImpactRows = ((valOrNull(rawLocalImpact) as any)?.data ?? []) as any[]
  const engagementsData = ((valOrNull(rawEngagements) as any)?.data ?? []) as any[]
  const storiesData = ((valOrNull(rawStories) as any)?.data ?? []) as any[]
  const liveCommunity = calculateCommunityImpactScore({
    donations: donationsData,
    volunteering: volunteeringData,
    localImpact: localImpactRows[0] ?? null,
    engagements: engagementsData,
    stories: storiesData,
  })
  const hasAnyRawCommunityData =
    donationsData.length > 0 ||
    volunteeringData.length > 0 ||
    localImpactRows.length > 0 ||
    engagementsData.length > 0 ||
    storiesData.length > 0
  const community_score = hasAnyRawCommunityData
    ? liveCommunity.overall_score
    : numOrNull(communityList[0]?.overall_score)
  const people_culture_score = numOrNull(peopleList[0]?.overall_score)
  const community_score_prior = numOrNull(communityList[1]?.overall_score)
  const people_culture_score_prior = numOrNull(peopleList[1]?.overall_score)

  // --- Supplier responsibility sub-axes ---
  const supplierTotal = ((valOrNull(supplierTotals) as any)?.count ?? 0) as number
  const supplierSubmittedCount = ((valOrNull(supplierSubmitted) as any)?.count ?? 0) as number
  const supplier_esg_pct =
    supplierTotal > 0 ? Math.round((supplierSubmittedCount / supplierTotal) * 100) : null

  const materialsTotalCount = ((valOrNull(materialsTotal) as any)?.count ?? 0) as number
  const materialsWithSupplierCount = ((valOrNull(materialsWithSupplier) as any)?.count ?? 0) as number
  const mapping_coverage_pct =
    materialsTotalCount > 0
      ? Math.round((materialsWithSupplierCount / materialsTotalCount) * 100)
      : null

  const supplierProductsTotalCount = ((valOrNull(supplierProductsTotal) as any)?.count ?? 0) as number
  const supplierProductsWithCertsCount = ((valOrNull(supplierProductsWithCerts) as any)?.count ?? 0) as number
  const certifications_coverage_pct =
    supplierProductsTotalCount > 0
      ? Math.round((supplierProductsWithCertsCount / supplierProductsTotalCount) * 100)
      : null

  const attestationDataRaw = ((valOrNull(attestationRows) as any)?.data ?? []) as Array<{
    attestation_type: SupplierAttestationType
  }>
  const attestations_pct = computeAttestationsScore(
    attestationDataRaw.map(a => a.attestation_type),
  )

  const supplier_inputs: SupplierResponsibilityInputs = {
    mapping_coverage_pct,
    certifications_coverage_pct,
    attestations_pct,
    suppliers_with_esg_form: supplierSubmittedCount,
    suppliers_total: supplierTotal,
  }

  // --- YoY: change in blended workforce + community + supplier ---
  // Computed on workforce + community only (supplier YoY would require
  // attestation history we don't track yet — v2). When prior data is
  // available, blends them with the same weights.
  let yoy_total_pct: number | null = null
  if (people_culture_score_prior !== null || community_score_prior !== null) {
    const currentBlend =
      (people_culture_score ?? 0) * 0.5 + (community_score ?? 0) * 0.25
    const priorBlend =
      (people_culture_score_prior ?? 0) * 0.5 + (community_score_prior ?? 0) * 0.25
    if (priorBlend > 0) {
      // Social YoY semantics: positive delta = score went UP = good.
      yoy_total_pct = ((currentBlend - priorBlend) / priorBlend) * 100
    }
  }

  // --- Compute the breakdown ---
  const social_breakdown = computeSocialScore({
    workforce_score: people_culture_score,
    community_score,
    supplier_inputs,
    yoy_total_pct,
  })

  return {
    social_breakdown,
    community_score,
    people_culture_score,
    supplier_esg_pct,
  }
}

async function buildGovernanceInputs(
  service: SupabaseClient,
  organizationId: string,
): Promise<Parameters<typeof computeGovernancePillar>[0]> {
  // Pull the latest two governance score snapshots for YoY, plus the
  // 5-axis sub-scores for transparent breakdown. Certifications come
  // from organization_certifications with status + readiness_score.
  const [governanceRows, certsRow] = await Promise.allSettled([
    service
      .from('governance_scores')
      .select(
        'overall_score, policy_score, stakeholder_score, board_score, ethics_score, transparency_score, calculated_at',
      )
      .eq('organization_id', organizationId)
      .order('calculated_at', { ascending: false })
      .limit(2),
    service
      .from('organization_certifications')
      .select('status, readiness_score')
      .eq('organization_id', organizationId)
      .neq('status', 'expired'),
  ])

  const valOrNull = <T>(r: PromiseSettledResult<T>): T | null =>
    r.status === 'fulfilled' ? r.value : null

  // --- Governance practices (current + prior year for YoY) ---
  const govList = ((valOrNull(governanceRows) as any)?.data ?? []) as Array<{
    overall_score: number | null
    policy_score: number | null
    stakeholder_score: number | null
    board_score: number | null
    ethics_score: number | null
    transparency_score: number | null
  }>
  const governance_score = numOrNull(govList[0]?.overall_score)
  const governance_score_prior = numOrNull(govList[1]?.overall_score)
  const practices_breakdown = govList[0]
    ? {
        policy: numOrNull(govList[0].policy_score),
        stakeholder: numOrNull(govList[0].stakeholder_score),
        board: numOrNull(govList[0].board_score),
        ethics: numOrNull(govList[0].ethics_score),
        transparency: numOrNull(govList[0].transparency_score),
      }
    : null

  // --- Certifications (achieved vs in-progress split) ---
  const certRows = ((valOrNull(certsRow) as any)?.data ?? []) as Array<{
    status: string | null
    readiness_score: number | null
  }>
  let achieved_count = 0
  let in_progress_count = 0
  const inProgressReadiness: number[] = []
  for (const c of certRows) {
    if (c.status === 'certified') {
      achieved_count++
    } else if (c.status === 'in_progress' || c.status === 'ready') {
      in_progress_count++
      const r = Number(c.readiness_score ?? 0)
      if (Number.isFinite(r)) inProgressReadiness.push(r)
    }
  }
  const in_progress_avg_pct =
    inProgressReadiness.length > 0
      ? inProgressReadiness.reduce((a, b) => a + b, 0) / inProgressReadiness.length
      : null

  const certifications_inputs: CertificationsInputs | null =
    achieved_count + in_progress_count > 0
      ? {
          achieved_count,
          in_progress_count,
          in_progress_avg_pct,
        }
      : null

  // --- YoY ---
  let yoy_total_pct: number | null = null
  if (
    governance_score !== null &&
    governance_score_prior !== null &&
    governance_score_prior > 0
  ) {
    yoy_total_pct =
      ((governance_score - governance_score_prior) / governance_score_prior) * 100
  }

  // --- Compute the breakdown ---
  const governance_breakdown = computeGovernanceScore({
    practices_score: governance_score,
    practices_breakdown,
    certifications_inputs,
    yoy_total_pct,
  })

  // Legacy fields kept for unmigrated callers / fallback.
  const cert_progress_pct =
    certifications_inputs && certifications_inputs.in_progress_avg_pct !== null
      ? Math.round(certifications_inputs.in_progress_avg_pct)
      : null

  return {
    governance_breakdown,
    governance_score,
    cert_progress_pct,
  }
}

async function loadOrgWeights(
  service: SupabaseClient,
  organizationId: string,
): Promise<VitalityWeights> {
  try {
    const { data } = await service
      .from('organizations')
      .select('vitality_weights')
      .eq('id', organizationId)
      .maybeSingle()
    return normaliseWeights((data as any)?.vitality_weights ?? null)
  } catch {
    return normaliseWeights(null)
  }
}

async function curateRead(
  composite: VitalityComposite,
  trend: TrendPoint[],
): Promise<VitalityRead | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: buildVitalityReadSystemPrompt(),
      tools: [VITALITY_READ_TOOL],
      tool_choice: { type: 'tool', name: VITALITY_READ_TOOL.name },
      messages: [
        { role: 'user', content: formatVitalityForPrompt(composite, trend) },
      ],
    })
    const toolUse = response.content.find(c => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') return null
    const raw = toolUse.input as VitalityRead
    return {
      headline: clamp(raw.headline, 100),
      detail: clamp(raw.detail, 360),
      next_move: raw.next_move ? clamp(raw.next_move, 200) : null,
      confidence: ['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'medium',
    }
  } catch (err) {
    console.error('[vitality read] curator failed:', err)
    return null
  }
}

function fallbackRead(composite: VitalityComposite, trend: TrendPoint[]): VitalityRead {
  const delta = trendDelta(trend)
  const band = composite.band
  const directionLine =
    delta.delta_points === null
      ? 'Trend will fill out as you keep visiting; come back next week for movement.'
      : delta.delta_points > 0
        ? `Up ${delta.delta_points} points across the snapshot window.`
        : delta.delta_points < 0
          ? `Down ${Math.abs(delta.delta_points)} points across the snapshot window.`
          : 'Flat across the snapshot window.'
  return {
    headline:
      composite.composite === null
        ? 'Awaiting more data to call a score.'
        : `Your vitality is ${band.toLowerCase()}.`,
    detail:
      composite.composite === null
        ? 'Add LCAs, social impact data, or governance policies to unlock a composite score.'
        : `${BAND_DESCRIPTIONS[band]} ${directionLine}`,
    next_move:
      composite.composite === null
        ? 'Start with a single product LCA — that unlocks the environmental pillar fastest.'
        : null,
    confidence: 'medium',
  }
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function clamp(s: string, max: number): string {
  return String(s ?? '').trim().slice(0, max)
}

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if ('error' in ctx) return ctx.error
  const { organizationId, service } = ctx

  // ?read=1 — opt in to the Claude-curated narrative. Default skips it so
  // the Rosa hub hero loads in ~DB-time (a few hundred ms). The breakdown
  // modal opts in once the user clicks through to view the deeper read.
  const url = new URL(req.url)
  const wantsAiRead = url.searchParams.get('read') === '1'

  const [envInputs, socialInputs, govInputs, weights] = await Promise.all([
    buildEnvironmentalInputs(service, organizationId),
    buildSocialInputs(service, organizationId),
    buildGovernanceInputs(service, organizationId),
    loadOrgWeights(service, organizationId),
  ])

  const composite = composeVitality({
    e: computeEnvironmentalPillar(envInputs),
    s: computeSocialPillar(socialInputs),
    g: computeGovernancePillar(govInputs),
    weights,
  })

  // Run the snapshot write and the trend read in parallel — the trend
  // read can include yesterday's row even before today's write commits,
  // so this is safe and shaves a round-trip.
  const [, trend] = await Promise.all([
    upsertSnapshot(service, organizationId, composite),
    loadTrend(service, organizationId),
  ])
  const delta = trendDelta(trend)

  // Curate via Claude only when requested AND the user is under their
  // daily budget; otherwise the deterministic fallback gives a usable
  // headline instantly.
  let read: VitalityRead
  let source: ResponsePayload['source'] = 'fallback'
  if (wantsAiRead) {
    const overBudget = await isOverDailyBudget(
      service,
      organizationId,
      ctx.userId,
      'vitality.read.curated',
    )
    if (overBudget) {
      read = fallbackRead(composite, trend)
      await logRosaTelemetry(service, organizationId, ctx.userId, 'vitality.read.budget_blocked', {})
    } else {
      const ai = await curateRead(composite, trend)
      if (ai) {
        read = ai
        source = 'curator'
        await logRosaTelemetry(service, organizationId, ctx.userId, 'vitality.read.curated', {})
      } else {
        read = fallbackRead(composite, trend)
      }
    }
  } else {
    read = fallbackRead(composite, trend)
  }

  const payload: ResponsePayload = {
    composite,
    trend,
    trend_delta: delta,
    band_description: BAND_DESCRIPTIONS[composite.band],
    read,
    source,
    generated_at: new Date().toISOString(),
  }
  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
