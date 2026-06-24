/**
 * Rosa — priority-tile curator endpoint.
 *
 * GET /api/rosa/priority-tiles?fresh=1&snoozed=queue,deadline
 *
 * Builds a signal pack for the calling user's org, asks Gemini to pick up
 * to three tiles via forced function-calling, validates the output, caches
 * per (org, user), and returns. On any failure the route returns a
 * deterministic fallback computed from the same signals so the page
 * always renders.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { FunctionCallingMode } from '@google/generative-ai'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { rateLimit } from '@/lib/rate-limit'
import { buildOrgSignalPack, stableStringify, type OrgSignalPack } from '@/lib/rosa/priority-signals'
import {
  buildCuratorSystemPrompt,
  formatSignalPackForPrompt,
  SET_PRIORITY_TILES_TOOL,
} from '@/lib/rosa/priority-tiles-prompt'
import {
  validateCuratedTiles,
  type CuratedTile,
} from '@/lib/rosa/priority-tiles-validate'
import {
  getGeminiClient,
  toGeminiFunctionDeclarations,
  GEMINI_ROSA_MODEL,
} from '@/lib/ai/gemini'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_OUTPUT_TOKENS = 1500
// Soft-stale window: a cached row older than this is still served INSTANTLY,
// but flagged `stale` so the client kicks off a background ?fresh=1&auto=1
// upgrade. Freshness bound for signals NOT in the client's realtime watch list
// (watched-table changes upgrade immediately via a tick).
const STALE_SOFT_MS = 5 * 60 * 1000
const DAILY_BUDGET_PER_USER = 50

interface ReadinessSummary {
  next_layer: 'foundation' | 'recipes' | 'lcas' | 'targets'
  facility_data: string
  recipes_status: string
  why: string
}

interface ResponsePayload {
  tiles: CuratedTile[]
  source: 'cache' | 'curator' | 'fallback'
  generated_at: string
  signals_hash: string
  // True when the client should kick off a background ?fresh=1&auto=1 to
  // upgrade what it just rendered (cache older than STALE_SOFT_MS, or an
  // uncurated deterministic fallback).
  stale: boolean
  readiness?: ReadinessSummary
  drops?: Array<{ index: number; reason: string }>
}

async function logTelemetry(
  service: SupabaseClient,
  organizationId: string,
  userId: string | null,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await service.from('rosa_telemetry').insert({
      organization_id: organizationId,
      user_id: userId,
      event,
      payload,
    })
  } catch {
    // Telemetry is best-effort; never block the user on it.
  }
}

async function curationsToday(
  service: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<number> {
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  try {
    const { count } = await service
      .from('rosa_telemetry')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('event', 'tile.curated')
      .gte('created_at', since.toISOString())
    return count ?? 0
  } catch {
    return 0
  }
}

function hashSignalPack(pack: OrgSignalPack): string {
  return createHash('sha256').update(stableStringify(pack)).digest('hex')
}

/**
 * Deterministic fallback when the curator can't run (no API key, network
 * error, validation drops too many tiles, daily budget exhausted, etc).
 * Picks the most actionable items from the signal pack using simple
 * priority rules — same shape as a curated tile.
 */
function fallbackTiles(
  pack: OrgSignalPack,
  organizationId: string,
  userId: string,
): CuratedTile[] {
  const baseId = (kind: string) =>
    `${organizationId.slice(0, 8)}:${userId.slice(0, 8)}:fallback_${kind}`

  const tiles: CuratedTile[] = []
  const foundationReady =
    pack.readiness.foundation.facility_data === 'ready' &&
    pack.readiness.foundation.agricultural_data !== 'missing' &&
    pack.readiness.foundation.agricultural_data !== 'partial'
  const recipesReady = pack.readiness.recipes.status === 'ready'

  // ───── Foundation layer (top of the waterfall) ─────
  // Stale / missing facility data. Always leads when foundation is broken.
  if (pack.facilities.stale_count > 0) {
    const n = pack.facilities.stale_count
    tiles.push({
      id: baseId('stale_facility'),
      kind: 'stale_facility',
      value: String(n),
      unit: n === 1 ? 'facility' : 'facilities',
      title: 'Facility data is out of date',
      hint: `${n === 1 ? 'A facility hasn\'t' : `${n} facilities haven\'t`} had a utility entry in 60+ days. LCAs built on this would be misleading.`,
      recommendation: 'Drop in a recent bill or reading and I\'ll classify it. This unblocks every LCA downstream.',
      icon: 'Factory',
      href: '/company/facilities',
      tone: 'urgent',
      signal_basis: ['facilities.stale_count', 'readiness.foundation.facility_data'],
    })
  }

  // Agricultural data: self-grown ingredients without a linked farm.
  const agriDetail = pack.readiness.foundation.agricultural_detail
  if (
    (pack.readiness.foundation.agricultural_data === 'missing' ||
      pack.readiness.foundation.agricultural_data === 'partial') &&
    agriDetail.self_grown_materials > 0
  ) {
    const missing = agriDetail.self_grown_materials - agriDetail.linked_to_profile
    tiles.push({
      id: baseId('agricultural_gap'),
      kind: 'agricultural_gap',
      value: String(missing),
      unit: missing === 1 ? 'ingredient' : 'ingredients',
      title: 'Self-grown ingredients need a farm linked',
      hint: `${missing} ${missing === 1 ? 'ingredient is' : 'ingredients are'} flagged as self-grown but not yet linked to a vineyard, orchard, or arable field.`,
      recommendation: 'Open the recipe and link each one. The growing profile feeds the LCA correctly.',
      icon: 'Leaf',
      href: '/products',
      tone: 'warn',
      signal_basis: [
        'readiness.foundation.agricultural_data',
        'readiness.foundation.agricultural_detail',
      ],
    })
  }

  // ───── Recipes layer ─────
  // Unmatched ingredients block LCA calculation. Always surface when present.
  if (pack.unmatched.product_materials_count > 0) {
    const n = pack.unmatched.product_materials_count
    const productsAffected = pack.readiness.recipes.products_with_unmatched_materials
    tiles.push({
      id: baseId('unmatched'),
      kind: 'unmatched_factor',
      value: String(n),
      unit: n === 1 ? 'ingredient' : 'ingredients',
      title: 'No emission factor matched',
      hint: `${n} ${n === 1 ? 'ingredient' : 'ingredients'} across ${productsAffected} ${productsAffected === 1 ? 'product' : 'products'} can\'t be costed without a factor.`,
      recommendation: 'Open the product recipe and pick a proxy where the exact match isn\'t there.',
      icon: 'Beaker',
      href: '/products',
      tone: 'warn',
      signal_basis: [
        'unmatched.product_materials_count',
        'readiness.recipes.status',
      ],
    })
  }

  // ───── Anomalies + Queue (urgent operational, surface alongside) ─────
  if (pack.anomalies.open_count > 0) {
    const n = pack.anomalies.open_count
    tiles.push({
      id: baseId('anomalies'),
      kind: 'anomaly',
      value: String(n),
      unit: n === 1 ? 'anomaly' : 'anomalies',
      title: 'Flagged for review',
      hint: 'Unusual values I noticed in your latest data.',
      recommendation:
        'I\'d look at the highest-severity one first. Often a metering glitch, sometimes a real spike.',
      icon: 'AlertCircle',
      href: '/pulse/',
      tone: pack.anomalies.top_severity === 'high' ? 'urgent' : 'warn',
      signal_basis: ['anomalies.open_count', 'anomalies.top_severity'],
    })
  }

  if (pack.queue.open_count > 0) {
    const n = pack.queue.open_count
    tiles.push({
      id: baseId('queue'),
      kind: 'queue',
      value: String(n),
      unit: n === 1 ? 'item' : 'items',
      title: 'Waiting your sign-off',
      hint: `${n === 1 ? 'A document is' : `${n} documents are`} parsed and ready for review.`,
      recommendation:
        n >= 5
          ? 'If I were you I\'d batch the bills first; they\'re the fastest to clear.'
          : 'Quick wins. A minute or two each.',
      icon: 'Inbox',
      href: '/admin/approvals/',
      tone: 'urgent',
      signal_basis: ['queue.open_count'],
    })
  }

  // ───── LCAs layer ─────
  // Only surface LCA work when foundation + recipes are ready.
  // Otherwise pushing LCAs would put the cart before the horse.
  if (foundationReady && recipesReady) {
    if (pack.lcas.oldest_draft) {
      const d = pack.lcas.oldest_draft
      tiles.push({
        id: baseId('lca_draft'),
        kind: 'lca_draft',
        value: '1',
        unit: 'next step',
        title: `Finish the LCA for ${d.product_name}`,
        hint: `Untouched for ${d.days_untouched} ${d.days_untouched === 1 ? 'day' : 'days'}. Best move to make progress this week.`,
        recommendation: 'Don\'t over-think it; this unblocks the next thing.',
        icon: 'ArrowUpRight',
        href: '/products',
        tone: 'good',
        signal_basis: ['lcas.oldest_draft', 'readiness.lcas.status'],
      })
    } else if (pack.lcas.no_lca_count > 0) {
      const n = pack.lcas.no_lca_count
      tiles.push({
        id: baseId('lcas_missing'),
        kind: 'lcas',
        value: String(n),
        unit: n === 1 ? 'product' : 'products',
        title: n === 1 ? 'Needs an LCA' : 'Need an LCA',
        hint: 'Your data foundation is ready, so these can be calculated now.',
        recommendation:
          n >= 5
            ? 'Pick the highest-volume product first; it\'ll move the headline number most.'
            : 'Start with the one you talk about most in marketing.',
        icon: 'Package',
        href: '/products/?filter=no-lca',
        tone: 'info',
        signal_basis: ['lcas.no_lca_count', 'readiness.lcas.status'],
      })
    }
  }

  // Compliance: only fire deadlines that are likely applicable.
  const flags = pack.compliance.feature_flags
  const applicableDeadline = pack.compliance.upcoming_deadlines.find(d => {
    if (d.applicability === 'always') {
      // Default-on regimes (EPR / Plastic Tax) require packaging evidence
      // for the fallback to be safe.
      return pack.compliance.has_uk_packaging
    }
    if (d.applicability === 'flag:uk_ets_operator') return flags.uk_ets_operator
    if (d.applicability === 'flag:cbam_imports') return flags.cbam_imports
    if (d.applicability === 'flag:csrd_in_scope') return flags.csrd_in_scope
    if (d.applicability === 'flag:secr_in_scope') return flags.secr_in_scope
    return false
  })
  if (applicableDeadline && tiles.length < 3) {
    const d = applicableDeadline
    const days = d.days_away
    tiles.push({
      id: baseId('deadline'),
      kind: 'deadline',
      value: days <= 0 ? 'overdue' : String(days),
      unit: days <= 0 ? null : days === 1 ? 'day' : 'days',
      title: d.title,
      hint: d.why_it_matters,
      recommendation:
        days <= 0
          ? 'It\'s past the line. File a partial today.'
          : days <= 7
            ? 'Block out an hour and walk through the gaps with me.'
            : 'No urgency. Worth a 15-minute scan now to spot blockers early.',
      icon: 'CalendarClock',
      href: d.action_href,
      tone: days <= 7 ? 'urgent' : days <= 14 ? 'warn' : 'info',
      signal_basis: ['compliance.upcoming_deadlines'],
    })
  }

  // No targets set yet — only recommend when there's an LCA baseline to
  // measure against. Setting a target without a footprint is premature.
  const lcasUsable =
    pack.readiness.lcas.status === 'complete' || pack.readiness.lcas.status === 'in_progress'
  if (!pack.org.has_targets && lcasUsable && tiles.length < 3) {
    tiles.push({
      id: baseId('no_targets'),
      kind: 'no_targets',
      value: '0',
      unit: 'targets set',
      title: 'No reduction targets defined',
      hint: 'Without a target, there\'s no line to measure progress against — or to report to stakeholders.',
      recommendation:
        `With ${Math.round(pack.data_quality.lca_coverage_pct)}% LCA coverage, you have enough data to set a credible baseline. Head to Pulse Targets.`,
      icon: 'Target',
      href: '/pulse/targets/',
      tone: 'info',
      signal_basis: ['org.has_targets', 'data_quality.lca_coverage_pct', 'readiness.lcas.status'],
    })
  }

  // Low supplier ESG coverage
  if (pack.supplier_hotspots.coverage_pct < 50 && pack.org.supplier_count > 0 && tiles.length < 3) {
    tiles.push({
      id: baseId('supplier_esg'),
      kind: 'supplier_esg',
      value: `${Math.round(pack.supplier_hotspots.coverage_pct)}%`,
      unit: 'suppliers with ESG data',
      title: 'Supplier footprint is a blind spot',
      hint: 'Scope 3 from your supply chain is estimated, not measured. Getting suppliers to submit real data closes the gap.',
      recommendation: 'Send the ESG questionnaire to your top suppliers — it takes them under 10 minutes.',
      icon: 'Truck',
      href: '/suppliers/',
      tone: 'warn',
      signal_basis: ['supplier_hotspots.coverage_pct', 'org.supplier_count'],
    })
  }

  // Explore Pulse — last-resort filler so there are always 3 tiles
  if (tiles.length < 3) {
    tiles.push({
      id: baseId('explore_pulse'),
      kind: 'explore_pulse',
      value: `${Math.round(pack.data_quality.lca_coverage_pct)}%`,
      unit: 'LCA coverage',
      title: 'Review your emissions breakdown',
      hint: 'Your Pulse dashboard shows hotspots, anomalies, and the levers with the most abatement potential.',
      recommendation: 'Open Pulse and look at the top emission categories — that\'s where the reduction opportunities sit.',
      icon: 'TrendingDown',
      href: '/pulse/',
      tone: 'info',
      signal_basis: ['data_quality.lca_coverage_pct'],
    })
  }

  return tiles.slice(0, 3)
}

/**
 * Call Gemini with the curator prompt + signal pack. Returns the raw
 * function-call args (or null if the call fails / the model doesn't call
 * the function).
 */
async function curateWithGemini(pack: OrgSignalPack): Promise<unknown | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  try {
    const client = getGeminiClient(apiKey)
    const model = client.getGenerativeModel({
      model: GEMINI_ROSA_MODEL,
      systemInstruction: buildCuratorSystemPrompt(),
      tools: toGeminiFunctionDeclarations([SET_PRIORITY_TILES_TOOL]),
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingMode.ANY,
          allowedFunctionNames: [SET_PRIORITY_TILES_TOOL.name],
        },
      },
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
    })

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: formatSignalPackForPrompt(pack) }],
        },
      ],
    })

    for (const cand of result.response.candidates ?? []) {
      for (const part of cand.content?.parts ?? []) {
        if ((part as any).functionCall?.name === SET_PRIORITY_TILES_TOOL.name) {
          return (part as any).functionCall.args ?? null
        }
      }
    }
    return null
  } catch (err) {
    console.error('[priority-tiles] curator call failed:', err)
    return null
  }
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { error: NextResponse.json({ error: 'Service role missing' }, { status: 500 }) }
  }
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  // Member OR active advisor for the caller's selected org. Honours advisor
  // reads and respects the org the user switched into (app/user metadata).
  const organizationId = await resolveAccessibleOrg(service, user)
  if (!organizationId) {
    return { error: NextResponse.json({ error: 'No organisation' }, { status: 403 }) }
  }
  return {
    userId: user.id,
    organizationId,
    service,
  }
}

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if ('error' in ctx) return ctx.error
  const { userId, organizationId, service } = ctx

  const rl = await rateLimit(`rosa-priority-tiles:${userId}`, 30, 60_000)
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait a moment and try again.' }, { status: 429 })
  }

  const url = new URL(req.url)
  const fresh = url.searchParams.get('fresh') === '1'
  // `auto` marks a background upgrade (mount-if-stale / realtime tick) vs a
  // user-forced Re-pick. Auto upgrades respect the daily Gemini budget; a
  // user-forced fresh bypasses it (as before).
  const isAuto = url.searchParams.get('auto') === '1'
  const dump = url.searchParams.get('dump') === '1'
  const snoozedRaw = url.searchParams.get('snoozed') ?? ''
  const snoozedKinds = snoozedRaw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 16)

  // ── INSTANT READ PATH ──────────────────────────────────────────────────
  // Serve cached tiles immediately WITHOUT building the ~31-query signal pack
  // or calling Gemini. The client renders this instantly, then if `stale`
  // issues a background ?fresh=1&auto=1. We drop the signals-hash gate here on
  // purpose (computing it needs the pack, which defeats the point); freshness
  // is bounded by STALE_SOFT_MS plus the client's realtime-tick upgrades.
  if (!fresh && !dump) {
    try {
      const { data: cached } = await service
        .from('rosa_priority_tile_cache')
        .select('tiles_json, readiness_json, signals_hash, generated_at')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle()
      // Only short-circuit once readiness_json is populated; a legacy row
      // (null readiness_json) falls through to a rebuild that upgrades it.
      if (cached && cached.tiles_json && cached.readiness_json) {
        const ageMs = Date.now() - new Date(cached.generated_at).getTime()
        const payload: ResponsePayload = {
          tiles: cached.tiles_json as CuratedTile[],
          source: 'cache',
          generated_at: cached.generated_at,
          signals_hash: (cached.signals_hash as string) ?? '',
          stale: ageMs > STALE_SOFT_MS,
          readiness: cached.readiness_json as ReadinessSummary,
        }
        return NextResponse.json(payload, {
          headers: { 'Cache-Control': 'no-store' },
        })
      }
    } catch (err) {
      // Cache table/column may not exist yet (migration not run). Continue.
      console.warn('[priority-tiles] cache lookup failed:', err)
    }
  }

  // ── BUILD PATH ─────────────────────────────────────────────────────────
  // Reached on ?fresh=1, ?dump=1, a cold cache, or a legacy row missing
  // readiness_json. Build the signal pack once.
  const pack = await buildOrgSignalPack(service, {
    organizationId,
    userId,
    snoozedKinds,
  })
  const signalsHash = hashSignalPack(pack)

  // Debug: ?dump=1 returns the raw pack without calling Gemini.
  if (dump) {
    return NextResponse.json({ pack, signals_hash: signalsHash })
  }

  const readiness: ReadinessSummary = {
    next_layer: pack.readiness.next_layer_to_address,
    facility_data: pack.readiness.foundation.facility_data,
    recipes_status: pack.readiness.recipes.status,
    why: pack.readiness.why_this_layer,
  }

  // Shared cache writer (tiles + readiness + hash).
  const writeCache = async (tilesToCache: CuratedTile[]) => {
    try {
      await service.from('rosa_priority_tile_cache').upsert(
        {
          organization_id: organizationId,
          user_id: userId,
          tiles_json: tilesToCache,
          readiness_json: readiness,
          signals_hash: signalsHash,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,user_id' },
      )
    } catch (err) {
      console.warn('[priority-tiles] cache write failed:', err)
    }
  }

  // Non-fresh build (cold cache / legacy row): return the deterministic
  // fallback INSTANTLY and seed the cache. No Gemini here — the client follows
  // up with a background ?fresh=1&auto=1 to curate.
  if (!fresh) {
    const tiles = fallbackTiles(pack, organizationId, userId)
    await writeCache(tiles)
    await logTelemetry(service, organizationId, userId, 'tile.fallback', {
      reason: 'cold_cache_seed',
      next_layer_to_address: pack.readiness.next_layer_to_address,
    })
    const payload: ResponsePayload = {
      tiles,
      source: 'fallback',
      generated_at: new Date().toISOString(),
      signals_hash: signalsHash,
      stale: true,
      readiness,
    }
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  // ── FRESH (CURATION) PATH ──────────────────────────────────────────────
  // Auto upgrades respect the daily budget → over budget returns the fallback
  // without calling Gemini (and without clobbering an existing curated cache).
  if (isAuto) {
    const usedToday = await curationsToday(service, organizationId, userId)
    if (usedToday >= DAILY_BUDGET_PER_USER) {
      const tiles = fallbackTiles(pack, organizationId, userId)
      await logTelemetry(service, organizationId, userId, 'tile.fallback', {
        reason: 'daily_budget_exceeded',
        used_today: usedToday,
      })
      const payload: ResponsePayload = {
        tiles,
        source: 'fallback',
        generated_at: new Date().toISOString(),
        signals_hash: signalsHash,
        stale: false,
        readiness,
      }
      return NextResponse.json(payload, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }
  }

  // Curate via Gemini.
  const rawCurated = await curateWithGemini(pack)
  let tiles: CuratedTile[] = []
  let drops: Array<{ index: number; reason: string }> = []
  let source: ResponsePayload['source'] = 'curator'

  if (rawCurated) {
    const v = validateCuratedTiles(rawCurated, {
      organizationId,
      userId,
      signalPack: pack,
    })
    tiles = v.tiles
    drops = v.drops
  }

  // If validation left us with nothing, fall back deterministically.
  const nextLayer = pack.readiness.next_layer_to_address

  if (tiles.length === 0) {
    tiles = fallbackTiles(pack, organizationId, userId)
    source = 'fallback'
    await logTelemetry(service, organizationId, userId, 'tile.fallback', {
      reason: rawCurated ? 'validation_empty' : 'curator_unavailable',
      drops,
      next_layer_to_address: nextLayer,
    })
  } else {
    await logTelemetry(service, organizationId, userId, 'tile.curated', {
      tile_count: tiles.length,
      drops,
      source: isAuto ? 'auto' : 'manual_refresh',
      kinds: tiles.map(t => t.kind),
      next_layer_to_address: nextLayer,
    })
  }

  await writeCache(tiles)

  const payload: ResponsePayload = {
    tiles,
    source,
    generated_at: new Date().toISOString(),
    signals_hash: signalsHash,
    stale: false,
    readiness,
    drops: drops.length > 0 ? drops : undefined,
  }
  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
