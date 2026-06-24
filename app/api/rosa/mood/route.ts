import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { COMPLIANCE_DEADLINES, expandDeadlines } from '@/lib/pulse/regulatory-deadlines'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/rosa/mood
 *
 * Returns Rosa's "weekly mood" for the org: an opinionated one-paragraph
 * read on how the last week went + a 14-day sparkline of activity + a
 * mood label that drives the dog avatar's expression on the hub.
 *
 * Computed deterministically (no LLM call here, latency matters for
 * first paint). Rules of thumb:
 *
 *   - mood 'great'   → activity up, no high-severity anomalies, no
 *                      overdue deadlines, queue empty or shrinking.
 *   - mood 'steady'  → activity flat/up, one or two soft warnings.
 *   - mood 'alert'   → high-severity anomaly OR deadline within 7 days
 *                      OR queue growing.
 *   - mood 'asleep'  → no activity at all in the last 14 days (probably
 *                      a brand-new org or one Rosa hasn't woken up yet).
 *
 * The summary string is templated rather than LLM-generated. We can
 * upgrade to a Claude-written summary later when we want richer prose
 * — for now, deterministic and fast.
 */
interface MoodResponse {
  mood: 'great' | 'steady' | 'alert' | 'asleep'
  summary: string
  sparkline: number[] // 14 values, daily total activity
  signals: {
    activity_last_7: number
    activity_prev_7: number
    delta_pct: number
    open_queue: number
    high_severity_anomalies: number
    next_deadline_days: number | null
  }
}

export async function GET() {
  const userSupabase = getSupabaseServerClient()
  const {
    data: { user },
    error: userErr,
  } = await userSupabase.auth.getUser()
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Service role missing' }, { status: 500 })
  }
  const service = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Member OR active advisor for the caller's selected org (advisor reads honoured).
  const organizationId = await resolveAccessibleOrg(service, user)
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }

  const now = new Date()
  const startOfDay = (d: Date) => {
    const c = new Date(d)
    c.setHours(0, 0, 0, 0)
    return c
  }
  const day14Ago = startOfDay(new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000))
  const since14Iso = day14Ago.toISOString()

  const [ingestRes, approvedRes, queueRes, anomalyRes] = await Promise.all([
    service
      .from('ingest_jobs')
      .select('created_at')
      .eq('organization_id', organizationId)
      .gte('created_at', since14Iso),
    service
      .from('agent_exceptions')
      .select('reviewed_at')
      .eq('organization_id', organizationId)
      .eq('status', 'approved')
      .gte('reviewed_at', since14Iso),
    service
      .from('agent_exceptions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'open'),
    service
      .from('dashboard_anomalies')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .neq('status', 'resolved')
      .neq('status', 'dismissed')
      .eq('severity', 'high'),
  ])

  // Build 14-day sparkline of total activity (ingested + approved).
  const sparkline: number[] = Array(14).fill(0)
  const dayIndex = (iso: string) => {
    const d = startOfDay(new Date(iso))
    const diffDays = Math.floor((d.getTime() - day14Ago.getTime()) / (24 * 60 * 60 * 1000))
    return diffDays
  }
  for (const j of (ingestRes.data as any[]) || []) {
    const i = dayIndex(j.created_at)
    if (i >= 0 && i < 14) sparkline[i] += 1
  }
  for (const e of (approvedRes.data as any[]) || []) {
    if (!e.reviewed_at) continue
    const i = dayIndex(e.reviewed_at)
    if (i >= 0 && i < 14) sparkline[i] += 1
  }

  const last7 = sparkline.slice(7).reduce((a, b) => a + b, 0)
  const prev7 = sparkline.slice(0, 7).reduce((a, b) => a + b, 0)
  const delta_pct =
    prev7 === 0
      ? last7 > 0
        ? 100
        : 0
      : Math.round(((last7 - prev7) / prev7) * 100)

  const openQueue = queueRes.count || 0
  const highSevAnomalies = anomalyRes.count || 0

  const upcoming = expandDeadlines(COMPLIANCE_DEADLINES, 12, now)
    .filter(d => d.days_away >= 0)
    .sort((a, b) => a.days_away - b.days_away)
  const nextDeadlineDays = upcoming[0]?.days_away ?? null

  // Mood scoring.
  let mood: MoodResponse['mood'] = 'steady'
  const totalActivity = last7 + prev7
  if (totalActivity === 0) {
    mood = 'asleep'
  } else if (
    highSevAnomalies > 0 ||
    (nextDeadlineDays !== null && nextDeadlineDays <= 7) ||
    openQueue >= 8
  ) {
    mood = 'alert'
  } else if (delta_pct >= 0 && openQueue <= 3 && highSevAnomalies === 0) {
    mood = 'great'
  }

  const summary = buildSummary({
    mood,
    last7,
    delta_pct,
    openQueue,
    highSevAnomalies,
    nextDeadlineDays,
    nextDeadlineTitle: upcoming[0]?.title ?? null,
  })

  const payload: MoodResponse = {
    mood,
    summary,
    sparkline,
    signals: {
      activity_last_7: last7,
      activity_prev_7: prev7,
      delta_pct,
      open_queue: openQueue,
      high_severity_anomalies: highSevAnomalies,
      next_deadline_days: nextDeadlineDays,
    },
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

function buildSummary(s: {
  mood: MoodResponse['mood']
  last7: number
  delta_pct: number
  openQueue: number
  highSevAnomalies: number
  nextDeadlineDays: number | null
  nextDeadlineTitle: string | null
}): string {
  if (s.mood === 'asleep') {
    return "It's quiet — I haven't seen any new data flow through in the last fortnight. Drop me a document or wire up an integration and I'll start watching."
  }
  const parts: string[] = []
  if (s.last7 > 0) {
    const trend =
      s.delta_pct > 20
        ? `up ${s.delta_pct}% on last week`
        : s.delta_pct < -20
          ? `quieter than last week (${s.delta_pct}%)`
          : 'steady on last week'
    parts.push(`I logged ${s.last7} ${s.last7 === 1 ? 'thing' : 'things'} this past week, ${trend}`)
  }
  if (s.openQueue > 0) {
    parts.push(
      `${s.openQueue} ${s.openQueue === 1 ? 'item is' : 'items are'} waiting your sign-off`,
    )
  }
  if (s.highSevAnomalies > 0) {
    parts.push(
      `${s.highSevAnomalies} high-severity ${s.highSevAnomalies === 1 ? 'anomaly' : 'anomalies'} flagged`,
    )
  }
  if (s.nextDeadlineDays !== null && s.nextDeadlineDays <= 14 && s.nextDeadlineTitle) {
    if (s.nextDeadlineDays === 0) {
      parts.push(`${s.nextDeadlineTitle} is today`)
    } else if (s.nextDeadlineDays === 1) {
      parts.push(`${s.nextDeadlineTitle} is tomorrow`)
    } else {
      parts.push(`${s.nextDeadlineTitle} lands in ${s.nextDeadlineDays} days`)
    }
  }
  if (parts.length === 0) {
    return "All quiet on the data front. No urgent items, no anomalies, no deadlines this week. Good moment for a deeper task."
  }
  // Capitalise first character + period at end.
  let s2 = parts.join(', ')
  s2 = s2.charAt(0).toUpperCase() + s2.slice(1)
  if (!s2.endsWith('.')) s2 += '.'
  return s2
}
