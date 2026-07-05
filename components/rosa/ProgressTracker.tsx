'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, RefreshCw, Settings2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { BigNumber } from '@/components/studio/big-number'
import { Eyebrow } from '@/components/studio/eyebrow'
import { StateChip } from '@/components/studio/state-chip'
import { STUDIO } from '@/components/studio/theme'
import { useOrganization } from '@/lib/organizationContext'
import { useRealtimeRefresh } from '@/lib/rosa/useRealtimeRefresh'
import { ProgressTrackerSetup } from './ProgressTrackerSetup'
import { RichText } from '@/components/shared/Brand'

interface SeriesPoint {
  week_start: string
  value: number | null
}

interface OverlayPoint {
  week_start: string
  value: number
}

interface TrackerSeries {
  tracker_id: string
  resolved_tracker_id: string | null
  series: SeriesPoint[]
  comparison: 'target' | 'baseline' | 'benchmark' | 'none'
  overlay_target: OverlayPoint[] | null
  overlay_baseline: number | null
  overlay_benchmark: number | null
  delta: {
    first_value: number | null
    last_value: number | null
    pct_change: number | null
    direction: 'improving' | 'flat' | 'worsening' | 'no_data'
  }
  data_quality: {
    coverage_weeks: number
    is_feasible: boolean
    feasibility_note: string | null
  }
}

interface TrackerRead {
  headline: string
  detail: string
  next_move: string | null
  next_move_href: string | null
  confidence: 'high' | 'medium' | 'low'
}

interface ResponsePayload {
  status: 'ready' | 'no_tracker'
  tracker: {
    id: string
    resolved_id: string | null
    label: string
    unit: string
    higher_is_better: boolean
    href: string
  } | null
  series: TrackerSeries | null
  read: TrackerRead | null
  source: 'cache' | 'curator' | 'fallback' | 'no_tracker'
  generated_at: string
  stale?: boolean
}

/**
 * Progress Tracker — the main "what matters to me" card on /rosa/.
 * Replaces the old Activity Pulse (ingest/approval throughput) with
 * a per-user trend chart on a tracker the user (or Rosa) chose,
 * paired with a short consultant read on what the trend means.
 */
export function ProgressTracker() {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [data, setData] = useState<ResponsePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showSetup, setShowSetup] = useState(false)

  const load = useCallback(
    async (opts: { fresh?: boolean; auto?: boolean } = {}): Promise<ResponsePayload | null> => {
      if (!orgId) return null
      const params = new URLSearchParams()
      if (opts.fresh) params.set('fresh', '1')
      // Background upgrades (mount-if-stale / realtime ticks) are budget-capped
      // server-side; user-forced Re-pick omits auto so it bypasses the budget.
      if (opts.fresh && opts.auto) params.set('auto', '1')
      const qs = params.size > 0 ? `?${params.toString()}` : ''
      try {
        const res = await fetch(`/api/rosa/progress-tracker${qs}`, { credentials: 'include' })
        if (!res.ok) return null
        const json = (await res.json()) as ResponsePayload
        setData(json)
        return json
      } catch {
        // keep last good state
        return null
      } finally {
        setLoading(false)
      }
    },
    [orgId],
  )

  // Background upgrade to a freshly-curated read, guarded so overlapping
  // triggers (mount-if-stale + a realtime tick) don't fire two Gemini calls.
  const upgradingRef = useRef(false)
  const maybeUpgrade = useCallback(async () => {
    if (upgradingRef.current) return
    upgradingRef.current = true
    try {
      await load({ fresh: true, auto: true })
    } finally {
      upgradingRef.current = false
    }
  }, [load])

  // Re-pick: user-forced fresh read (bypasses the daily budget).
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load({ fresh: true })
    } finally {
      setRefreshing(false)
    }
  }, [load])

  // Mount: render the instant cache/fallback, then upgrade in the background
  // only if the server flagged it stale (or returned an uncurated fallback).
  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    let cancelled = false
    void load().then(res => {
      if (cancelled) return
      if (res && res.status === 'ready' && (res.stale || res.source === 'fallback')) {
        void maybeUpgrade()
      }
    })
    return () => {
      cancelled = true
    }
  }, [orgId, load, maybeUpgrade])

  // Live updates: a watched-table change means the tracker data moved, so
  // upgrade to a fresh read. Debounced by RealtimeRefreshProvider so a write
  // burst coalesces into one call, and budget-capped — this replaces the
  // previous un-debounced force-fresh-on-every-event storm.
  useRealtimeRefresh(
    [
      'metric_snapshots',
      'product_carbon_footprints',
      'sustainability_targets',
      'supplier_esg_assessments',
      'rosa_memory',
    ],
    () => {
      void maybeUpgrade()
    },
  )

  if (loading && !data) {
    return (
      <div className="rounded-[6px] border border-border bg-card p-5 sm:p-6 h-full">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  // No tracker chosen yet → setup state
  if (data?.status === 'no_tracker' || showSetup) {
    return (
      <ProgressTrackerSetup
        onPicked={async () => {
          // Clear stale data so the user sees a skeleton while the new
          // tracker is fetched. Without this, if the GET fails or returns
          // before re-render, the previous tracker's card lingers.
          setShowSetup(false)
          setData(null)
          setLoading(true)
          await load({ fresh: true })
        }}
        onCancel={data?.status === 'ready' ? () => setShowSetup(false) : undefined}
      />
    )
  }

  if (!data || !data.tracker || !data.series || !data.read) {
    return (
      <div className="rounded-[6px] border border-border bg-card p-5 sm:p-6 h-full">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load your tracker. Try again.</p>
      </div>
    )
  }

  return (
    <ProgressTrackerCard
      payload={data}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      onChangeTracker={() => setShowSetup(true)}
    />
  )
}

function ProgressTrackerCard({
  payload,
  refreshing,
  onRefresh,
  onChangeTracker,
}: {
  payload: ResponsePayload
  refreshing: boolean
  onRefresh: () => void
  onChangeTracker: () => void
}) {
  const { tracker, series, read } = payload
  if (!tracker || !series || !read) return null

  const direction = series.delta.direction
  const deltaPct = series.delta.pct_change
  const deltaIsGood =
    direction === 'improving' ? true : direction === 'worsening' ? false : null
  // Direction is a typographic state: good if improving, attention if not.
  const deltaTone =
    deltaIsGood === true ? 'good' : deltaIsGood === false ? 'attention' : 'quiet'

  return (
    <div className="rounded-[6px] border border-border bg-card p-5 sm:p-6 h-full">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <Eyebrow tone="inherit" className="text-studio-forest">
            Progress tracker
          </Eyebrow>
          <p className="font-display text-base font-semibold mt-1 truncate" title={tracker.label}>
            {tracker.label}
            {tracker.resolved_id && tracker.resolved_id !== tracker.id ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (Rosa picked: {tracker.resolved_id.replace(/_/g, ' ')})
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Ask Rosa to re-read"
            title="Ask Rosa to re-read"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-200 ease-studio disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onChangeTracker}
            aria-label="Change what you track"
            title="Change what you track"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-200 ease-studio"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-stretch">
        {/* Left ~60%: chart + delta */}
        <div className="lg:col-span-3 flex flex-col">
          <div className="flex items-start justify-between mb-2">
            {series.delta.last_value !== null ? (
              <BigNumber
                value={formatNumber(series.delta.last_value)}
                label={tracker.unit || 'latest'}
              />
            ) : (
              <span className="text-sm text-muted-foreground">No data yet.</span>
            )}
            {deltaPct !== null ? (
              <StateChip tone={deltaTone} className="mt-1">
                {deltaPct > 0 ? '+' : ''}
                {deltaPct.toFixed(1)}% · 12w
              </StateChip>
            ) : null}
          </div>
          <div className="flex-1 min-h-[140px]">
            <TrendChart series={series} higherIsBetter={tracker.higher_is_better} />
          </div>
          <p className="font-mono text-[10px] text-studio-dim mt-2 text-right">
            Last 12 weeks · {series.data_quality.coverage_weeks}/12 weeks with data
          </p>
        </div>

        {/* Right ~40%: Rosa-voiced read */}
        <div className="lg:col-span-2 flex flex-col gap-3 border-t lg:border-t-0 lg:border-l lg:pl-5 border-border pt-4 lg:pt-0">
          <div>
            <Eyebrow tone="dim">
              Rosa&apos;s read
              {read.confidence === 'low' ? (
                <span className="ml-1 font-normal opacity-70">· low confidence</span>
              ) : null}
            </Eyebrow>
            <p className="mt-2 text-sm font-medium leading-snug">
              <RichText>{read.headline}</RichText>
            </p>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              <RichText>{read.detail}</RichText>
            </p>
          </div>
          {read.next_move ? (
            <div className="mt-auto pt-3 border-t border-border">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-studio-dim mb-2">
                Best next move
              </p>
              {read.next_move_href ? (
                <Link
                  href={read.next_move_href}
                  className="inline-flex items-start gap-1.5 text-xs text-foreground hover:text-studio-forest transition-colors duration-200 ease-studio group"
                >
                  <span className="leading-snug">
                    <RichText>{read.next_move}</RichText>
                  </span>
                  <ArrowUpRight className="h-3 w-3 mt-0.5 flex-shrink-0 opacity-60 group-hover:opacity-100" />
                </Link>
              ) : (
                <p className="text-xs leading-snug">
                  <RichText>{read.next_move}</RichText>
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function formatNumber(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M'
  if (abs >= 10_000) return (value / 1_000).toFixed(0) + 'k'
  if (abs >= 1_000) return (value / 1_000).toFixed(1) + 'k'
  if (abs >= 100) return value.toFixed(0)
  if (abs >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

/**
 * Tiny inline SVG line chart for 12 weekly points + optional target overlay.
 * Deliberately minimal so it fits the col-span-3 slot without dependencies.
 * Nulls render as gaps; overlays render as dashed dim lines; the series
 * itself is drawn in forest.
 */
function TrendChart({
  series,
  higherIsBetter,
}: {
  series: TrackerSeries
  higherIsBetter: boolean
}) {
  const width = 320
  const height = 130
  const padX = 4
  const padY = 12

  const points = series.series.map(p => p.value)
  const overlayPoints = (series.overlay_target ?? []).map(p => p.value)
  const allValues: number[] = []
  for (const v of points) if (v !== null && Number.isFinite(v)) allValues.push(v)
  for (const v of overlayPoints) if (Number.isFinite(v)) allValues.push(v)
  if (series.overlay_baseline !== null) allValues.push(series.overlay_baseline)
  if (series.overlay_benchmark !== null) allValues.push(series.overlay_benchmark)

  if (allValues.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground/70 italic px-4 text-center">
        {series.data_quality.feasibility_note ?? 'Not enough data yet to draw a trend.'}
      </div>
    )
  }

  const minVal = Math.min(...allValues)
  const maxVal = Math.max(...allValues)
  const range = maxVal - minVal || 1
  const stepX =
    series.series.length > 1 ? (width - 2 * padX) / (series.series.length - 1) : 0

  const xy = (i: number, v: number) => {
    const x = padX + i * stepX
    const y = padY + (height - 2 * padY) * (1 - (v - minVal) / range)
    return { x, y }
  }

  // Build the main series path with gap-on-null behaviour.
  const segments: string[] = []
  let inSegment = false
  for (let i = 0; i < series.series.length; i += 1) {
    const v = series.series[i].value
    if (v === null || !Number.isFinite(v)) {
      inSegment = false
      continue
    }
    const { x, y } = xy(i, v)
    if (!inSegment) {
      segments.push(`M ${x.toFixed(1)} ${y.toFixed(1)}`)
      inSegment = true
    } else {
      segments.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`)
    }
  }
  const linePath = segments.join(' ')

  // Target overlay path
  let targetPath = ''
  if (series.overlay_target && series.overlay_target.length > 0) {
    const seg: string[] = []
    for (let i = 0; i < series.overlay_target.length; i += 1) {
      const v = series.overlay_target[i].value
      const { x, y } = xy(i, v)
      seg.push(i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`)
    }
    targetPath = seg.join(' ')
  }

  // Baseline overlay (horizontal line)
  let baselineY: number | null = null
  if (series.overlay_baseline !== null && Number.isFinite(series.overlay_baseline)) {
    baselineY = padY + (height - 2 * padY) * (1 - (series.overlay_baseline - minVal) / range)
  }

  // Last point marker
  let lastDot: { x: number; y: number } | null = null
  for (let i = series.series.length - 1; i >= 0; i -= 1) {
    const v = series.series[i].value
    if (v !== null && Number.isFinite(v)) {
      lastDot = xy(i, v)
      break
    }
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full h-full"
      aria-label="12-week trend chart"
    >
      {baselineY !== null ? (
        <line
          x1={padX}
          y1={baselineY}
          x2={width - padX}
          y2={baselineY}
          stroke={STUDIO.dim}
          strokeOpacity="0.35"
          strokeDasharray="2 3"
          strokeWidth="1"
        />
      ) : null}
      {targetPath ? (
        <path
          d={targetPath}
          stroke={STUDIO.dim}
          strokeOpacity="0.7"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          fill="none"
        />
      ) : null}
      {linePath ? (
        <path
          d={linePath}
          stroke={STUDIO.forest}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {lastDot ? (
        <circle cx={lastDot.x} cy={lastDot.y} r="3" fill={STUDIO.forest} />
      ) : null}
    </svg>
  )
}
