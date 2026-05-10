/**
 * Rosa — priority-tile curator endpoint.
 *
 * GET /api/rosa/priority-tiles?fresh=1&snoozed=queue,deadline
 *
 * Builds a signal pack for the calling user's org, asks Claude to pick up
 * to three tiles via forced tool_use, validates the output, caches per
 * (org, user), and returns. On any failure the route returns a
 * deterministic fallback computed from the same signals so the page
 * always renders.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
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

export const runtime = 'nodejs'
export const maxDuration = 30

const MODEL = 'claude-sonnet-4-6'
const MAX_OUTPUT_TOKENS = 1500
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const DAILY_BUDGET_PER_USER = 50

interface ResponsePayload {
  tiles: CuratedTile[]
  source: 'cache' | 'curator' | 'fallback'
  generated_at: string
  signals_hash: string
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

  // Queue items
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

  // High-severity anomalies
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

  // Oldest draft LCA
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
      signal_basis: ['lcas.oldest_draft'],
    })
  } else if (pack.lcas.no_lca_count > 0) {
    const n = pack.lcas.no_lca_count
    tiles.push({
      id: baseId('lcas_missing'),
      kind: 'lcas',
      value: String(n),
      unit: n === 1 ? 'product' : 'products',
      title: n === 1 ? 'Needs an LCA' : 'Need an LCA',
      hint: 'Cradle-to-grave footprints unlock claims and reporting.',
      recommendation:
        n >= 5
          ? 'Pick the highest-volume product first; it\'ll move the headline number most.'
          : 'Start with the one you talk about most in marketing.',
      icon: 'Package',
      href: '/products/?filter=no-lca',
      tone: 'info',
      signal_basis: ['lcas.no_lca_count'],
    })
  }

  // Unmatched ingredients
  if (pack.unmatched.product_materials_count > 0 && tiles.length < 3) {
    const n = pack.unmatched.product_materials_count
    tiles.push({
      id: baseId('unmatched'),
      kind: 'unmatched_factor',
      value: String(n),
      unit: n === 1 ? 'ingredient' : 'ingredients',
      title: 'No emission factor matched',
      hint: 'Ingredients without a factor don\'t count toward the footprint.',
      recommendation: 'Open the product recipe and pick a proxy where the exact match isn\'t there.',
      icon: 'Beaker',
      href: '/products',
      tone: 'warn',
      signal_basis: ['unmatched.product_materials_count'],
    })
  }

  // Stale facilities
  if (pack.facilities.stale_count > 0 && tiles.length < 3) {
    const n = pack.facilities.stale_count
    tiles.push({
      id: baseId('stale_facility'),
      kind: 'stale_facility',
      value: String(n),
      unit: n === 1 ? 'facility' : 'facilities',
      title: 'Stale facility data',
      hint: `${n === 1 ? 'A facility hasn\'t' : `${n} facilities haven\'t`} had a utility entry in 60+ days.`,
      recommendation: 'Drop in a recent bill or reading and I\'ll classify it.',
      icon: 'Factory',
      href: '/company/facilities',
      tone: 'warn',
      signal_basis: ['facilities.stale_count'],
    })
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

  // All clear
  if (tiles.length === 0) {
    tiles.push({
      id: baseId('all_clear'),
      kind: 'all_clear',
      value: '✓',
      unit: 'all clear',
      title: 'Nothing urgent today',
      hint: 'Your queue is empty, no anomalies flagged, no deadlines this week.',
      recommendation:
        'Good moment for a deeper task. Want me to suggest the highest-leverage next move?',
      icon: 'Sparkles',
      href: null,
      tone: 'good',
      signal_basis: ['queue.open_count', 'anomalies.open_count', 'compliance.upcoming_deadlines'],
    })
  }

  return tiles.slice(0, 3)
}

/**
 * Call Claude with the curator prompt + signal pack. Returns the raw
 * tool_use input (or null if the call fails / Claude doesn't call the
 * tool).
 */
async function curateWithClaude(pack: OrgSignalPack): Promise<unknown | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: buildCuratorSystemPrompt(),
      tools: [SET_PRIORITY_TILES_TOOL],
      tool_choice: { type: 'tool', name: SET_PRIORITY_TILES_TOOL.name },
      messages: [
        {
          role: 'user',
          content: formatSignalPackForPrompt(pack),
        },
      ],
    })
    const toolUse = response.content.find(c => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') return null
    return toolUse.input
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

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if ('error' in ctx) return ctx.error
  const { userId, organizationId, service } = ctx

  const url = new URL(req.url)
  const fresh = url.searchParams.get('fresh') === '1'
  const dump = url.searchParams.get('dump') === '1'
  const snoozedRaw = url.searchParams.get('snoozed') ?? ''
  const snoozedKinds = snoozedRaw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 16)

  // Build the signal pack first so we can hash it for cache lookup.
  const pack = await buildOrgSignalPack(service, {
    organizationId,
    userId,
    snoozedKinds,
  })
  const signalsHash = hashSignalPack(pack)

  // Debug: ?dump=1 returns the raw pack without calling Claude. Useful
  // for verifying signal coverage during development.
  if (dump) {
    return NextResponse.json({ pack, signals_hash: signalsHash })
  }

  // Cache lookup unless ?fresh=1
  if (!fresh) {
    try {
      const { data: cached } = await service
        .from('rosa_priority_tile_cache')
        .select('tiles_json, signals_hash, generated_at')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle()
      if (cached) {
        const ageMs = Date.now() - new Date(cached.generated_at).getTime()
        const same = cached.signals_hash === signalsHash
        if (same && ageMs < CACHE_TTL_MS) {
          const payload: ResponsePayload = {
            tiles: cached.tiles_json as CuratedTile[],
            source: 'cache',
            generated_at: cached.generated_at,
            signals_hash: cached.signals_hash,
          }
          return NextResponse.json(payload, {
            headers: { 'Cache-Control': 'no-store' },
          })
        }
      }
    } catch (err) {
      // Cache table may not exist yet (migration not run). Continue.
      console.warn('[priority-tiles] cache lookup failed:', err)
    }
  }

  // Daily budget guard
  const usedToday = await curationsToday(service, organizationId, userId)
  if (!fresh && usedToday >= DAILY_BUDGET_PER_USER) {
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
    }
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  // Curate via Claude
  const rawCurated = await curateWithClaude(pack)
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
  if (tiles.length === 0) {
    tiles = fallbackTiles(pack, organizationId, userId)
    source = 'fallback'
    await logTelemetry(service, organizationId, userId, 'tile.fallback', {
      reason: rawCurated ? 'validation_empty' : 'curator_unavailable',
      drops,
    })
  } else {
    await logTelemetry(service, organizationId, userId, 'tile.curated', {
      tile_count: tiles.length,
      drops,
      source: fresh ? 'manual_refresh' : 'auto',
      kinds: tiles.map(t => t.kind),
    })
  }

  // Persist to cache (best-effort)
  try {
    await service
      .from('rosa_priority_tile_cache')
      .upsert(
        {
          organization_id: organizationId,
          user_id: userId,
          tiles_json: tiles,
          signals_hash: signalsHash,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,user_id' },
      )
  } catch (err) {
    console.warn('[priority-tiles] cache write failed:', err)
  }

  const payload: ResponsePayload = {
    tiles,
    source,
    generated_at: new Date().toISOString(),
    signals_hash: signalsHash,
    drops: drops.length > 0 ? drops : undefined,
  }
  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
