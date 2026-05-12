'use client'

import { useCallback, useEffect, useState } from 'react'
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

  const load = useCallback(async (opts: { withAiRead?: boolean } = {}) => {
    if (!orgId) return
    try {
      const url = opts.withAiRead
        ? '/api/vitality/composite?read=1'
        : '/api/vitality/composite'
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) return
      const json = (await res.json()) as CompositeResponse
      setData(json)
    } catch {
      // keep last good
    } finally {
      setLoading(false)
    }
  }, [orgId])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load({ withAiRead: true })
    } finally {
      setRefreshing(false)
    }
  }, [load])

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    // Two-stage load: fast deterministic render first (~DB-time), then
    // upgrade the read to Claude-curated in the background.
    void (async () => {
      await load()
      setReadUpgrading(true)
      try {
        await load({ withAiRead: true })
      } finally {
        setReadUpgrading(false)
      }
    })()
  }, [orgId, load])

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
      void load()
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

function CompositeChart({ trend }: { trend: TrendPoint[] }) {
  const w = 480
  const h = 80
  const padX = 4
  const padY = 6
  const vals = trend.map(p => p.composite)
  const nonNull = vals.filter((v): v is number => v !== null && Number.isFinite(v))
  if (nonNull.length === 0) return null
  const min = Math.min(...nonNull, 0)
  const max = Math.max(...nonNull, 100)
  const range = max - min || 1
  const stepX = trend.length > 1 ? (w - 2 * padX) / (trend.length - 1) : 0
  const seg: string[] = []
  let inSeg = false
  for (let i = 0; i < trend.length; i += 1) {
    const v = vals[i]
    if (v === null) {
      inSeg = false
      continue
    }
    const x = padX + i * stepX
    const y = padY + (h - 2 * padY) * (1 - (v - min) / range)
    seg.push(`${inSeg ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    inSeg = true
  }
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-20">
        <path d={seg.join(' ')} stroke="#ccff00" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground text-right">12 weeks</p>
    </div>
  )
}
