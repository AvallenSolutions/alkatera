'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useUserDisplayName } from '@/lib/rosa/useUserDisplayName'
import { useOrganization } from '@/lib/organizationContext'
import { useRealtimeRefresh } from '@/lib/rosa/useRealtimeRefresh'
import { trackRosa } from '@/lib/rosa/track'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { StateChip } from '@/components/studio/state-chip'
import { STUDIO, WORKING_TONE_HEX, type WorkingTone } from '@/components/studio/theme'
// Round 3 (auto-research /rosa): breakdown modal is open-gated; defer it so it
// leaves first load (benefits /rosa and every page that renders VitalityHero).
const VitalityBreakdownModal = dynamic(() => import('./VitalityBreakdownModal').then((m) => m.VitalityBreakdownModal), { ssr: false })
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

/**
 * Band → working tone. States are typographic (StateChip) and the same
 * tone strokes the composite ring. Working tones only; never decoration.
 */
const BAND_TONE: Record<ScoreBand, WorkingTone> = {
  EXCELLENT: 'good',
  HEALTHY: 'good',
  DEVELOPING: 'attention',
  EMERGING: 'attention',
  'NEEDS ATTENTION': 'stale',
  'AWAITING DATA': 'quiet',
}

function toneHex(tone: WorkingTone): string {
  return tone === 'quiet' ? STUDIO.dim : WORKING_TONE_HEX[tone]
}

/**
 * Top card on the Rosa hub. Replaces HeroGreeting. Combines:
 *  - The personal greeting (Good {time}, {name}.)
 *  - The composite ESG ring (with band label)
 *  - A 12-week composite trend sparkline
 *  - Three pillar mini-scores (E/S/G)
 *  - The Rosa-voiced one-liner read from the curator
 *  - Click anywhere to open the full breakdown modal
 *  - The hub customise (⚙) trigger lives in the top-right, same as before
 */
export function VitalityHero() {
  const { firstName } = useUserDisplayName()
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [data, setData] = useState<CompositeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [readUpgrading, setReadUpgrading] = useState(false)
  const [readUpgraded, setReadUpgraded] = useState(false)

  const load = useCallback(
    async (opts: { fresh?: boolean } = {}): Promise<CompositeResponse | null> => {
      if (!orgId) return null
      try {
        const res = await fetch(
          `/api/vitality/composite${opts.fresh ? '?fresh=1' : ''}`,
          { credentials: 'include' },
        )
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

  // When the user opens the breakdown modal, fetch an AI-curated read in
  // the background. The hero's headline/copy is templated and renders
  // instantly; the modal's deeper read upgrades to Claude once ready.
  const upgradeReadIfNeeded = useCallback(async () => {
    if (!orgId || readUpgraded || readUpgrading) return
    setReadUpgrading(true)
    try {
      const res = await fetch('/api/vitality/composite?read=1', {
        credentials: 'include',
      })
      if (res.ok) {
        const json = (await res.json()) as CompositeResponse
        setData(json)
        setReadUpgraded(true)
      }
    } catch {
      // best-effort upgrade; fallback read stays
    } finally {
      setReadUpgrading(false)
    }
  }, [orgId, readUpgraded, readUpgrading])

  const handleOpenModal = useCallback(
    (next: boolean) => {
      setModalOpen(next)
      if (next) {
        trackRosa('vitality.modal_opened', {
          composite: data?.composite?.composite ?? null,
          band: data?.composite?.band ?? null,
        })
        void upgradeReadIfNeeded()
      }
    },
    [upgradeReadIfNeeded, data?.composite?.composite, data?.composite?.band],
  )

  // Mount: render the instant stored composite, then recompute in the
  // background only if the server flagged it stale (older than the soft
  // window or from a previous day).
  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    let cancelled = false
    void load().then(res => {
      if (cancelled) return
      if (res?.stale) void maybeUpgrade()
    })
    return () => {
      cancelled = true
    }
  }, [orgId, load, maybeUpgrade])

  // Live updates: any of these tables changing should refresh the score.
  useRealtimeRefresh(
    [
      // Environmental
      'facility_activity_entries',  // water intake, waste — primary live source
      'utility_data_entries',       // electricity, gas, fuel
      'facility_water_data',        // legacy water aggregate
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
      'organizations',
    ],
    () => {
      // A watched-table change moved the underlying data → recompute in the
      // background. Debounced by RealtimeRefreshProvider so a write burst
      // coalesces into a single recompute.
      void maybeUpgrade()
    },
  )

  if (loading && !data) {
    return (
      <div className="rounded-[6px] border border-border bg-card p-6 sm:p-8">
        <Skeleton className="h-8 w-64 mb-3" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const composite = data?.composite ?? null
  const band = composite?.band ?? 'AWAITING DATA'
  const tone = BAND_TONE[band]
  const delta = data?.trend_delta?.delta_points ?? null
  const trendValues = data?.trend.map(t => t.composite) ?? []
  const deltaSuffix =
    delta !== null && delta !== 0 ? ` · ${delta > 0 ? '+' : ''}${delta} pts` : ''

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleOpenModal(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleOpenModal(true)
          }
        }}
        className={cn(
          'relative w-full cursor-pointer rounded-[6px] border border-border bg-card p-6 text-left sm:p-8',
          'transition-colors duration-200 ease-studio hover:border-foreground/30',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
        aria-label="Open vitality breakdown"
      >
        <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-5">
          <div className="min-w-0 sm:col-span-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
                THE VITALITY
              </p>
              {composite ? (
                <StateChip tone={tone}>
                  {band}
                  {deltaSuffix}
                </StateChip>
              ) : null}
            </div>
            {/* The panel's one sentence: Rosa's read of the vitality picture.
                The page statement above owns the greeting. */}
            <h2 className="mt-2 font-display text-2xl font-semibold leading-tight sm:text-3xl">
              {data?.read?.headline ?? data?.band_description ?? 'Reading your vitality picture…'}
            </h2>

            <TrendStrip values={trendValues} delta={delta} />
            <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
              Click for the full breakdown.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 sm:col-span-2">
            <CompositeRing score={composite?.composite ?? null} colour={toneHex(tone)} />
            {composite ? (
              <div className="flex items-start gap-6">
                <PillarMini label="E" score={composite.e.score} />
                <PillarMini label="S" score={composite.s.score} />
                <PillarMini label="G" score={composite.g.score} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <VitalityBreakdownModal
        open={modalOpen}
        onOpenChange={handleOpenModal}
        composite={composite}
        trend={data?.trend ?? null}
        trendDelta={data?.trend_delta ?? null}
        read={data?.read ?? null}
        readUpgrading={readUpgrading}
      />
    </>
  )
}

/**
 * The composite ring: a hairline track with the score's arc stroked in
 * the band's working tone. The number sits inside, display-bold over its
 * mono label. No gradients, no glow.
 */
function CompositeRing({ score, colour }: { score: number | null; colour: string }) {
  const size = 160
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const hasScore = score !== null && Number.isFinite(score)
  const value = hasScore ? Math.min(Math.max(score as number, 0), 100) : 0
  const dashOffset = circumference - (value / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={STUDIO.hairline}
          strokeWidth={strokeWidth}
        />
        {hasScore ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colour}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-bold leading-none tabular-nums text-foreground">
          {hasScore ? Math.round(value) : '–'}
        </span>
        <span className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-foreground opacity-70">
          composite
        </span>
      </div>
    </div>
  )
}

/** A pillar score: a small display number over its mono label. */
function PillarMini({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="text-center">
      <div className="font-display text-lg font-bold leading-none tabular-nums text-foreground">
        {score === null ? '–' : score}
      </div>
      <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.2em] text-foreground opacity-70">
        {label}
      </div>
    </div>
  )
}

/**
 * 12-week trend visual rendered as a row of weekly bars in forest. Each
 * bar encodes that week's composite score (taller = higher). Missing
 * weeks show as low-opacity placeholders so the data density is visible
 * at a glance. The latest bar uses full opacity so the eye lands on "now".
 *
 * Bars chosen over a line chart because:
 *   - Sparse data (1-2 snapshots) doesn't look like a cliff or a mystery
 *     line; instead the user sees most slots empty with one or two
 *     filled, which is honest and legible.
 *   - Bar height encodes absolute score (0-100), so visual height maps
 *     directly to the number rather than being stretched by the data
 *     range.
 *   - The pattern is familiar from activity/contribution charts.
 *
 * When fewer than one snapshot exists, the strip degrades to a helpful
 * line of copy rather than rendering an empty chart.
 */
function TrendStrip({
  values,
  delta,
}: {
  values: Array<number | null>
  delta: number | null
}) {
  const nonNullCount = values.filter(v => v !== null && Number.isFinite(v)).length

  if (nonNullCount < 1) {
    return (
      <div className="mt-4 max-w-md text-xs text-muted-foreground/80">
        12-week trend is still building. One snapshot lands per day; come back tomorrow to start seeing movement.
      </div>
    )
  }

  const deltaLabel =
    delta === null
      ? null
      : delta > 0
        ? `+${delta} pt${delta === 1 ? '' : 's'}`
        : delta < 0
          ? `${delta} pt${delta === -1 ? '' : 's'}`
          : 'Flat'
  const deltaTone =
    delta === null || delta === 0
      ? 'text-studio-dim'
      : delta > 0
        ? 'text-studio-good'
        : 'text-studio-attention'

  // Find the latest non-null bucket so we can highlight it without
  // depending on array order semantics elsewhere.
  let lastNonNullIdx = -1
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (values[i] !== null && Number.isFinite(values[i] as number)) {
      lastNonNullIdx = i
      break
    }
  }

  return (
    <div className="mt-4 max-w-md" aria-label="12-week composite trend">
      <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
        <span>12-week trend</span>
        {deltaLabel ? (
          <span className={cn('font-bold tabular-nums', deltaTone)}>{deltaLabel}</span>
        ) : null}
      </div>
      <div className="flex items-end gap-1 h-10">
        {values.map((v, i) => {
          const filled = v !== null && Number.isFinite(v)
          // Always reserve a 12% minimum height so empty slots remain
          // visible as a faint track without dominating the visual.
          const heightPct = filled ? Math.max(8, Math.min(100, v as number)) : 6
          const isLast = i === lastNonNullIdx
          return (
            <div
              key={i}
              className="flex-1 flex items-end h-full"
              aria-hidden="true"
            >
              <div
                className={cn(
                  'w-full rounded-sm transition-colors duration-200 ease-studio',
                  filled
                    ? isLast
                      ? 'opacity-100'
                      : 'opacity-60'
                    : 'opacity-15',
                )}
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: STUDIO.forest,
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
