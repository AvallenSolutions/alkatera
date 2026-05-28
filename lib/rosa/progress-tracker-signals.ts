/**
 * Rosa — progress-tracker timeseries assembler.
 *
 * Given a tracker_id and an org, returns 12 weekly buckets plus comparison
 * overlays (target, baseline) where applicable. All queries are defensive:
 * a missing table or empty result returns a series of nulls rather than
 * throwing, so the route can always render *something*.
 *
 * Weeks are Monday-anchored (UK convention). The current week is the last
 * bucket; we look back 11 prior weeks. Missing weeks render as null in
 * the series; the chart treats nulls as gaps.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PROGRESS_TRACKERS,
  type ProgressTrackerId,
  type ComparisonKind,
} from './progress-tracker-types'

const WEEK_COUNT = 12
const MS_PER_DAY = 86_400_000
const MS_PER_WEEK = 7 * MS_PER_DAY

export interface SeriesPoint {
  week_start: string // ISO date YYYY-MM-DD (Monday)
  value: number | null
}

export interface OverlayPoint {
  week_start: string
  value: number
}

export interface TrackerTimeseries {
  tracker_id: ProgressTrackerId
  /** Tracker resolved by Rosa when tracker_id was 'custom_rosa'. Null when not custom. */
  resolved_tracker_id: ProgressTrackerId | null
  series: SeriesPoint[]
  comparison: ComparisonKind
  overlay_target: OverlayPoint[] | null
  overlay_baseline: number | null
  overlay_benchmark: number | null
  /** Pre-computed deltas the prompt + UI both want. */
  delta: {
    first_value: number | null
    last_value: number | null
    pct_change: number | null
    direction: 'improving' | 'flat' | 'worsening' | 'no_data'
  }
  /** Surface-level facts about feasibility — lets Rosa say "no data yet". */
  data_quality: {
    coverage_weeks: number  // weeks with non-null value
    is_feasible: boolean    // false when we couldn't compute anything
    feasibility_note: string | null
  }
}

interface BuilderInputs {
  organizationId: string
  trackerId: ProgressTrackerId
  /** Used by 'target_progress'. If omitted, picks the first target row. */
  targetId?: string
}

/** Monday-anchored start of the week containing `d`. */
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

function emptyWeeks(): SeriesPoint[] {
  const now = startOfWeek(new Date())
  const out: SeriesPoint[] = []
  for (let i = WEEK_COUNT - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * MS_PER_WEEK)
    out.push({ week_start: isoDate(d), value: null })
  }
  return out
}

function computeDelta(series: SeriesPoint[], higherIsBetter: boolean) {
  const nonNull = series.filter((p): p is { week_start: string; value: number } => p.value !== null)
  if (nonNull.length === 0) {
    return { first_value: null, last_value: null, pct_change: null, direction: 'no_data' as const }
  }
  if (nonNull.length === 1) {
    return {
      first_value: nonNull[0].value,
      last_value: nonNull[0].value,
      pct_change: null,
      direction: 'flat' as const,
    }
  }
  const first = nonNull[0].value
  const last = nonNull[nonNull.length - 1].value
  const pct = first === 0 ? null : ((last - first) / first) * 100
  let direction: 'improving' | 'flat' | 'worsening' | 'no_data' = 'flat'
  if (pct !== null) {
    const movedUp = pct > 2
    const movedDown = pct < -2
    if (movedUp) direction = higherIsBetter ? 'improving' : 'worsening'
    else if (movedDown) direction = higherIsBetter ? 'worsening' : 'improving'
    else direction = 'flat'
  }
  return {
    first_value: first,
    last_value: last,
    pct_change: pct === null ? null : Math.round(pct * 10) / 10,
    direction,
  }
}

/**
 * Read weekly buckets from metric_snapshots. Sums values within each ISO
 * week (Monday → Sunday). Returns 12 weeks with null for empty weeks.
 */
async function metricSnapshotSeries(
  service: SupabaseClient,
  organizationId: string,
  metricKey: string,
  agg: 'sum' | 'last',
): Promise<SeriesPoint[]> {
  const weeks = emptyWeeks()
  const oldestStart = new Date(weeks[0].week_start)
  try {
    const { data, error } = await service
      .from('metric_snapshots')
      .select('snapshot_date, value')
      .eq('organization_id', organizationId)
      .eq('metric_key', metricKey)
      .gte('snapshot_date', isoDate(oldestStart))
      .order('snapshot_date', { ascending: true })
      .limit(2000)
    if (error || !Array.isArray(data)) return weeks
    const rowsByWeek = new Map<string, number[]>()
    for (const row of data as Array<{ snapshot_date: string; value: number | null }>) {
      if (row.value === null || !Number.isFinite(row.value)) continue
      const wkStart = isoDate(startOfWeek(new Date(row.snapshot_date)))
      const arr = rowsByWeek.get(wkStart) ?? []
      arr.push(Number(row.value))
      rowsByWeek.set(wkStart, arr)
    }
    for (const w of weeks) {
      const vals = rowsByWeek.get(w.week_start) ?? []
      if (vals.length === 0) continue
      w.value = agg === 'sum' ? vals.reduce((a, b) => a + b, 0) : vals[vals.length - 1]
    }
  } catch {
    // Defensive: keep empty series
  }
  return weeks
}

/**
 * For trackers that need to compute share-style metrics weekly (e.g.
 * supplier ESG submission share). For each week, we want the cumulative
 * count up to the END of that week as a percentage of the relevant
 * universe at that time. Simpler approximation: use the universe size
 * NOW (latest count) and walk the cumulative submitted timestamps.
 */
async function cumulativeShareSeries(opts: {
  service: SupabaseClient
  organizationId: string
  /** Pull the timestamp column from this table (filtered to org). */
  fromTable: string
  /** Column on fromTable that holds the qualifying timestamp (e.g. submitted_at). */
  whenColumn: string
  /** Optional foreign-key filter expression on the table. */
  filterFn?: (q: any) => any
  /** Universe size: how many of the population could have been counted. */
  universeCount: number
}): Promise<SeriesPoint[]> {
  const { service, fromTable, whenColumn, filterFn, universeCount } = opts
  const weeks = emptyWeeks()
  const oldestStart = new Date(weeks[0].week_start)
  if (universeCount <= 0) return weeks
  try {
    let q = service
      .from(fromTable)
      .select(`${whenColumn}`)
      .not(whenColumn, 'is', null)
      .order(whenColumn, { ascending: true })
      .limit(5000)
    q = filterFn ? filterFn(q) : q
    const { data, error } = await q
    if (error || !Array.isArray(data)) return weeks
    // Step through unknown first so TS lets us treat the row payload as
    // a plain string-keyed map. supabase-js types the data as a union
    // that includes a generic error variant when relationships aren't
    // resolved, which doesn't overlap with the row shape cleanly.
    const timestamps = (data as unknown as Array<Record<string, string | null>>)
      .map(r => r[whenColumn])
      .filter((t): t is string => typeof t === 'string')
      .map(t => new Date(t).getTime())
      .sort((a, b) => a - b)
    let cumulative = 0
    let cursor = 0
    for (const w of weeks) {
      const weekEndMs = new Date(w.week_start).getTime() + 7 * MS_PER_DAY
      while (cursor < timestamps.length && timestamps[cursor] < weekEndMs) {
        cumulative += 1
        cursor += 1
      }
      // Only count cumulative items from before the oldest week as "starting" baseline.
      if (new Date(w.week_start).getTime() < oldestStart.getTime()) continue
      w.value = Math.min(100, (cumulative / universeCount) * 100)
    }
  } catch {
    // Defensive: keep empty series
  }
  return weeks
}

async function buildTotalEmissions(
  service: SupabaseClient,
  organizationId: string,
): Promise<TrackerTimeseries> {
  // `total_co2e` snapshots are cumulative state (year-to-date corporate
  // emissions as of each snapshot's asOfDate), not incremental deltas, so
  // 'last' is the right per-week aggregation. Using 'sum' here double-counts
  // when two snapshots land in the same ISO week — exactly what happens when
  // a re-backfill writes a corrected snapshot next to a stale daily-cron one.
  const kgSeries = await metricSnapshotSeries(service, organizationId, 'total_co2e', 'last')
  // Snapshots store kg; we display this tracker in tonnes so the number isn't
  // a giant 6-digit value that loses meaning. Scale every series point and the
  // baseline by 1/1000 — `def.unit` is already 't CO₂e'.
  const series = kgSeries.map(p => ({
    week_start: p.week_start,
    value: p.value === null ? null : p.value / 1000,
  }))
  const def = PROGRESS_TRACKERS.total_emissions
  const delta = computeDelta(series, def.higher_is_better)
  const baseline = series.find(p => p.value !== null)?.value ?? null
  const coverage = series.filter(p => p.value !== null).length
  return {
    tracker_id: 'total_emissions',
    resolved_tracker_id: null,
    series,
    comparison: 'baseline',
    overlay_target: null,
    overlay_baseline: baseline,
    overlay_benchmark: null,
    delta,
    data_quality: {
      coverage_weeks: coverage,
      is_feasible: coverage >= 1,
      feasibility_note:
        coverage === 0
          ? 'No total_co2e snapshots yet. Add some scope 1/2 data to start the trend.'
          : null,
    },
  }
}

async function buildWaterUse(
  service: SupabaseClient,
  organizationId: string,
): Promise<TrackerTimeseries> {
  // Water consumption is also a cumulative trailing-12m state, not an
  // incremental period delta — use 'last' for the same reason as total_co2e.
  const series = await metricSnapshotSeries(service, organizationId, 'water_consumption', 'last')
  const def = PROGRESS_TRACKERS.water_use
  const delta = computeDelta(series, def.higher_is_better)
  const baseline = series.find(p => p.value !== null)?.value ?? null
  const coverage = series.filter(p => p.value !== null).length
  return {
    tracker_id: 'water_use',
    resolved_tracker_id: null,
    series,
    comparison: 'baseline',
    overlay_target: null,
    overlay_baseline: baseline,
    overlay_benchmark: null,
    delta,
    data_quality: {
      coverage_weeks: coverage,
      is_feasible: coverage >= 1,
      feasibility_note:
        coverage === 0
          ? 'No water snapshots yet. Add facility water data to start the trend.'
          : null,
    },
  }
}

async function buildLcaCoverage(
  service: SupabaseClient,
  organizationId: string,
): Promise<TrackerTimeseries> {
  // Prefer the snapshotted lca_completeness_pct. If empty, derive a fallback
  // from product_carbon_footprints + products.
  const snapped = await metricSnapshotSeries(
    service,
    organizationId,
    'lca_completeness_pct',
    'last',
  )
  let series = snapped
  let coverage = series.filter(p => p.value !== null).length
  if (coverage === 0) {
    // Fallback: compute today's value, plant it as a single point in the latest week.
    try {
      const [{ count: products }, { count: completed }] = await Promise.all([
        service
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        service
          .from('product_carbon_footprints')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          // Onboarding estimates count as covered for tracker reporting; a
          // completed LCA supersedes its estimate via DB trigger.
          .in('status', ['completed', 'estimate']),
      ])
      const total = products ?? 0
      const done = completed ?? 0
      const pct = total > 0 ? (done / total) * 100 : 0
      const weeks = emptyWeeks()
      weeks[weeks.length - 1].value = pct
      series = weeks
      coverage = 1
    } catch {
      // keep snapped (empty)
    }
  }
  const def = PROGRESS_TRACKERS.lca_coverage
  const delta = computeDelta(series, def.higher_is_better)
  const baseline = series.find(p => p.value !== null)?.value ?? null
  return {
    tracker_id: 'lca_coverage',
    resolved_tracker_id: null,
    series,
    comparison: 'baseline',
    overlay_target: null,
    overlay_baseline: baseline,
    overlay_benchmark: 100,
    delta,
    data_quality: {
      coverage_weeks: coverage,
      is_feasible: coverage >= 1,
      feasibility_note:
        coverage === 0
          ? 'No products yet. Add products and start LCAs to see coverage move.'
          : null,
    },
  }
}

async function buildSupplierEsgSignal(
  service: SupabaseClient,
  organizationId: string,
): Promise<TrackerTimeseries> {
  // Universe = all suppliers in the org (active records).
  let universe = 0
  try {
    const { count } = await service
      .from('suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
    universe = count ?? 0
  } catch {
    universe = 0
  }
  const series = await cumulativeShareSeries({
    service,
    organizationId,
    fromTable: 'supplier_esg_assessments',
    whenColumn: 'submitted_at',
    universeCount: universe,
    filterFn: q =>
      q
        .select('submitted_at, suppliers!inner(organization_id)')
        .eq('suppliers.organization_id', organizationId),
  })
  const def = PROGRESS_TRACKERS.supplier_esg_signal
  const delta = computeDelta(series, def.higher_is_better)
  const baseline = series.find(p => p.value !== null)?.value ?? null
  const coverage = series.filter(p => p.value !== null).length
  return {
    tracker_id: 'supplier_esg_signal',
    resolved_tracker_id: null,
    series,
    comparison: 'baseline',
    overlay_target: null,
    overlay_baseline: baseline,
    overlay_benchmark: 100,
    delta,
    data_quality: {
      coverage_weeks: coverage,
      is_feasible: universe > 0,
      feasibility_note:
        universe === 0
          ? 'You have no suppliers loaded. Add suppliers to track ESG submission rates.'
          : null,
    },
  }
}

async function buildTargetProgress(
  service: SupabaseClient,
  organizationId: string,
  targetId: string | undefined,
): Promise<TrackerTimeseries> {
  const weeks = emptyWeeks()
  let chosenTargetRow: {
    id: string
    metric_key: string
    baseline_value: number | null
    baseline_date: string | null
    target_value: number | null
    target_date: string | null
  } | null = null
  try {
    if (targetId) {
      const { data } = await service
        .from('sustainability_targets')
        .select('id, metric_key, baseline_value, baseline_date, target_value, target_date')
        .eq('organization_id', organizationId)
        .eq('id', targetId)
        .maybeSingle()
      chosenTargetRow = (data as any) ?? null
    }
    if (!chosenTargetRow) {
      const { data } = await service
        .from('sustainability_targets')
        .select('id, metric_key, baseline_value, baseline_date, target_value, target_date')
        .eq('organization_id', organizationId)
        .order('target_date', { ascending: true })
        .limit(1)
        .maybeSingle()
      chosenTargetRow = (data as any) ?? null
    }
  } catch {
    chosenTargetRow = null
  }

  if (!chosenTargetRow || !chosenTargetRow.metric_key) {
    return {
      tracker_id: 'target_progress',
      resolved_tracker_id: null,
      series: weeks,
      comparison: 'target',
      overlay_target: null,
      overlay_baseline: null,
      overlay_benchmark: null,
      delta: { first_value: null, last_value: null, pct_change: null, direction: 'no_data' },
      data_quality: {
        coverage_weeks: 0,
        is_feasible: false,
        feasibility_note: 'No reduction targets defined yet. Set a target first.',
      },
    }
  }

  const baselineVal = chosenTargetRow.baseline_value ?? 0
  const targetVal = chosenTargetRow.target_value ?? 0
  const range = baselineVal - targetVal

  // Series: actual progress as % of (baseline → target) per week.
  const metricSeries = await metricSnapshotSeries(
    service,
    organizationId,
    chosenTargetRow.metric_key,
    'last',
  )
  const series: SeriesPoint[] = metricSeries.map(p => ({
    week_start: p.week_start,
    value:
      p.value === null || range === 0
        ? null
        : Math.round(((baselineVal - p.value) / range) * 1000) / 10, // % to 1 dp
  }))

  // Linear-path overlay
  let overlayTarget: OverlayPoint[] = []
  if (chosenTargetRow.baseline_date && chosenTargetRow.target_date) {
    const t0 = new Date(chosenTargetRow.baseline_date).getTime()
    const t1 = new Date(chosenTargetRow.target_date).getTime()
    const span = t1 - t0
    if (span > 0) {
      overlayTarget = weeks.map(w => {
        const wkMs = new Date(w.week_start).getTime()
        const pct = Math.max(0, Math.min(100, ((wkMs - t0) / span) * 100))
        return { week_start: w.week_start, value: Math.round(pct * 10) / 10 }
      })
    }
  }

  const def = PROGRESS_TRACKERS.target_progress
  const delta = computeDelta(series, def.higher_is_better)
  const coverage = series.filter(p => p.value !== null).length
  return {
    tracker_id: 'target_progress',
    resolved_tracker_id: null,
    series,
    comparison: 'target',
    overlay_target: overlayTarget.length > 0 ? overlayTarget : null,
    overlay_baseline: 0,
    overlay_benchmark: 100,
    delta,
    data_quality: {
      coverage_weeks: coverage,
      is_feasible: coverage >= 1,
      feasibility_note:
        coverage === 0
          ? `No metric snapshots for ${chosenTargetRow.metric_key} yet. Add data to track progress.`
          : null,
    },
  }
}

/**
 * Build the timeseries pack for any tracker. For 'custom_rosa' we don't
 * compute a series here; the route resolves which tracker Rosa picks
 * based on data feasibility, then re-calls this function with the
 * resolved id.
 */
export async function buildTrackerTimeseries(
  service: SupabaseClient,
  inputs: BuilderInputs,
): Promise<TrackerTimeseries> {
  const { organizationId, trackerId, targetId } = inputs
  switch (trackerId) {
    case 'total_emissions':
      return buildTotalEmissions(service, organizationId)
    case 'water_use':
      return buildWaterUse(service, organizationId)
    case 'lca_coverage':
      return buildLcaCoverage(service, organizationId)
    case 'supplier_esg_signal':
      return buildSupplierEsgSignal(service, organizationId)
    case 'target_progress':
      return buildTargetProgress(service, organizationId, targetId)
    case 'custom_rosa':
      // Caller resolves which tracker Rosa chose, then re-calls.
      return {
        tracker_id: 'custom_rosa',
        resolved_tracker_id: null,
        series: emptyWeeks(),
        comparison: 'none',
        overlay_target: null,
        overlay_baseline: null,
        overlay_benchmark: null,
        delta: { first_value: null, last_value: null, pct_change: null, direction: 'no_data' },
        data_quality: {
          coverage_weeks: 0,
          is_feasible: true,
          feasibility_note: null,
        },
      }
  }
}

/**
 * Pick the most-feasible default tracker for an org when Rosa needs to
 * resolve 'custom_rosa'. Tries trackers in order of consultant-relevance;
 * picks the first one that has at least one data point.
 */
export async function resolveCustomRosaTracker(
  service: SupabaseClient,
  organizationId: string,
): Promise<{ id: ProgressTrackerId; series: TrackerTimeseries }> {
  const candidates: ProgressTrackerId[] = [
    'target_progress',
    'total_emissions',
    'lca_coverage',
    'supplier_esg_signal',
    'water_use',
  ]
  for (const id of candidates) {
    const series = await buildTrackerTimeseries(service, {
      organizationId,
      trackerId: id,
    })
    if (series.data_quality.is_feasible && series.data_quality.coverage_weeks >= 1) {
      return { id, series }
    }
  }
  // Nothing feasible: return lca_coverage (often has at least the today-value fallback).
  const series = await buildLcaCoverage(service, organizationId)
  return { id: 'lca_coverage', series }
}
