'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  Settings2,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrganization } from '@/lib/organizationContext'
import { useRealtimeRefresh } from '@/lib/rosa/useRealtimeRefresh'
import { ProgressTrackerSetup } from './ProgressTrackerSetup'

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
    async (opts: { fresh?: boolean } = {}) => {
      if (!orgId) return
      const params = opts.fresh ? '?fresh=1' : ''
      try {
        const res = await fetch(`/api/rosa/progress-tracker${params}`, { credentials: 'include' })
        if (!res.ok) return
        const json = (await res.json()) as ResponsePayload
        setData(json)
      } catch {
        // keep last good state
      } finally {
        setLoading(false)
      }
    },
    [orgId],
  )

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load({ fresh: true })
    } finally {
      setRefreshing(false)
    }
  }, [load])

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    void load()
  }, [orgId, load])

  // Live updates: when relevant tables change, the tracker should reflect
  // the impact of the user's actions immediately.
  useRealtimeRefresh(
    [
      'metric_snapshots',
      'product_carbon_footprints',
      'sustainability_targets',
      'supplier_esg_assessments',
      'rosa_memory',
    ],
    () => {
      void load({ fresh: true })
    },
  )

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 h-full">
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
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 h-full">
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
  const deltaIcon =
    direction === 'improving' ? TrendingDown : direction === 'worsening' ? TrendingUp : Activity
  // Direction colours: improving = brand lime, worsening = amber, flat = muted.
  const deltaColor =
    deltaIsGood === true
      ? 'text-[#ccff00]'
      : deltaIsGood === false
        ? 'text-amber-300'
        : 'text-muted-foreground'

  const DeltaIcon = deltaIcon

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 h-full">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#ccff00]" />
            Progress tracker
          </h2>
          <p className="text-base font-semibold mt-0.5 truncate" title={tracker.label}>
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
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onChangeTracker}
            aria-label="Change what you track"
            title="Change what you track"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-stretch">
        {/* Left ~60%: chart + delta */}
        <div className="lg:col-span-3 flex flex-col">
          <div className="flex items-baseline justify-between mb-2">
            <div>
              {series.delta.last_value !== null ? (
                <span className="text-3xl font-semibold tabular-nums leading-none">
                  {formatNumber(series.delta.last_value)}
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                    {tracker.unit}
                  </span>
                </span>
              ) : (
                <span className="text-3xl font-semibold tabular-nums leading-none text-muted-foreground">
                  —
                </span>
              )}
            </div>
            {deltaPct !== null ? (
              <span className={cn('inline-flex items-center gap-1 text-xs font-medium', deltaColor)}>
                <DeltaIcon className="h-3.5 w-3.5" />
                {deltaPct > 0 ? '+' : ''}
                {deltaPct.toFixed(1)}%
                <span className="text-muted-foreground font-normal">over 12w</span>
              </span>
            ) : null}
          </div>
          <div className="flex-1 min-h-[140px]">
            <TrendChart series={series} higherIsBetter={tracker.higher_is_better} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-right">
            Last 12 weeks · {series.data_quality.coverage_weeks}/12 weeks with data
          </p>
        </div>

        {/* Right ~40%: Rosa-voiced read */}
        <div className="lg:col-span-2 flex flex-col gap-3 border-t lg:border-t-0 lg:border-l lg:pl-5 border-border pt-4 lg:pt-0">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-[#ccff00]" />
              Rosa&apos;s read
              {read.confidence === 'low' ? (
                <span className="ml-1 text-[10px] text-muted-foreground/70">
                  · low confidence
                </span>
              ) : null}
            </p>
            <p className="mt-2 text-sm font-medium leading-snug">{read.headline}</p>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {read.detail}
            </p>
          </div>
          {read.next_move ? (
            <div className="mt-auto pt-3 border-t border-border/50">
              <p className="text-xs italic text-muted-foreground leading-snug mb-2">
                Best next move
              </p>
              {read.next_move_href ? (
                <Link
                  href={read.next_move_href}
                  className="inline-flex items-start gap-1.5 text-xs text-foreground hover:text-[#ccff00] transition-colors group"
                >
                  <span className="leading-snug">{read.next_move}</span>
                  <ArrowUpRight className="h-3 w-3 mt-0.5 flex-shrink-0 opacity-60 group-hover:opacity-100" />
                </Link>
              ) : (
                <p className="text-xs leading-snug">{read.next_move}</p>
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
 * Nulls render as gaps; a target overlay renders as a dashed amber line.
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
          stroke="rgb(115 115 115 / 0.3)"
          strokeDasharray="2 3"
          strokeWidth="1"
        />
      ) : null}
      {targetPath ? (
        <path
          d={targetPath}
          stroke="rgb(252 211 77 / 0.6)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          fill="none"
        />
      ) : null}
      {linePath ? (
        <path
          d={linePath}
          stroke="#ccff00"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {lastDot ? (
        <circle cx={lastDot.x} cy={lastDot.y} r="3" fill="#ccff00" />
      ) : null}
    </svg>
  )
}
