/**
 * Rosa — progress-tracker endpoint.
 *
 * GET /api/rosa/progress-tracker?fresh=1
 *
 * Reads the user's tracker config from rosa_memory, computes a 12-week
 * timeseries, calls Claude for the consultant read, caches per (org, user).
 * Falls back to a deterministic read if Claude is unavailable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import {
  buildTrackerTimeseries,
  resolveCustomRosaTracker,
  type TrackerTimeseries,
} from '@/lib/rosa/progress-tracker-signals'
import {
  PROGRESS_TRACKERS,
  isStoredTrackerConfig,
  type ProgressTrackerId,
  type StoredTrackerConfig,
} from '@/lib/rosa/progress-tracker-types'
import {
  PROGRESS_TRACKER_NEXT_MOVE_HREFS,
  PROGRESS_TRACKER_READ_TOOL,
  buildTrackerReadSystemPrompt,
  formatTrackerForPrompt,
  type PromptOrgContext,
} from '@/lib/rosa/progress-tracker-prompt'
import { isOverDailyBudget, logRosaTelemetry } from '@/lib/rosa/budget'

export const runtime = 'nodejs'
export const maxDuration = 30

const MODEL = 'claude-sonnet-4-6'
const MAX_OUTPUT_TOKENS = 800
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface ReadPayload {
  headline: string
  detail: string
  next_move: string | null
  next_move_href: string | null
  confidence: 'high' | 'medium' | 'low'
}

interface ResponsePayload {
  status: 'ready' | 'no_tracker'
  tracker:
    | {
        id: ProgressTrackerId
        resolved_id: ProgressTrackerId | null
        label: string
        unit: string
        higher_is_better: boolean
        href: string
      }
    | null
  series: TrackerTimeseries | null
  read: ReadPayload | null
  source: 'cache' | 'curator' | 'fallback' | 'no_tracker'
  generated_at: string
  signals_hash: string
}

function hashSignals(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function clamp(s: unknown, max: number): string {
  return String(s ?? '').trim().slice(0, max)
}

function normaliseHref(href: unknown): string | null {
  if (typeof href !== 'string') return null
  const path = href.split(/[?#]/)[0]
  for (const allowed of PROGRESS_TRACKER_NEXT_MOVE_HREFS) {
    if (path === allowed || path.startsWith(allowed + (allowed.endsWith('/') ? '' : '/'))) {
      return href
    }
  }
  return null
}

function validateRead(raw: unknown, series: TrackerTimeseries): ReadPayload {
  const r = (raw ?? {}) as Record<string, unknown>
  const headline = clamp(r.headline, 80) || 'Trend ready to review.'
  const detail =
    clamp(r.detail, 320) ||
    'Not enough data yet to call a clear direction. Add more snapshots to see the trend tighten.'
  const next_move = clamp(r.next_move, 200)
  const next_move_href = normaliseHref(r.next_move_href)
  const confidence: ReadPayload['confidence'] = (() => {
    const c = String(r.confidence ?? '').toLowerCase()
    if (c === 'high') return 'high'
    if (c === 'medium') return 'medium'
    if (c === 'low') return 'low'
    if (series.data_quality.coverage_weeks >= 8) return 'high'
    if (series.data_quality.coverage_weeks >= 3) return 'medium'
    return 'low'
  })()
  // Scrub em dashes — locked rule.
  const scrub = (str: string) => str.replace(/—/g, ', ').replace(/\s{2,}/g, ' ')
  return {
    headline: scrub(headline),
    detail: scrub(detail),
    next_move: next_move ? scrub(next_move) : null,
    next_move_href,
    confidence,
  }
}

function fallbackRead(
  trackerId: ProgressTrackerId,
  series: TrackerTimeseries,
): ReadPayload {
  const def = PROGRESS_TRACKERS[trackerId]
  const dq = series.data_quality
  if (!dq.is_feasible) {
    return {
      headline: 'No trend yet for this metric.',
      detail:
        dq.feasibility_note ??
        'I don\'t have enough data to read a trend yet. Once snapshots start landing, this will fill in.',
      next_move: 'Add some data and check back in a week.',
      next_move_href: '/data/ingest/',
      confidence: 'low',
    }
  }
  if (dq.coverage_weeks <= 2) {
    return {
      headline: `${def.label}: trend still settling.`,
      detail:
        'Only a couple of weekly data points so far. The chart will read more clearly after a month of snapshots.',
      next_move: 'Keep the data flowing in. Worth a check next week.',
      next_move_href: null,
      confidence: 'low',
    }
  }
  const pct = series.delta.pct_change ?? 0
  const dir = series.delta.direction
  const arrow = dir === 'improving' ? '↓' : dir === 'worsening' ? '↑' : '·'
  const pctStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
  return {
    headline:
      dir === 'flat'
        ? `${def.label}: flat over the last 12 weeks.`
        : `${def.label}: ${dir} (${pctStr})`,
    detail:
      `${arrow} ${pctStr} change across the 12-week window. Latest value ${
        series.delta.last_value !== null ? series.delta.last_value.toFixed(1) : 'n/a'
      } ${def.unit}.`,
    next_move:
      dir === 'improving'
        ? 'Keep the lever set you have running. Worth a write-up before the next reporting cycle.'
        : dir === 'worsening'
          ? 'Open the data view and look for the swing week. Often a single facility is doing the work.'
          : 'No movement to read into yet. Try a more sensitive tracker, or wait another month.',
    next_move_href: def.href,
    confidence: dq.coverage_weeks >= 8 ? 'high' : 'medium',
  }
}

async function curateReadWithClaude(args: {
  trackerId: ProgressTrackerId
  series: TrackerTimeseries
  org: PromptOrgContext
}): Promise<ReadPayload | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: buildTrackerReadSystemPrompt(),
      tools: [PROGRESS_TRACKER_READ_TOOL],
      tool_choice: { type: 'tool', name: PROGRESS_TRACKER_READ_TOOL.name },
      messages: [
        {
          role: 'user',
          content: formatTrackerForPrompt(args.trackerId, args.series, args.org),
        },
      ],
    })
    const toolUse = response.content.find(c => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') return null
    return validateRead(toolUse.input, args.series)
  } catch (err) {
    console.error('[progress-tracker] read curator failed:', err)
    return null
  }
}

async function loadTrackerConfig(
  service: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<StoredTrackerConfig | null> {
  try {
    const { data } = await service
      .from('rosa_memory')
      .select('value')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('scope', 'user')
      .eq('key', 'progress_tracker_v1')
      .maybeSingle()
    const raw = (data as any)?.value
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isStoredTrackerConfig(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function loadOrgContext(
  service: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<PromptOrgContext> {
  let orgName: string | null = null
  let productType: string | null = null
  try {
    const { data } = await service
      .from('organizations')
      .select('name, product_type')
      .eq('id', organizationId)
      .maybeSingle()
    orgName = (data as any)?.name ?? null
    productType = (data as any)?.product_type ?? null
  } catch {}
  let persona = 'unknown'
  let focusAreas: string[] = []
  try {
    const [{ data: personaRow }, { data: focusRow }] = await Promise.all([
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
    ])
    if ((personaRow as any)?.value) persona = String((personaRow as any).value)
    if ((focusRow as any)?.value) {
      try {
        const parsed = JSON.parse(String((focusRow as any).value))
        if (Array.isArray(parsed)) focusAreas = parsed.filter((v): v is string => typeof v === 'string')
      } catch {}
    }
  } catch {}
  return {
    org_name: orgName,
    product_type: productType,
    persona,
    focus_areas: focusAreas,
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

  const config = await loadTrackerConfig(service, organizationId, userId)
  if (!config) {
    const empty: ResponsePayload = {
      status: 'no_tracker',
      tracker: null,
      series: null,
      read: null,
      source: 'no_tracker',
      generated_at: new Date().toISOString(),
      signals_hash: '',
    }
    return NextResponse.json(empty, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  // Resolve which tracker to compute. For 'custom_rosa' we let the
  // signal layer pick the most-feasible candidate first.
  let trackerId: ProgressTrackerId = config.tracker_id
  let series: TrackerTimeseries
  if (trackerId === 'custom_rosa') {
    const resolved = await resolveCustomRosaTracker(service, organizationId)
    series = resolved.series
    series.tracker_id = 'custom_rosa'
    series.resolved_tracker_id = resolved.id
  } else {
    series = await buildTrackerTimeseries(service, {
      organizationId,
      trackerId,
      targetId: config.target_id,
    })
  }

  const signalsHash = hashSignals({ trackerId, target_id: config.target_id ?? null, series })

  // Cache lookup
  if (!fresh) {
    try {
      const { data: cached } = await service
        .from('rosa_progress_tracker_cache')
        .select('payload, signals_hash, generated_at, tracker_id')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle()
      if (cached) {
        const ageMs = Date.now() - new Date((cached as any).generated_at).getTime()
        const same = (cached as any).signals_hash === signalsHash
        if (same && ageMs < CACHE_TTL_MS) {
          return NextResponse.json(cached.payload, {
            headers: { 'Cache-Control': 'no-store' },
          })
        }
      }
    } catch {
      // cache table may not exist; continue
    }
  }

  const orgCtx = await loadOrgContext(service, organizationId, userId)
  const resolvedTrackerId =
    series.resolved_tracker_id && trackerId === 'custom_rosa'
      ? series.resolved_tracker_id
      : trackerId
  const def = PROGRESS_TRACKERS[resolvedTrackerId]

  // Curate the read via Claude, with fallback. Skipped when the user has
  // already exhausted their daily budget for tracker reads.
  let read: ReadPayload | null = null
  let source: ResponsePayload['source'] = 'fallback'
  const overBudget = await isOverDailyBudget(
    service,
    organizationId,
    userId,
    'tracker.read.curated',
  )
  if (overBudget) {
    await logRosaTelemetry(service, organizationId, userId, 'tracker.read.budget_blocked', {
      tracker_id: trackerId,
    })
  } else {
    read = await curateReadWithClaude({ trackerId, series, org: orgCtx })
    if (read) {
      source = 'curator'
      await logRosaTelemetry(service, organizationId, userId, 'tracker.read.curated', {
        tracker_id: trackerId,
      })
    }
  }
  if (!read) {
    read = fallbackRead(resolvedTrackerId, series)
    source = 'fallback'
  }

  const payload: ResponsePayload = {
    status: 'ready',
    tracker: {
      id: trackerId,
      resolved_id: series.resolved_tracker_id,
      label: def.label,
      unit: def.unit,
      higher_is_better: def.higher_is_better,
      href: def.href,
    },
    series,
    read,
    source,
    generated_at: new Date().toISOString(),
    signals_hash: signalsHash,
  }

  // Cache (best-effort)
  try {
    await service.from('rosa_progress_tracker_cache').upsert(
      {
        organization_id: organizationId,
        user_id: userId,
        tracker_id: trackerId,
        payload,
        signals_hash: signalsHash,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,user_id' },
    )
  } catch (err) {
    console.warn('[progress-tracker] cache write failed:', err)
  }

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

/**
 * POST /api/rosa/progress-tracker
 *
 * Body: { tracker_id: ProgressTrackerId, target_id?: string }
 *
 * Lets the inline chip picker set the user's tracker. The propose-confirm
 * flow from the drawer goes through the action dispatcher
 * (lib/rosa/actions.ts → propose_set_progress_tracker) and ends up
 * writing the same memory key.
 */
export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if ('error' in ctx) return ctx.error
  const { userId, organizationId, service } = ctx

  let body: { tracker_id?: string; target_id?: string }
  try {
    body = (await req.json()) as { tracker_id?: string; target_id?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const trackerId = body.tracker_id
  if (typeof trackerId !== 'string' || !(trackerId in PROGRESS_TRACKERS)) {
    return NextResponse.json({ error: 'Invalid tracker_id' }, { status: 400 })
  }
  const stored: StoredTrackerConfig = {
    v: 1,
    tracker_id: trackerId as ProgressTrackerId,
    target_id: body.target_id,
    set_at: new Date().toISOString(),
    set_by: 'user_chip',
  }
  // Manual upsert (rosa_memory has an expression unique index that
  // ON CONFLICT can't match — see the existing memory route).
  try {
    const { data: existing } = await service
      .from('rosa_memory')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('scope', 'user')
      .eq('key', 'progress_tracker_v1')
      .maybeSingle()
    const value = JSON.stringify(stored).slice(0, 1000)
    if (existing) {
      await service
        .from('rosa_memory')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('id', (existing as any).id)
    } else {
      await service.from('rosa_memory').insert({
        organization_id: organizationId,
        user_id: userId,
        scope: 'user',
        key: 'progress_tracker_v1',
        value,
      })
    }
    // Bust the tracker cache so the next GET regenerates immediately.
    await service
      .from('rosa_progress_tracker_cache')
      .delete()
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/rosa/progress-tracker — reset the tracker config so the
 * card returns to the chip picker. Used by the "change tracker"
 * settings affordance.
 */
export async function DELETE(req: NextRequest) {
  const ctx = await resolveContext(req)
  if ('error' in ctx) return ctx.error
  const { userId, organizationId, service } = ctx
  try {
    await service
      .from('rosa_memory')
      .delete()
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('scope', 'user')
      .eq('key', 'progress_tracker_v1')
    await service
      .from('rosa_progress_tracker_cache')
      .delete()
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
  } catch {}
  return NextResponse.json({ ok: true })
}
