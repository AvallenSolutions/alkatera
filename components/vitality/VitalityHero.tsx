'use client'

import { useCallback, useEffect, useState } from 'react'
import { TrendingDown, TrendingUp, Activity } from 'lucide-react'
import { useUserDisplayName } from '@/lib/rosa/useUserDisplayName'
import { useOrganization } from '@/lib/organizationContext'
import { useRealtimeRefresh } from '@/lib/rosa/useRealtimeRefresh'
import { trackRosa } from '@/lib/rosa/track'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { HubLayoutSettings } from '@/components/rosa/HubLayoutSettings'
import { VitalityRing } from './VitalityRing'
import { VitalityBreakdownModal } from './VitalityBreakdownModal'
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

const BAND_VISUALS: Record<ScoreBand, {
  background: string
  glow: string
  eyebrow: string
  chipBg: string
  chipFg: string
  spark: string
}> = {
  EXCELLENT: {
    background: 'border-[#ccff00]/40 from-[#0c1410] via-card to-card',
    glow: 'bg-[#ccff00]/20',
    eyebrow: 'text-[#ccff00]/85',
    chipBg: 'bg-[#ccff00]/15',
    chipFg: 'text-[#ccff00]',
    spark: '#ccff00',
  },
  HEALTHY: {
    background: 'border-emerald-500/30 from-emerald-950/30 via-card to-card',
    glow: 'bg-emerald-500/15',
    eyebrow: 'text-emerald-300',
    chipBg: 'bg-emerald-500/15',
    chipFg: 'text-emerald-300',
    spark: '#34d399',
  },
  DEVELOPING: {
    background: 'border-border from-card via-card to-card',
    glow: 'bg-blue-500/10',
    eyebrow: 'text-muted-foreground',
    chipBg: 'bg-muted',
    chipFg: 'text-foreground',
    spark: '#93c5fd',
  },
  EMERGING: {
    background: 'border-amber-500/30 from-amber-950/30 via-card to-card',
    glow: 'bg-amber-500/15',
    eyebrow: 'text-amber-300',
    chipBg: 'bg-amber-500/15',
    chipFg: 'text-amber-300',
    spark: '#fbbf24',
  },
  'NEEDS ATTENTION': {
    background: 'border-red-500/30 from-red-950/30 via-card to-card',
    glow: 'bg-red-500/15',
    eyebrow: 'text-red-300',
    chipBg: 'bg-red-500/15',
    chipFg: 'text-red-300',
    spark: '#f87171',
  },
  'AWAITING DATA': {
    background: 'border-border from-card via-card to-card',
    glow: 'bg-muted-foreground/10',
    eyebrow: 'text-muted-foreground',
    chipBg: 'bg-muted',
    chipFg: 'text-muted-foreground',
    spark: '#94a3b8',
  },
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

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      const res = await fetch('/api/vitality/composite', { credentials: 'include' })
      if (!res.ok) return
      const json = (await res.json()) as CompositeResponse
      setData(json)
    } catch {
      // keep last good
    } finally {
      setLoading(false)
    }
  }, [orgId])

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

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    void load()
  }, [orgId, load])

  // Live updates: any of these tables changing should refresh the score.
  useRealtimeRefresh(
    [
      'community_donations',
      'community_volunteer_activities',
      'community_engagements',
      'people_workforce_demographics',
      'people_dei_actions',
      'governance_policies',
      'governance_board_members',
      'product_carbon_footprints',
      'sustainability_targets',
      'organization_certifications',
      'supplier_esg_assessments',
      'community_impact_scores',
      'people_culture_scores',
      'governance_scores',
      'organizations',
    ],
    () => {
      void load()
    },
  )

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  })()

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  if (loading && !data) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <Skeleton className="h-8 w-64 mb-3" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const composite = data?.composite ?? null
  const band = composite?.band ?? 'AWAITING DATA'
  const visuals = BAND_VISUALS[band]
  const delta = data?.trend_delta?.delta_points ?? null
  const trendValues = data?.trend.map(t => t.composite) ?? []

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
          'relative overflow-hidden rounded-3xl border w-full text-left p-6 sm:p-8 cursor-pointer',
          'bg-gradient-to-br',
          visuals.background,
          'transition-shadow hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ccff00]/50',
        )}
        aria-label="Open vitality breakdown"
      >
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl',
            visuals.glow,
          )}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl"
        />

        <div className="absolute top-3 right-3 z-10" onClick={e => e.stopPropagation()}>
          <HubLayoutSettings />
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-5 gap-6 items-center">
          <div className="sm:col-span-3 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <p className={cn('text-xs uppercase tracking-[0.2em]', visuals.eyebrow)}>
                {today}
              </p>
              {composite ? (
                <BandChip band={band} delta={delta} visuals={visuals} />
              ) : null}
            </div>
            <h1 className="mt-2 text-3xl sm:text-4xl font-semibold leading-tight">
              {greeting}{firstName ? `, ${firstName}` : ''}.
            </h1>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
              {data?.read?.headline ?? data?.band_description ?? 'Loading your vitality picture…'}
            </p>

            {trendValues.length > 0 && trendValues.some(v => v !== null) ? (
              <div className="mt-4 max-w-md" aria-label="12-week composite trend">
                <CompositeSparkline values={trendValues} colour={visuals.spark} />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  12 weeks · click for the full breakdown
                </p>
              </div>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground/80 italic">
                Trend builds up as you keep visiting; one snapshot per day.
              </p>
            )}
          </div>

          <div className="sm:col-span-2 flex flex-col items-center gap-3">
            <VitalityRing
              score={composite?.composite ?? null}
              size="lg"
              animated
              showLabel={false}
            />
            {composite ? (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
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

function BandChip({
  band,
  delta,
  visuals,
}: {
  band: ScoreBand
  delta: number | null
  visuals: { chipBg: string; chipFg: string }
}) {
  const Icon =
    delta === null
      ? Activity
      : delta > 0
        ? TrendingUp
        : delta < 0
          ? TrendingDown
          : Activity
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        visuals.chipBg,
        visuals.chipFg,
      )}
    >
      <Icon className="h-3 w-3" />
      {band}
      {delta !== null && delta !== 0 ? (
        <span className="opacity-70">
          ({delta > 0 ? '+' : ''}
          {delta} pts)
        </span>
      ) : null}
    </span>
  )
}

function PillarMini({ label, score }: { label: string; score: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-semibold tabular-nums text-sm text-foreground">
        {score === null ? '—' : score}
      </span>
      <span className="opacity-70">{label}</span>
    </span>
  )
}

function CompositeSparkline({
  values,
  colour,
}: {
  values: Array<number | null>
  colour: string
}) {
  const w = 240
  const h = 28
  const padX = 2
  const padY = 2
  const nonNull = values.filter((v): v is number => v !== null && Number.isFinite(v))
  if (nonNull.length === 0) return null
  const min = Math.min(...nonNull, 0)
  const max = Math.max(...nonNull, 100)
  const range = max - min || 1
  const stepX = values.length > 1 ? (w - 2 * padX) / (values.length - 1) : 0
  const seg: string[] = []
  let inSeg = false
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]
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
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-7">
      <path d={seg.join(' ')} stroke={colour} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

