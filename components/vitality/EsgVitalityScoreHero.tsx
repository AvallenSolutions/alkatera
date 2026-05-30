'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, RefreshCw, Loader2, Settings2, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrganization } from '@/lib/organizationContext'
import { useRealtimeRefresh } from '@/lib/rosa/useRealtimeRefresh'
import { VitalityRing } from './VitalityRing'
import { EsgPillarCards } from './EsgPillarCards'
import { ScoreExplainer, type CalculationInputs } from './ScoreExplainer'
import type { VitalityComposite, ScoreBand } from '@/lib/vitality/composite'
import type { TrendPoint } from '@/lib/vitality/snapshot'

interface CompositeResponse {
  composite: VitalityComposite
  trend: TrendPoint[]
  trend_delta: { first: number | null; last: number | null; delta_points: number | null }
  band_description: string
  read: {
    headline: string
    detail: string
    next_move: string | null
    confidence: 'high' | 'medium' | 'low'
  } | null
  source: 'curator' | 'fallback'
  generated_at: string
  stale?: boolean
}

const BAND_TONE: Record<ScoreBand, string> = {
  EXCELLENT: 'border-[#ccff00]/40 bg-gradient-to-br from-[#0c1410] via-card to-card',
  HEALTHY: 'border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-card to-card',
  DEVELOPING: 'border-border bg-card',
  EMERGING: 'border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-card to-card',
  'NEEDS ATTENTION': 'border-red-500/30 bg-gradient-to-br from-red-950/20 via-card to-card',
  'AWAITING DATA': 'border-border bg-card',
}

/**
 * Top of /performance/. Same data as VitalityHero on Rosa hub but rendered
 * larger with the pillar cards inline (no modal needed). Uses the same
 * /api/vitality/composite endpoint so HTTP cache is shared across surfaces.
 */
export function EsgVitalityScoreHero() {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [data, setData] = useState<CompositeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [readUpgrading, setReadUpgrading] = useState(false)

  const load = useCallback(
    async (opts: { fresh?: boolean; withAiRead?: boolean } = {}): Promise<CompositeResponse | null> => {
      if (!orgId) return null
      const params = new URLSearchParams()
      if (opts.fresh) params.set('fresh', '1')
      if (opts.withAiRead) params.set('read', '1')
      const url = `/api/vitality/composite${params.size > 0 ? `?${params.toString()}` : ''}`
      try {
        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) return null
        const json = (await res.json()) as CompositeResponse
        setData(json)
        return json
      } catch {
        // keep last good
        return null
      } finally {
        setLoading(false)
      }
    },
    [orgId],
  )

  // Background recompute, guarded so mount-if-stale and a realtime tick don't
  // fire two ~39-query recomputes at once.
  const upgradingRef = useRef(false)
  const maybeUpgrade = useCallback(async () => {
    if (upgradingRef.current) return
    upgradingRef.current = true
    try {
      await load({ fresh: true })
    } finally {
      upgradingRef.current = false
    }
  }, [load])

  // Re-pick: user-forced recompute + AI read.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load({ fresh: true, withAiRead: true })
    } finally {
      setRefreshing(false)
    }
  }, [load])

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    let cancelled = false
    // Three-stage: instant cached composite → recompute if stale → AI read.
    // read=1 serves off the latest snapshot (no rebuild), so the read is cheap
    // and reflects the just-recomputed score.
    void (async () => {
      const first = await load()
      if (cancelled) return
      if (first?.stale) {
        await maybeUpgrade()
        if (cancelled) return
      }
      setReadUpgrading(true)
      try {
        await load({ withAiRead: true })
      } finally {
        if (!cancelled) setReadUpgrading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgId, load, maybeUpgrade])

  useRealtimeRefresh(
    [
      // Environmental
      'facility_activity_entries',
      'utility_data_entries',
      'facility_water_data',
      'product_carbon_footprints',
      'sustainability_targets',
      // Social
      'community_donations',
      'community_volunteer_activities',
      'community_engagements',
      'people_workforce_demographics',
      'people_dei_actions',
      'supplier_esg_assessments',
      'community_impact_scores',
      'people_culture_scores',
      // Governance
      'governance_policies',
      'governance_board_members',
      'governance_scores',
      'organization_certifications',
    ],
    () => {
      // Watched-table change → recompute in the background (debounced by the
      // RealtimeRefreshProvider). Keeps /performance self-healing now that a
      // plain load() only re-reads the cache.
      void maybeUpgrade()
    },
  )

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <Skeleton className="h-8 w-64 mb-3" />
        <Skeleton className="h-40 w-full mb-3" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Couldn&apos;t load your composite vitality. Try refreshing.
      </div>
    )
  }

  const { composite, trend, trend_delta, read } = data
  const sparklines = {
    e: trend.map(p => p.e),
    s: trend.map(p => p.s),
    g: trend.map(p => p.g),
  }
  const delta = trend_delta?.delta_points ?? null
  const DeltaIcon = delta === null ? TrendingUp : delta >= 0 ? TrendingUp : TrendingDown

  // Inputs for the composite ScoreExplainer popover.
  const compositeInputs: CalculationInputs = {
    esgScores: {
      e: composite.e.score,
      s: composite.s.score,
      g: composite.g.score,
    },
    esgWeights: composite.weights,
  }

  return (
    <div className={cn('rounded-2xl border p-6 sm:p-8', BAND_TONE[composite.band])}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Company vitality
            </p>
            <ScoreExplainer
              scoreType="composite"
              currentScore={composite.composite}
              calculationInputs={compositeInputs}
              className="hover:bg-muted text-muted-foreground hover:text-foreground"
            />
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold leading-tight">
            {composite.band === 'AWAITING DATA'
              ? 'Awaiting more data to call your score.'
              : `Your vitality is ${composite.band.toLowerCase()}.`}
          </h1>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Link
            href="/governance/vitality-weights/"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Adjust ESG weighting"
            title="Adjust ESG weighting"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh score"
            title="Refresh score"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
        <div className="lg:col-span-2 flex flex-col items-center justify-center">
          <VitalityRing score={composite.composite} size="xl" animated showLabel label={composite.band} />
          {delta !== null && delta !== 0 ? (
            <p className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <DeltaIcon className="h-3.5 w-3.5" />
              {delta > 0 ? '+' : ''}
              {delta} pts over the snapshot window
            </p>
          ) : null}
        </div>
        <div className="lg:col-span-3 flex flex-col gap-4">
          {trend.some(p => p.composite !== null) ? (
            <CompositeChart trend={trend} />
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Trend builds up across visits — one snapshot per day.
            </p>
          )}
          {read ? (
            <div className="rounded-lg border border-border/50 bg-card/40 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                {readUpgrading ? (
                  <Loader2 className="h-3 w-3 text-[#ccff00] animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 text-[#ccff00]" />
                )}
                Rosa&apos;s read
                {readUpgrading ? (
                  <span className="text-[10px] text-muted-foreground/70">· deepening</span>
                ) : read.confidence === 'low' ? (
                  <span className="text-[10px] text-muted-foreground/70">· low confidence</span>
                ) : null}
              </p>
              <p className="mt-1.5 text-sm font-medium leading-snug">{read.headline}</p>
              <p
                key={read.detail}
                className={cn(
                  'mt-1.5 text-xs text-muted-foreground leading-relaxed transition-opacity duration-300',
                  readUpgrading ? 'opacity-60' : 'opacity-100 animate-in fade-in',
                )}
              >
                {read.detail}
              </p>
              {read.next_move ? (
                <p
                  key={read.next_move}
                  className={cn(
                    'mt-2 text-xs italic text-foreground/90 leading-relaxed transition-opacity duration-300',
                    readUpgrading ? 'opacity-60' : 'opacity-100 animate-in fade-in',
                  )}
                >
                  Next move: {read.next_move}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Pillar breakdown
        </h2>
        <EsgPillarCards
          e={composite.e}
          s={composite.s}
          g={composite.g}
          sparklines={sparklines}
        />
      </div>

      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Weighted: E {Math.round(composite.weights.e * 100)}% · S{' '}
          {Math.round(composite.weights.s * 100)}% · G {Math.round(composite.weights.g * 100)}%
        </span>
        <Link
          href="/governance/vitality-weights/"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          Adjust weights
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}

/**
 * 12-week trend visual: a row of weekly bars. Each bar's height encodes
 * the composite score (0-100), latest week at full opacity, earlier
 * weeks soft, empty slots faint. Mirrors the same pattern used on the
 * Rosa-hub `TrendStrip` so the language is consistent across surfaces.
 *
 * Sized up here because the Performance card gives the chart roughly
 * 60% of the card width and the user is looking at it intentionally
 * (rather than glancing at the Rosa hub).
 */
function CompositeChart({ trend }: { trend: TrendPoint[] }) {
  const vals = trend.map(p => p.composite)
  if (!vals.some(v => v !== null && Number.isFinite(v))) return null

  // Latest non-null bucket so the "now" bar is clearly identifiable
  // even when later weeks have no snapshot yet.
  let lastNonNullIdx = -1
  for (let i = vals.length - 1; i >= 0; i -= 1) {
    if (vals[i] !== null && Number.isFinite(vals[i] as number)) {
      lastNonNullIdx = i
      break
    }
  }

  return (
    <div aria-label="12-week composite trend">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        12-week trend
      </p>
      <div className="flex items-end gap-1.5 h-20">
        {vals.map((v, i) => {
          const filled = v !== null && Number.isFinite(v)
          // Reserve a small minimum visible height so empty slots remain
          // a faint track and the user can see at-a-glance how much data
          // has been captured so far.
          const heightPct = filled ? Math.max(8, Math.min(100, v as number)) : 5
          const isLast = i === lastNonNullIdx
          return (
            <div key={i} className="flex-1 flex items-end h-full" aria-hidden="true">
              <div
                className={cn(
                  'w-full rounded-sm transition-colors',
                  filled
                    ? isLast
                      ? 'opacity-100'
                      : 'opacity-65'
                    : 'opacity-15',
                )}
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: '#ccff00',
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>12 weeks ago</span>
        <span>Today</span>
      </div>
    </div>
  )
}
