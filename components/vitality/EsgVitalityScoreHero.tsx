'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrganization } from '@/lib/organizationContext'
import { useRealtimeRefresh } from '@/lib/rosa/useRealtimeRefresh'
import { VitalityRing } from './VitalityRing'
import { ScoreExplainer, type CalculationInputs } from './ScoreExplainer'
import { Eyebrow } from '@/components/studio/eyebrow'
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

/** Each band as a proper sentence: "is healthy" reads, "is needs attention" does not. */
const BAND_SENTENCE: Record<ScoreBand, string> = {
  EXCELLENT: 'Your vitality is excellent.',
  HEALTHY: 'Your vitality is healthy.',
  DEVELOPING: 'Your vitality is developing.',
  EMERGING: 'Your vitality is emerging.',
  'NEEDS ATTENTION': 'Your vitality needs attention.',
  'AWAITING DATA': 'Awaiting more data to call your score.',
}

function bandSentence(band: ScoreBand): string {
  return BAND_SENTENCE[band] ?? `Your vitality is ${band.toLowerCase()}.`
}

/**
 * Top of /performance/. Same data as VitalityHero on Rosa hub but rendered
 * larger with the pillar cards inline (no modal needed). Uses the same
 * /api/vitality/composite endpoint so HTTP cache is shared across surfaces.
 *
 * The hero owns the one composite fetch for the whole surface: `onComposite`
 * hands the loaded composite back up to /performance so the page never
 * re-fetches it for its pillar breakdowns or strengths/improvements.
 */
export function EsgVitalityScoreHero({
  onComposite,
}: {
  onComposite?: (composite: VitalityComposite) => void
} = {}) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [data, setData] = useState<CompositeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [readUpgrading, setReadUpgrading] = useState(false)

  // Held in a ref so /performance's inline handler doesn't churn `load`.
  const onCompositeRef = useRef(onComposite)
  onCompositeRef.current = onComposite

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
        if (json?.composite) onCompositeRef.current?.(json.composite)
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
      <div className="space-y-6">
        <Skeleton className="h-40 w-40 rounded-full" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn&apos;t load your composite vitality. Try refreshing the page.
      </p>
    )
  }

  const { composite, trend, trend_delta, read } = data
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
    <div className="space-y-8">
      {/* The score: the ring is the number, the band its plain-language read. */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
        <div className="flex-shrink-0">
          <VitalityRing score={composite.composite} size="xl" animated showLabel label={composite.band} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Eyebrow>Company vitality</Eyebrow>
            <ScoreExplainer
              scoreType="composite"
              currentScore={composite.composite}
              calculationInputs={compositeInputs}
              className="hover:bg-muted text-muted-foreground hover:text-foreground"
            />
          </div>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-semibold leading-tight tracking-[-0.02em]">
            {bandSentence(composite.band)}
          </p>
          <div className="mt-3 flex items-center gap-4">
            {delta !== null && delta !== 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <DeltaIcon className="h-3.5 w-3.5" />
                {delta > 0 ? '+' : ''}
                {delta} pts over the snapshot window
              </span>
            ) : null}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim transition-colors hover:text-foreground disabled:opacity-50"
            >
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Rosa's read: a quiet section, no nested card. */}
      {read ? (
        <div className="border-t border-border pt-6">
          <Eyebrow className="mb-2">
            Rosa&apos;s read
            {readUpgrading ? (
              <span className="ml-1 text-muted-foreground/60">· deepening</span>
            ) : read.confidence === 'low' ? (
              <span className="ml-1 text-muted-foreground/60">· low confidence</span>
            ) : null}
          </Eyebrow>
          <p className="text-sm font-medium leading-snug">{read.headline}</p>
          <p
            key={read.detail}
            className={cn(
              'mt-1.5 text-sm text-muted-foreground leading-relaxed transition-opacity duration-300',
              readUpgrading ? 'opacity-60' : 'opacity-100 animate-in fade-in',
            )}
          >
            {read.detail}
          </p>
          {read.next_move ? (
            <p
              key={read.next_move}
              className={cn(
                'mt-2 text-sm italic text-foreground/90 leading-relaxed transition-opacity duration-300',
                readUpgrading ? 'opacity-60' : 'opacity-100 animate-in fade-in',
              )}
            >
              Next move: {read.next_move}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* The 12-week trend: a quiet section. */}
      {trend.some(p => p.composite !== null) ? (
        <div className="border-t border-border pt-6">
          <CompositeChart trend={trend} />
        </div>
      ) : null}

      {/* The pillar breakdown used to sit here, repeating as three boxed cards
          the same nine numbers the page then showed again as four expandable
          pillar cards. It now lives once, in the page body, as three hairline
          sections — see components/vitality/VitalityAxisSections.tsx. The hero
          keeps what only it can say: the ring, the verdict, Rosa's read. */}

      {/* Weights: a quiet footer line. */}
      <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
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
                  backgroundColor: '#205E40',
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
