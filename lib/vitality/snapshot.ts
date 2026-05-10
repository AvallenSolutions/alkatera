/**
 * ESG vitality snapshot persistence + 12-week trend assembly.
 *
 * - Snapshots are idempotent per (org, day): one row, latest values win.
 * - Trend = last 12 distinct ISO weeks (Monday-anchored). Gaps render as
 *   nulls in the series so the chart shows them as breaks.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  EnvironmentalSubScores,
  GovernanceSubScores,
  SocialSubScores,
  VitalityComposite,
  VitalityWeights,
} from './composite'

const MS_PER_DAY = 86_400_000
const MS_PER_WEEK = 7 * MS_PER_DAY
const TREND_WEEKS = 12

export interface TrendPoint {
  week_start: string // ISO date YYYY-MM-DD (Monday)
  composite: number | null
  e: number | null
  s: number | null
  g: number | null
}

export interface SnapshotRow {
  organization_id: string
  snapshot_date: string
  composite: number | null
  environmental: number | null
  social: number | null
  governance: number | null
  breakdown: {
    e: EnvironmentalSubScores
    s: SocialSubScores
    g: GovernanceSubScores
  } | null
  weights: VitalityWeights | null
}

function startOfWeek(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  const dow = out.getDay() // 0=Sun, 1=Mon, ...
  const diff = dow === 0 ? -6 : 1 - dow
  out.setDate(out.getDate() + diff)
  return out
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function buildEmptyWeeks(): TrendPoint[] {
  const now = startOfWeek(new Date())
  const out: TrendPoint[] = []
  for (let i = TREND_WEEKS - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * MS_PER_WEEK)
    out.push({ week_start: isoDate(d), composite: null, e: null, s: null, g: null })
  }
  return out
}

/**
 * Idempotent upsert: one row per (org, date). Today's row keeps the latest
 * values, so multiple visits in the same day overwrite each other harmlessly.
 */
export async function upsertSnapshot(
  service: SupabaseClient,
  organizationId: string,
  composite: VitalityComposite,
): Promise<void> {
  const today = isoDate(new Date())
  const row = {
    organization_id: organizationId,
    snapshot_date: today,
    composite: composite.composite,
    environmental: composite.e.score,
    social: composite.s.score,
    governance: composite.g.score,
    breakdown: {
      e: composite.e.sub,
      s: composite.s.sub,
      g: composite.g.sub,
    },
    weights: composite.weights,
  }
  try {
    await service
      .from('esg_score_snapshots')
      .upsert(row, { onConflict: 'organization_id,snapshot_date' })
  } catch (err) {
    // Best-effort: never block the response on a snapshot write.
    console.warn('[esg snapshot] upsert failed:', err)
  }
}

/**
 * Read the last 12 weekly buckets from snapshots. Picks the *latest*
 * snapshot value within each ISO week so the trend uses end-of-week
 * values rather than means.
 */
export async function loadTrend(
  service: SupabaseClient,
  organizationId: string,
): Promise<TrendPoint[]> {
  const weeks = buildEmptyWeeks()
  const oldest = new Date(weeks[0].week_start)
  try {
    const { data, error } = await service
      .from('esg_score_snapshots')
      .select('snapshot_date, composite, environmental, social, governance')
      .eq('organization_id', organizationId)
      .gte('snapshot_date', isoDate(oldest))
      .order('snapshot_date', { ascending: true })
      .limit(200)
    if (error || !Array.isArray(data)) return weeks
    // For each ISO week, capture the latest snapshot (last by date).
    const byWeek = new Map<string, SnapshotRow>()
    for (const row of data as Array<{
      snapshot_date: string
      composite: number | null
      environmental: number | null
      social: number | null
      governance: number | null
    }>) {
      const wkStart = isoDate(startOfWeek(new Date(row.snapshot_date)))
      byWeek.set(wkStart, row as unknown as SnapshotRow)
    }
    for (const w of weeks) {
      const r = byWeek.get(w.week_start)
      if (!r) continue
      w.composite = numOrNull(r.composite)
      w.e = numOrNull(r.environmental)
      w.s = numOrNull(r.social)
      w.g = numOrNull(r.governance)
    }
  } catch {
    // Defensive — empty trend on any failure
  }
  return weeks
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Compute the headline delta over the trend window: change in composite
 * between the first non-null point and the last non-null point.
 */
export function trendDelta(trend: TrendPoint[]): {
  first: number | null
  last: number | null
  delta_points: number | null
} {
  const nonNull = trend.filter(p => p.composite !== null) as Array<{
    composite: number
  } & TrendPoint>
  if (nonNull.length === 0) return { first: null, last: null, delta_points: null }
  if (nonNull.length === 1) {
    return { first: nonNull[0].composite, last: nonNull[0].composite, delta_points: 0 }
  }
  const first = nonNull[0].composite
  const last = nonNull[nonNull.length - 1].composite
  return { first, last, delta_points: Math.round(last - first) }
}
