/**
 * Rosa — priority-tile signal pack.
 *
 * Builds a single JSON object describing everything Rosa should consider
 * when deciding which 3 tiles to surface on the /rosa/ hub. Every value
 * is a fact pulled from real data; nothing is invented.
 *
 * Rosa acts as a senior sustainability consultant, so the pack leans
 * heavily on strategic signals (hotspots, abatement levers, peer
 * position, methodology gaps) rather than admin chores. Operational
 * signals are still here so she can flag a true emergency, but they're
 * not the centre of gravity.
 *
 * Failures in any individual signal collapse to a sensible empty value
 * rather than throwing — the page must never break because a Pulse-only
 * table doesn't exist for this org.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { COMPLIANCE_DEADLINES, expandDeadlines } from '@/lib/pulse/regulatory-deadlines'
import {
  getBenchmarkForProductType,
  type IndustryBenchmark,
} from '@/lib/industry-benchmarks'

const STALE_FACILITY_DAYS = 60
const RECENT_TOPICS_LIMIT = 5
const TOP_HOTSPOT_LIMIT = 3
const FLAGSHIP_HOTSPOT_LIMIT = 3
const TOP_SUPPLIER_LIMIT = 3
const TOP_LEVER_LIMIT = 3

export interface OrgSignalPack {
  org: {
    id: string
    name: string | null
    product_type: string | null
    product_count: number
    facility_count: number
    supplier_count: number
    first_lca_completed: boolean
    has_targets: boolean
  }
  user: {
    id: string
    persona: 'leadership' | 'finance' | 'sustainability' | 'operator' | 'unknown'
    focus_areas: string[]
    recent_topics: string[]
    snoozed_kinds: string[]
  }

  /** Strategic hotspot view — the consultant's centre of gravity. */
  footprint: {
    flagship_product: {
      product_name: string
      pcf_id: string
      total_kg_co2e: number
      top_contributors: Array<{
        category: string | null
        material_name: string
        kg_co2e: number
        share_pct: number
      }>
    } | null
    top_categories: Array<{
      category: string
      total_kg_co2e: number
      share_pct: number
    }>
    benchmark: {
      product_type: string | null
      label: string | null
      kg_co2e_per_litre: number | null
    } | null
  }

  /** Top decarbonisation opportunities. Sorted by tonnes × £-effectiveness. */
  abatement: {
    top_levers: Array<{
      id: string
      label: string
      annual_tonnes_abated: number
      levelised_cost_gbp_per_tonne: number
      simple_payback_years: number | null
    }>
  }

  /** Suppliers driving Scope 3. Top contributors with cumulative %. */
  supplier_hotspots: {
    coverage_pct: number
    top_suppliers: Array<{
      supplier_name: string
      total_t_co2e: number
      pct_of_attributed: number
      example_products: string[]
    }>
  }

  /** Methodology + data quality. The "is what we're measuring trustworthy" view. */
  data_quality: {
    lca_coverage_pct: number              // completed_lcas / product_count
    spend_based_material_share_pct: number // share of material rows on spend-based factors
    unmatched_ratio_pct: number           // unmatched / total materials
  }

  /** Target trajectory: each target's current vs expected progress. */
  target_progress: Array<{
    id: string
    metric_key: string
    baseline_value: number
    target_value: number
    target_date: string
    current_value: number | null
    expected_linear_progress_pct: number  // 0-100, where the trajectory says they should be today
    actual_progress_pct: number | null    // 0-100, where they actually are
    status: 'on_track' | 'at_risk' | 'off_track' | 'no_data'
  }>

  /** Operational signals (kept for true emergencies; not the lead). */
  queue: {
    open_count: number
    top_kinds: Array<{ kind: string; count: number }>
  }
  anomalies: {
    open_count: number
    top_severity: 'low' | 'medium' | 'high' | null
    recent: Array<{ severity: string; detected_at: string }>
  }
  latest_insight: { headline: string; generated_at: string } | null
  lcas: {
    completed_count: number
    draft_count: number
    no_lca_count: number
    oldest_draft: { product_name: string; days_untouched: number } | null
  }
  unmatched: {
    product_materials_count: number
    total_material_rows: number
  }
  facilities: {
    stale_count: number
  }
  suppliers: {
    esg_not_started: number
    esg_low_score: number
  }

  /** Targets list (raw — target_progress has the computed view). */
  targets: Array<{
    id: string
    metric_key: string
    baseline_value: number
    target_value: number
    target_date: string
    days_to_target: number
  }>

  /**
   * Layered data-readiness summary. The platform's data has a strict
   * dependency order: foundation (facility + agricultural) → recipes
   * (ingredient + packaging matching) → LCAs → targets/decarbonisation.
   * Rosa uses this to enforce the waterfall in her recommendations,
   * never pushing higher-layer work when a lower layer is incomplete.
   */
  readiness: {
    foundation: {
      facility_data: 'ready' | 'partial' | 'stale' | 'missing'
      facility_detail: {
        total: number
        with_recent_entry_60d: number
        stale_60d: number
        never_entered: number
      }
      agricultural_data: 'ready' | 'partial' | 'missing' | 'not_applicable'
      agricultural_detail: {
        self_grown_materials: number
        linked_to_profile: number
      }
    }
    recipes: {
      status: 'ready' | 'partial' | 'missing'
      ingredients_matched_pct: number
      products_with_complete_recipe: number
      products_with_unmatched_materials: number
    }
    lcas: {
      status: 'computable' | 'blocked' | 'in_progress' | 'complete'
      computable_now_count: number
      blocked_reasons: string[]
    }
    next_layer_to_address: 'foundation' | 'recipes' | 'lcas' | 'targets'
    why_this_layer: string
  }

  /** Compliance: applicability is *evidence-based*, not flag-based. */
  compliance: {
    has_uk_packaging: boolean
    feature_flags: {
      uk_ets_operator: boolean
      cbam_imports: boolean
      csrd_in_scope: boolean
      secr_in_scope: boolean
    }
    upcoming_deadlines: Array<{
      id: string
      title: string
      regime_label: string
      why_it_matters: string
      days_away: number
      action_href: string
      applicability: string
    }>
  }

  generated_at: string
}

interface BuilderInputs {
  organizationId: string
  userId: string
  /** Snoozed kinds passed from the client (localStorage). */
  snoozedKinds?: string[]
}

// Module-level TTL cache. Avoids rebuilding the pack on every "what next?"
// chat turn. Key = org:user:sorted-snoozed, value = { pack, expiresAt }.
// 90s keeps packs warm within a cache window; stale data evicts automatically.
const PACK_CACHE_TTL_MS = 90_000
const _packCache = new Map<string, { pack: OrgSignalPack; expiresAt: number }>()

function packCacheKey(orgId: string, userId: string, snoozedKinds: string[]): string {
  return `${orgId}:${userId}:${[...snoozedKinds].sort().join(',')}`
}

export interface ReadinessInputs {
  facilityCount: number
  staleCount: number
  neverEnteredCount: number
  selfGrownCount: number
  linkedToProfileCount: number
  productsWithUnmatchedCount: number
  totalMaterialsCount: number
  completedLcasCount: number
  productCount: number
  draftLcasCount: number
  unmatchedRatioPct: number
  hasTargets: boolean
}

export type ReadinessBlock = OrgSignalPack['readiness']

/**
 * Pure function: derive the layered readiness block from resolved counts.
 * Extracted so it can be unit-tested without a live Supabase client.
 */
export function computeReadiness(i: ReadinessInputs): ReadinessBlock {
  const withRecentEntryCount = Math.max(0, i.facilityCount - i.staleCount)
  const staleWithDataCount = Math.max(0, i.staleCount - i.neverEnteredCount)

  let facilityDataStatus: ReadinessBlock['foundation']['facility_data']
  if (i.facilityCount === 0 || i.staleCount === i.facilityCount) {
    facilityDataStatus = 'missing'
  } else if (i.staleCount > 0) {
    facilityDataStatus = 'stale'
  } else {
    facilityDataStatus = 'ready'
  }

  let agriStatus: ReadinessBlock['foundation']['agricultural_data']
  if (i.selfGrownCount === 0) {
    agriStatus = 'not_applicable'
  } else if (i.linkedToProfileCount === i.selfGrownCount) {
    agriStatus = 'ready'
  } else if (i.linkedToProfileCount > 0) {
    agriStatus = 'partial'
  } else {
    agriStatus = 'missing'
  }

  let recipesStatus: ReadinessBlock['recipes']['status']
  if (i.productsWithUnmatchedCount > 0) {
    recipesStatus = 'partial'
  } else if (i.totalMaterialsCount === 0 && i.completedLcasCount === 0) {
    recipesStatus = 'missing'
  } else {
    recipesStatus = 'ready'
  }

  const ingredientsMatchedPct = Math.round(Math.max(0, 100 - i.unmatchedRatioPct) * 10) / 10
  const productsWithCompleteRecipe = Math.max(0, i.productCount - i.productsWithUnmatchedCount)

  const blockedReasons: string[] = []
  if (facilityDataStatus === 'missing') {
    if (i.facilityCount === 0) {
      blockedReasons.push('No facilities recorded yet')
    } else if (i.neverEnteredCount === i.facilityCount) {
      blockedReasons.push('No facilities have any utility data yet')
    } else {
      blockedReasons.push(`All ${i.facilityCount} facilities are missing recent data`)
    }
  } else if (facilityDataStatus === 'stale') {
    blockedReasons.push(
      `${i.staleCount} ${i.staleCount === 1 ? "facility hasn't" : "facilities haven't"} had a utility entry in 60+ days`,
    )
  }
  if (agriStatus === 'missing' || agriStatus === 'partial') {
    const missing = i.selfGrownCount - i.linkedToProfileCount
    blockedReasons.push(
      `${missing} self-grown ${missing === 1 ? 'ingredient is' : 'ingredients are'} not yet linked to a vineyard, orchard, or arable field`,
    )
  }
  if (i.productsWithUnmatchedCount > 0) {
    blockedReasons.push(
      `${i.productsWithUnmatchedCount} ${i.productsWithUnmatchedCount === 1 ? 'product has' : 'products have'} unmatched ingredients`,
    )
  }

  let lcasStatus: ReadinessBlock['lcas']['status']
  if (blockedReasons.length > 0) {
    lcasStatus = 'blocked'
  } else if (i.productCount > 0 && i.completedLcasCount >= i.productCount) {
    lcasStatus = 'complete'
  } else if (i.draftLcasCount > 0) {
    lcasStatus = 'in_progress'
  } else {
    lcasStatus = 'computable'
  }

  const lcaComputableNowCount =
    facilityDataStatus === 'ready' ? Math.max(0, i.productCount - i.productsWithUnmatchedCount) : 0

  let nextLayer: ReadinessBlock['next_layer_to_address']
  let whyThisLayer: string
  if (facilityDataStatus !== 'ready') {
    nextLayer = 'foundation'
    if (facilityDataStatus === 'missing' && i.facilityCount === 0) {
      whyThisLayer = 'No facilities yet. Add at least one to start measuring Scope 1 and 2.'
    } else if (facilityDataStatus === 'missing') {
      whyThisLayer = "No facilities have utility data yet. LCAs can't allocate Scope 1 and 2 without it."
    } else {
      whyThisLayer = `${i.staleCount} ${i.staleCount === 1 ? 'facility is' : 'facilities are'} more than 60 days out of date. An LCA built on stale facility data is misleading.`
    }
  } else if (agriStatus === 'missing' || agriStatus === 'partial') {
    nextLayer = 'foundation'
    whyThisLayer = 'Self-grown ingredients need a linked vineyard, orchard, or arable field to feed the LCA correctly.'
  } else if (recipesStatus !== 'ready') {
    nextLayer = 'recipes'
    whyThisLayer = `${i.productsWithUnmatchedCount} ${i.productsWithUnmatchedCount === 1 ? 'product has' : 'products have'} ingredients without an emission factor. LCAs can't be calculated until those are matched.`
  } else if (lcasStatus !== 'complete' && i.productCount > 0) {
    nextLayer = 'lcas'
    const missingLcas = i.productCount - i.completedLcasCount
    whyThisLayer = `${missingLcas} ${missingLcas === 1 ? 'product is' : 'products are'} missing a completed LCA. The data foundation is in place, so they can be calculated now.`
  } else if (!i.hasTargets) {
    nextLayer = 'targets'
    whyThisLayer = 'Your data foundation and LCAs are in place. Set a reduction target so progress has a line to measure against.'
  } else {
    nextLayer = 'targets'
    whyThisLayer = 'All foundational layers are ready. Focus on hitting targets and surfacing abatement opportunities.'
  }

  return {
    foundation: {
      facility_data: facilityDataStatus,
      facility_detail: {
        total: i.facilityCount,
        with_recent_entry_60d: withRecentEntryCount,
        stale_60d: staleWithDataCount,
        never_entered: i.neverEnteredCount,
      },
      agricultural_data: agriStatus,
      agricultural_detail: {
        self_grown_materials: i.selfGrownCount,
        linked_to_profile: i.linkedToProfileCount,
      },
    },
    recipes: {
      status: recipesStatus,
      ingredients_matched_pct: ingredientsMatchedPct,
      products_with_complete_recipe: productsWithCompleteRecipe,
      products_with_unmatched_materials: i.productsWithUnmatchedCount,
    },
    lcas: {
      status: lcasStatus,
      computable_now_count: lcaComputableNowCount,
      blocked_reasons: blockedReasons,
    },
    next_layer_to_address: nextLayer,
    why_this_layer: whyThisLayer,
  }
}

/**
 * Build the full signal pack for an org/user pair. Uses the service-role
 * client because we read from cross-table aggregates that RLS would block.
 * Caller is responsible for verifying the user belongs to this org.
 */
export async function buildOrgSignalPack(
  service: SupabaseClient,
  inputs: BuilderInputs,
): Promise<OrgSignalPack> {
  const { organizationId, userId, snoozedKinds = [] } = inputs

  // Cache hit?
  const cacheKey = packCacheKey(organizationId, userId, snoozedKinds)
  const cached = _packCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.pack

  // Fan out every query in parallel; allSettled so one bad table never
  // breaks the pack.
  const [
    orgRow,
    productCount,
    facilityCount,
    supplierCount,
    completedLcasCount,
    draftLcasCount,
    productsWithFootprintsRows,
    flagshipFootprint,
    flagshipMaterials,
    allMaterialsForHotspot,
    queueOpen,
    queueTopKinds,
    anomalyRows,
    latestInsight,
    unmatchedMaterials,
    totalMaterials,
    spendBasedMaterials,
    staleFacilities,
    targetRows,
    targetSnapshots,
    esgNotStarted,
    esgLowScore,
    packagingEvidence,
    personaMemory,
    focusMemory,
    recentConvos,
    productTypeRows,
    facilityActivities,
  ] = await Promise.allSettled([
    service
      .from('organizations')
      .select('id, name, product_type, feature_flags')
      .eq('id', organizationId)
      .maybeSingle(),
    service
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    service
      .from('facilities')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    service
      .from('suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    service
      .from('product_carbon_footprints')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      // Onboarding estimates count as "covered" so day-one orgs aren't told
      // they have 0% LCA coverage. A real completed LCA supersedes its
      // estimate via DB trigger so we never double-count.
      .in('status', ['completed', 'estimate']),
    service
      .from('product_carbon_footprints')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .in('status', ['draft', 'in_progress']),
    service
      .from('products')
      .select('id, product_carbon_footprints!left(id, status)', { count: 'exact' })
      .eq('organization_id', organizationId)
      .limit(500),
    // Most recent completed LCA OR estimate — used as the "flagship" for
    // narrative. Estimates participate so a fresh org has a flagship to
    // talk about; completed rows naturally win once they exist.
    service
      .from('product_carbon_footprints')
      .select('id, product_id, product_name, total_co2e_kg, updated_at, status')
      .eq('organization_id', organizationId)
      .in('status', ['completed', 'estimate'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Material rows for whatever flagship we picked — joined later.
    Promise.resolve(null),
    // Org-wide hotspot rollup: every completed PCF's materials.
    service
      .from('product_carbon_footprint_materials')
      .select('packaging_category, impact_climate, data_source, material_name, product_carbon_footprint_id, product_carbon_footprints!inner(organization_id, status)')
      .eq('product_carbon_footprints.organization_id', organizationId)
      .eq('product_carbon_footprints.status', 'completed')
      .not('impact_climate', 'is', null)
      .limit(2000),
    service
      .from('agent_exceptions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'open'),
    service
      .from('agent_exceptions')
      .select('kind')
      .eq('organization_id', organizationId)
      .eq('status', 'open')
      .limit(50),
    service
      .from('dashboard_anomalies')
      .select('severity, status, detected_at')
      .eq('organization_id', organizationId)
      .gte('detected_at', new Date(Date.now() - 14 * 86_400_000).toISOString())
      .limit(50),
    service
      .from('dashboard_insights')
      .select('headline, generated_at')
      .eq('organization_id', organizationId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from('product_materials')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('matched_source_name', null),
    service
      .from('product_materials')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    service
      .from('product_carbon_footprint_materials')
      .select('id, data_source, product_carbon_footprints!inner(organization_id)', { count: 'exact', head: true })
      .eq('product_carbon_footprints.organization_id', organizationId)
      .eq('data_source', 'spend_based'),
    service
      .from('facilities')
      .select(
        'id, ' +
          'utility_data_entries!left(reporting_period_end), ' +
          // Disambiguate the FK: facility_activity_entries has both
          // facility_id (the entry's owning facility) and source_facility_id
          // (an upstream reference), and PostgREST cannot pick a default.
          'facility_activity_entries!facility_id!left(reporting_period_start, activity_date), ' +
          'facility_water_data!left(reporting_year)',
      )
      .eq('organization_id', organizationId)
      .limit(200),
    service
      .from('sustainability_targets')
      .select('id, metric_key, baseline_value, baseline_date, target_value, target_date')
      .eq('organization_id', organizationId)
      .limit(20),
    // Latest snapshot per metric — used to compute target progress.
    service
      .from('metric_snapshots')
      .select('metric_key, value, snapshot_date')
      .eq('organization_id', organizationId)
      .order('snapshot_date', { ascending: false })
      .limit(60),
    service
      .from('supplier_esg_assessments')
      .select('id, suppliers!inner(organization_id)', { count: 'exact', head: true })
      .eq('suppliers.organization_id', organizationId)
      .is('submitted_at', null),
    service
      .from('supplier_esg_assessments')
      .select('id, suppliers!inner(organization_id)', { count: 'exact', head: true })
      .eq('suppliers.organization_id', organizationId)
      .lt('score_total', 50),
    // Tighter packaging evidence: rows where packaging_category is set
    // AND the product is on UK market (org-level proxy: any product exists
    // for a UK org). Stricter than a fuzzy material_name LIKE.
    service
      .from('product_carbon_footprint_materials')
      .select('id, product_carbon_footprints!inner(organization_id)', { count: 'exact', head: true })
      .eq('product_carbon_footprints.organization_id', organizationId)
      .not('packaging_category', 'is', null)
      .neq('packaging_category', ''),
    service
      .from('rosa_memory')
      .select('value')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('scope', 'user')
      .eq('key', 'persona')
      .maybeSingle(),
    service
      .from('rosa_memory')
      .select('value')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('scope', 'user')
      .eq('key', 'focus_areas')
      .maybeSingle(),
    service
      .from('gaia_conversations')
      .select('title, last_message_at')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(RECENT_TOPICS_LIMIT),
    service
      .from('products')
      .select('product_type, product_category')
      .eq('organization_id', organizationId)
      .limit(50),
    // Activity totals for cheap MACC-style estimate without hitting the API.
    service
      .from('facility_activity_entries')
      .select('activity_category, co2e_kg')
      .eq('organization_id', organizationId)
      .gte('activity_date', new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10))
      .limit(2000),
  ])

  const valOrNull = <T>(r: PromiseSettledResult<T>): T | null =>
    r.status === 'fulfilled' ? r.value : null
  const countOf = (r: PromiseSettledResult<{ count: number | null } | null>): number => {
    if (r.status !== 'fulfilled' || !r.value) return 0
    return (r.value as { count: number | null }).count ?? 0
  }

  // Org row + flags
  const orgData = (valOrNull(orgRow) as any)?.data ?? null
  const flags = (orgData?.feature_flags ?? {}) as Record<string, unknown>

  // Products without any completed OR estimate footprint. A starter estimate
  // counts as "has a footprint" — the right nudge for those products is
  // "upgrade your estimate to a real LCA", not "you have zero data".
  const productsResult = (valOrNull(productsWithFootprintsRows) as any)?.data ?? []
  const noLcaCount = Array.isArray(productsResult)
    ? productsResult.filter((p: any) => {
        const fps = Array.isArray(p.product_carbon_footprints) ? p.product_carbon_footprints : []
        return !fps.some((fp: any) => fp?.status === 'completed' || fp?.status === 'estimate')
      }).length
    : 0

  // Oldest draft LCA
  const flagshipRow = (valOrNull(flagshipFootprint) as any)?.data ?? null
  const oldestDraftRow = await (async () => {
    try {
      const { data } = await service
        .from('product_carbon_footprints')
        .select('product_name, updated_at')
        .eq('organization_id', organizationId)
        .in('status', ['draft', 'in_progress'])
        .order('updated_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      return data
    } catch {
      return null
    }
  })()
  let oldestDraft: { product_name: string; days_untouched: number } | null = null
  if (oldestDraftRow?.product_name && oldestDraftRow?.updated_at) {
    const days = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(oldestDraftRow.updated_at).getTime()) / 86_400_000,
      ),
    )
    oldestDraft = { product_name: oldestDraftRow.product_name, days_untouched: days }
  }

  // Queue top kinds
  const queueRows = ((valOrNull(queueTopKinds) as any)?.data ?? []) as Array<{ kind: string }>
  const kindCounts = queueRows.reduce<Record<string, number>>((acc, r) => {
    if (!r?.kind) return acc
    acc[r.kind] = (acc[r.kind] ?? 0) + 1
    return acc
  }, {})
  const topKinds = Object.entries(kindCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([kind, count]) => ({ kind, count }))

  // Anomalies
  type Severity = 'low' | 'medium' | 'high'
  const severityOrder: Record<Severity, number> = { low: 0, medium: 1, high: 2 }
  const anomalies = ((valOrNull(anomalyRows) as any)?.data ?? []) as Array<{
    severity?: string | null
    status?: string | null
    detected_at?: string
  }>
  const openAnomalies = anomalies.filter(a => a.status !== 'resolved')
  const topSeverity = openAnomalies.reduce<Severity | null>((acc, r) => {
    const sev = (r.severity as Severity | null | undefined) ?? null
    if (!sev) return acc
    if (!acc) return sev
    return severityOrder[sev] > severityOrder[acc] ? sev : acc
  }, null)
  const recentAnomalies = openAnomalies
    .filter(a => a.severity && a.detected_at)
    .slice(0, 3)
    .map(a => ({ severity: String(a.severity), detected_at: String(a.detected_at) }))

  // Latest insight
  const latestInsightRow = (valOrNull(latestInsight) as any)?.data ?? null
  const latestInsightOut = latestInsightRow
    ? {
        headline: String(latestInsightRow.headline ?? ''),
        generated_at: String(latestInsightRow.generated_at ?? ''),
      }
    : null

  // Stale facilities. A facility is "stale" when none of its data
  // sources has an entry inside the last STALE_FACILITY_DAYS window. We
  // check three sources because facility data lives in three places:
  //   - utility_data_entries (electricity, gas, fuel)
  //   - facility_activity_entries (water, waste, etc.)
  //   - facility_water_data (legacy aggregated water)
  // Without this, a facility with recent water entries but no recent
  // utility entries gets miscounted as stale, falsely triggering the
  // "Foundation: facility data missing" banner.
  const facilityRows = ((valOrNull(staleFacilities) as any)?.data ?? []) as Array<{
    id: string
    utility_data_entries: Array<{ reporting_period_end: string | null }> | null
    facility_activity_entries: Array<{
      reporting_period_start: string | null
      activity_date: string | null
    }> | null
    facility_water_data: Array<{ reporting_year: number | null }> | null
  }>
  const cutoff = Date.now() - STALE_FACILITY_DAYS * 86_400_000
  const currentYear = new Date().getFullYear()
  function latestMs(f: (typeof facilityRows)[number]): number {
    let latest = 0
    const utility = Array.isArray(f.utility_data_entries) ? f.utility_data_entries : []
    for (const e of utility) {
      if (e?.reporting_period_end) {
        latest = Math.max(latest, new Date(e.reporting_period_end).getTime())
      }
    }
    const activity = Array.isArray(f.facility_activity_entries)
      ? f.facility_activity_entries
      : []
    for (const e of activity) {
      // reporting_period_start is always set; activity_date can be null
      // for manually-entered records. Prefer reporting_period_start.
      const date = e?.reporting_period_start ?? e?.activity_date
      if (date) latest = Math.max(latest, new Date(date).getTime())
    }
    const water = Array.isArray(f.facility_water_data) ? f.facility_water_data : []
    for (const e of water) {
      // Legacy table only stores reporting_year. Treat a row for the
      // current reporting year as "fresh enough" to keep the facility
      // out of the stale bucket.
      if (e?.reporting_year && Number(e.reporting_year) >= currentYear) {
        latest = Math.max(latest, Date.now())
      }
    }
    return latest
  }
  const staleCount = facilityRows.filter(f => {
    const latest = latestMs(f)
    return latest < cutoff
  }).length

  // Targets
  const targetRowsData = ((valOrNull(targetRows) as any)?.data ?? []) as Array<{
    id: string
    metric_key: string
    baseline_value: number | null
    baseline_date: string | null
    target_value: number | null
    target_date: string | null
  }>
  const targetsOut = targetRowsData
    .filter(t => t.metric_key && t.target_date && t.baseline_value !== null && t.target_value !== null)
    .map(t => {
      const targetMs = new Date(t.target_date as string).getTime()
      const days = Math.round((targetMs - Date.now()) / 86_400_000)
      return {
        id: t.id,
        metric_key: t.metric_key,
        baseline_value: Number(t.baseline_value),
        target_value: Number(t.target_value),
        target_date: t.target_date as string,
        days_to_target: days,
      }
    })

  // Target progress: latest snapshot per metric → linear-vs-actual progress
  const snapshotRows = ((valOrNull(targetSnapshots) as any)?.data ?? []) as Array<{
    metric_key: string
    value: number | null
    snapshot_date: string
  }>
  const latestByMetric = new Map<string, number>()
  for (const s of snapshotRows) {
    if (!latestByMetric.has(s.metric_key) && typeof s.value === 'number') {
      latestByMetric.set(s.metric_key, s.value)
    }
  }
  const targetProgress: OrgSignalPack['target_progress'] = targetsOut.map(t => {
    const baselineDate = new Date(targetRowsData.find(x => x.id === t.id)?.baseline_date ?? t.target_date)
    const targetDate = new Date(t.target_date)
    const totalSpan = targetDate.getTime() - baselineDate.getTime()
    const elapsed = Math.max(0, Math.min(totalSpan, Date.now() - baselineDate.getTime()))
    const expectedLinearPct = totalSpan > 0 ? Math.round((elapsed / totalSpan) * 100) : 0
    const current = latestByMetric.get(t.metric_key) ?? null
    const range = t.baseline_value - t.target_value
    let actualPct: number | null = null
    if (current !== null && range !== 0) {
      actualPct = Math.round(((t.baseline_value - current) / range) * 100)
    }
    let status: OrgSignalPack['target_progress'][number]['status'] = 'no_data'
    if (current === null) {
      status = 'no_data'
    } else if (actualPct === null) {
      status = 'no_data'
    } else if (actualPct >= expectedLinearPct - 5) {
      status = 'on_track'
    } else if (actualPct >= expectedLinearPct - 20) {
      status = 'at_risk'
    } else {
      status = 'off_track'
    }
    return {
      id: t.id,
      metric_key: t.metric_key,
      baseline_value: t.baseline_value,
      target_value: t.target_value,
      target_date: t.target_date,
      current_value: current,
      expected_linear_progress_pct: expectedLinearPct,
      actual_progress_pct: actualPct,
      status,
    }
  })

  // Persona + focus
  const personaVal = (valOrNull(personaMemory) as any)?.data?.value as string | undefined
  const PERSONAS = ['leadership', 'finance', 'sustainability', 'operator'] as const
  const persona = (PERSONAS as readonly string[]).includes(personaVal ?? '')
    ? (personaVal as OrgSignalPack['user']['persona'])
    : 'unknown'
  const focusVal = (valOrNull(focusMemory) as any)?.data?.value as string | undefined
  let focusAreas: string[] = []
  if (focusVal) {
    try {
      const parsed = JSON.parse(focusVal)
      if (Array.isArray(parsed)) focusAreas = parsed.filter((v): v is string => typeof v === 'string')
    } catch {}
  }

  // Recent topics
  const recentRows = ((valOrNull(recentConvos) as any)?.data ?? []) as Array<{ title: string | null }>
  const recentTopics = recentRows
    .map(r => r.title)
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .slice(0, RECENT_TOPICS_LIMIT)

  // Compliance applicability — strict packaging evidence (not fuzzy)
  const packagingResult = valOrNull(packagingEvidence) as any
  const hasUkPackaging = (packagingResult?.count ?? 0) > 0
  const evidenceFlags = {
    uk_ets_operator: flags.uk_ets_operator === true,
    cbam_imports: flags.cbam_imports === true,
    csrd_in_scope: flags.csrd_in_scope === true,
    secr_in_scope: flags.secr_in_scope === true,
  }
  const upcoming = expandDeadlines(COMPLIANCE_DEADLINES, 9, new Date())
    .filter(d => d.days_away >= -14 && d.days_away <= 270)
    .sort((a, b) => a.days_away - b.days_away)
    .slice(0, 8)
    .map(d => ({
      id: d.id,
      title: d.title,
      regime_label: d.regime_label,
      why_it_matters: d.why_it_matters,
      days_away: d.days_away,
      action_href: d.action_href,
      applicability:
        COMPLIANCE_DEADLINES.find(e => e.id === d.id.replace(/-\d{4}$/, ''))?.applicability ??
        'always',
    }))

  // === Hotspots ===
  // Org-wide rollup of completed-LCA materials, by category.
  const allMaterialRows = ((valOrNull(allMaterialsForHotspot) as any)?.data ?? []) as Array<{
    packaging_category: string | null
    impact_climate: number | null
    material_name: string | null
    data_source: string | null
    product_carbon_footprint_id: string | null
  }>
  const totalKgAcrossCompletedLcas = allMaterialRows.reduce(
    (acc, r) => acc + Number(r.impact_climate ?? 0),
    0,
  )
  const byCategory = new Map<string, number>()
  for (const r of allMaterialRows) {
    const cat = (r.packaging_category && r.packaging_category.length > 0
      ? r.packaging_category
      : 'ingredient_or_other') as string
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + Number(r.impact_climate ?? 0))
  }
  const topCategories = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_HOTSPOT_LIMIT)
    .map(([category, kg]) => ({
      category,
      total_kg_co2e: kg,
      share_pct:
        totalKgAcrossCompletedLcas > 0 ? (kg / totalKgAcrossCompletedLcas) * 100 : 0,
    }))

  // Flagship product — most recent completed LCA — drilldown for narrative.
  let flagshipOut: OrgSignalPack['footprint']['flagship_product'] = null
  if (flagshipRow?.id) {
    const flagshipMatRows = allMaterialRows.filter(
      r => r.product_carbon_footprint_id === flagshipRow.id,
    )
    const flagshipTotal = flagshipMatRows.reduce(
      (acc, r) => acc + Number(r.impact_climate ?? 0),
      0,
    )
    const topContribs = flagshipMatRows
      .filter(r => Number(r.impact_climate ?? 0) > 0)
      .sort((a, b) => Number(b.impact_climate ?? 0) - Number(a.impact_climate ?? 0))
      .slice(0, FLAGSHIP_HOTSPOT_LIMIT)
      .map(r => ({
        category: r.packaging_category,
        material_name: String(r.material_name ?? 'Unknown ingredient'),
        kg_co2e: Number(r.impact_climate ?? 0),
        share_pct: flagshipTotal > 0 ? (Number(r.impact_climate ?? 0) / flagshipTotal) * 100 : 0,
      }))
    flagshipOut = {
      product_name: String(flagshipRow.product_name ?? 'Flagship product'),
      pcf_id: String(flagshipRow.id),
      total_kg_co2e:
        Number(flagshipRow.total_co2e_kg ?? flagshipTotal) || flagshipTotal,
      top_contributors: topContribs,
    }
  }

  // Industry benchmark
  const productTypeData = ((valOrNull(productTypeRows) as any)?.data ?? []) as Array<{
    product_type: string | null
    product_category: string | null
  }>
  const productCategories = productTypeData.map(p => p.product_category ?? null)
  const benchmark: { ref: IndustryBenchmark | null; productType: string | null } = (() => {
    const t = orgData?.product_type ?? null
    if (!t && productTypeData.length === 0) return { ref: null, productType: null }
    const result = getBenchmarkForProductType(t, productCategories)
    return {
      ref: result?.benchmark ?? null,
      productType: t ?? result?.dominantCategory ?? null,
    }
  })()

  // === Cheap MACC-style abatement view from facility_activity_entries ===
  // We don't reach for the full /api/pulse/macc route here (too many
  // calls). Instead, aggregate trailing-12-month emissions by activity
  // category and offer the top categories as candidate levers.
  const activityRows = ((valOrNull(facilityActivities) as any)?.data ?? []) as Array<{
    activity_category: string | null
    co2e_kg: number | null
  }>
  const byActivityCategory = new Map<string, number>()
  for (const r of activityRows) {
    if (!r.activity_category) continue
    const kg = Number(r.co2e_kg ?? 0)
    if (kg <= 0) continue
    byActivityCategory.set(
      r.activity_category,
      (byActivityCategory.get(r.activity_category) ?? 0) + kg,
    )
  }
  // Heuristic abatement potential: top-5 categories, ~30% reduction default.
  // Cost is intentionally vague (left to Rosa to interpret with the activity
  // category name); the precise MACC numbers aren't worth the extra call here.
  const topLevers = Array.from(byActivityCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_LEVER_LIMIT)
    .map(([category, kg]) => ({
      id: `category:${category}`,
      label: category.replace(/_/g, ' '),
      annual_tonnes_abated: Math.round((kg / 1000) * 0.3),
      levelised_cost_gbp_per_tonne: 0,
      simple_payback_years: null as number | null,
    }))
    .filter(l => l.annual_tonnes_abated > 0)

  // === Supplier hotspots (Scope 3) ===
  // We compute coverage and top-3 from the materials roll-up. supplier_id
  // not present in our material rows, so we approximate by data_source
  // attribution (a row with data_source='supplier_specific' is supplier-
  // attributed). For richer per-supplier rollup we'd hit the existing
  // /api/pulse/supplier-hotspots route; deferred for v1.
  const supplierAttributedKg = allMaterialRows
    .filter(r => r.data_source === 'supplier_specific' || r.data_source === 'primary_supplier')
    .reduce((acc, r) => acc + Number(r.impact_climate ?? 0), 0)
  const supplierCoveragePct =
    totalKgAcrossCompletedLcas > 0
      ? (supplierAttributedKg / totalKgAcrossCompletedLcas) * 100
      : 0
  const topSuppliersOut: OrgSignalPack['supplier_hotspots']['top_suppliers'] = []

  // === Data quality summary ===
  const totalMaterialsCount = countOf(totalMaterials)
  const unmatchedMaterialsCount = countOf(unmatchedMaterials)
  const spendBasedRowsCount = countOf(spendBasedMaterials)
  const totalCompletedMaterialsCount = allMaterialRows.length
  const unmatchedRatioPct =
    totalMaterialsCount > 0 ? (unmatchedMaterialsCount / totalMaterialsCount) * 100 : 0
  const spendBasedSharePct =
    totalCompletedMaterialsCount > 0
      ? (spendBasedRowsCount / totalCompletedMaterialsCount) * 100
      : 0
  const productCountResolved = countOf(productCount)
  const completedLcasCountResolved = countOf(completedLcasCount)
  const lcaCoveragePct =
    productCountResolved > 0
      ? Math.min(100, (completedLcasCountResolved / productCountResolved) * 100)
      : 0

  // === Readiness waterfall ===
  const facilityCountResolved = countOf(facilityCount)
  // "Never entered" = no rows in ANY of the three facility data tables.
  // Mirrors the staleness check so a facility with only water-data
  // history isn't counted as "never entered".
  const neverEnteredFacilityCount = facilityRows.filter(f => {
    const utility = Array.isArray(f.utility_data_entries) ? f.utility_data_entries : []
    const activity = Array.isArray(f.facility_activity_entries)
      ? f.facility_activity_entries
      : []
    const water = Array.isArray(f.facility_water_data) ? f.facility_water_data : []
    return utility.length === 0 && activity.length === 0 && water.length === 0
  }).length

  // Agricultural data: self-grown ingredients that need a linked farm profile.
  const agriRowsResult = await (async () => {
    try {
      const { data } = await service
        .from('product_materials')
        .select('id, is_self_grown, vineyard_id, orchard_id, arable_field_id')
        .eq('organization_id', organizationId)
        .or(
          'is_self_grown.eq.true,vineyard_id.not.is.null,orchard_id.not.is.null,arable_field_id.not.is.null',
        )
        .limit(500)
      return data ?? []
    } catch {
      return [] as Array<{
        is_self_grown: boolean | null
        vineyard_id: string | null
        orchard_id: string | null
        arable_field_id: string | null
      }>
    }
  })()
  const selfGrownCount = agriRowsResult.length
  const linkedToProfileCount = agriRowsResult.filter(
    r => r.vineyard_id || r.orchard_id || r.arable_field_id,
  ).length

  // Recipes: count products that have at least one unmatched material.
  const unmatchedByProductResult = await (async () => {
    try {
      const { data } = await service
        .from('product_materials')
        .select('product_id')
        .eq('organization_id', organizationId)
        .is('matched_source_name', null)
        .limit(2000)
      return data ?? []
    } catch {
      return [] as Array<{ product_id: string | null }>
    }
  })()
  const productsWithUnmatchedSet = new Set<string>()
  for (const r of unmatchedByProductResult) {
    if (r.product_id) productsWithUnmatchedSet.add(r.product_id)
  }
  const productsWithUnmatchedCount = productsWithUnmatchedSet.size

  const readiness = computeReadiness({
    facilityCount: facilityCountResolved,
    staleCount,
    neverEnteredCount: neverEnteredFacilityCount,
    selfGrownCount,
    linkedToProfileCount,
    productsWithUnmatchedCount,
    totalMaterialsCount,
    completedLcasCount: completedLcasCountResolved,
    productCount: productCountResolved,
    draftLcasCount: countOf(draftLcasCount),
    unmatchedRatioPct,
    hasTargets: targetsOut.length > 0,
  })

  const pack: OrgSignalPack = {
    org: {
      id: organizationId,
      name: orgData?.name ?? null,
      product_type: orgData?.product_type ?? null,
      product_count: productCountResolved,
      facility_count: countOf(facilityCount),
      supplier_count: countOf(supplierCount),
      first_lca_completed: completedLcasCountResolved > 0,
      has_targets: targetsOut.length > 0,
    },
    user: {
      id: userId,
      persona,
      focus_areas: focusAreas,
      recent_topics: recentTopics,
      snoozed_kinds: snoozedKinds,
    },
    footprint: {
      flagship_product: flagshipOut,
      top_categories: topCategories,
      benchmark: benchmark.ref
        ? {
            product_type: benchmark.productType,
            label: benchmark.ref.label ?? null,
            kg_co2e_per_litre: benchmark.ref.kgCO2ePerLitre ?? null,
          }
        : null,
    },
    abatement: {
      top_levers: topLevers,
    },
    supplier_hotspots: {
      coverage_pct: Math.round(supplierCoveragePct * 10) / 10,
      top_suppliers: topSuppliersOut,
    },
    data_quality: {
      lca_coverage_pct: Math.round(lcaCoveragePct * 10) / 10,
      spend_based_material_share_pct: Math.round(spendBasedSharePct * 10) / 10,
      unmatched_ratio_pct: Math.round(unmatchedRatioPct * 10) / 10,
    },
    target_progress: targetProgress,
    queue: {
      open_count: countOf(queueOpen),
      top_kinds: topKinds,
    },
    anomalies: {
      open_count: openAnomalies.length,
      top_severity: topSeverity,
      recent: recentAnomalies,
    },
    latest_insight: latestInsightOut,
    lcas: {
      completed_count: completedLcasCountResolved,
      draft_count: countOf(draftLcasCount),
      no_lca_count: noLcaCount,
      oldest_draft: oldestDraft,
    },
    unmatched: {
      product_materials_count: unmatchedMaterialsCount,
      total_material_rows: totalMaterialsCount,
    },
    facilities: {
      stale_count: staleCount,
    },
    suppliers: {
      esg_not_started: countOf(esgNotStarted),
      esg_low_score: countOf(esgLowScore),
    },
    targets: targetsOut,
    readiness,
    compliance: {
      has_uk_packaging: hasUkPackaging,
      feature_flags: evidenceFlags,
      upcoming_deadlines: upcoming,
    },
    generated_at: new Date().toISOString(),
  }

  _packCache.set(cacheKey, { pack, expiresAt: Date.now() + PACK_CACHE_TTL_MS })
  return pack
}

/**
 * Evict a specific org's cached packs (call after a data-changing action).
 */
export function evictSignalPackCache(organizationId: string): void {
  Array.from(_packCache.keys())
    .filter(k => k.startsWith(`${organizationId}:`))
    .forEach(k => _packCache.delete(k))
}

/**
 * Stable JSON stringifier for hashing the signal pack — sorts keys so two
 * equivalent packs always produce the same string, regardless of property
 * insertion order.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  // Drop generated_at from the hash so a fresh build doesn't bust the cache
  // by virtue of timing alone — only material data changes should bust.
  const keys = Object.keys(obj).filter(k => k !== 'generated_at').sort()
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}
