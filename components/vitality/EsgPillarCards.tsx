'use client'

import { Leaf, Users, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VitalityRing } from './VitalityRing'
import { ScoreExplainer, type CalculationInputs } from './ScoreExplainer'
import type {
  EnvironmentalSubScores,
  GovernanceSubScores,
  PillarScore,
  SocialSubScores,
} from '@/lib/vitality/composite'

interface Props {
  e: PillarScore<EnvironmentalSubScores>
  s: PillarScore<SocialSubScores>
  g: PillarScore<GovernanceSubScores>
  /** Optional sparklines per pillar from the snapshot trend. */
  sparklines?: {
    e: Array<number | null>
    s: Array<number | null>
    g: Array<number | null>
  }
  /** Compact mode trims to a single row of 3 cards with smaller rings. */
  compact?: boolean
}

const ENV_SUB_LABELS: Record<keyof EnvironmentalSubScores, string> = {
  climate: 'Climate',
  water: 'Water',
  circularity: 'Circularity',
  nature: 'Nature',
}

const SOCIAL_SUB_LABELS: Record<keyof SocialSubScores, string> = {
  community: 'Community impact',
  people_culture: 'People & culture',
  supplier_esg: 'Supplier ESG',
}

const GOV_SUB_LABELS: Record<keyof GovernanceSubScores, string> = {
  governance: 'Governance practices',
  certifications: 'Certifications progress',
}

/**
 * Three side-by-side cards (E / S / G) — used inside the breakdown modal
 * and the /performance/ ESG hero. Each card shows: icon, label, score,
 * mini ring, optional sparkline, and the sub-pillar breakdown.
 *
 * Each card has an Info popover (ScoreExplainer) so users can click for
 * the full methodology, score-band breakdown, and "Ask Rosa" action.
 */
export function EsgPillarCards({ e, s, g, sparklines, compact = false }: Props) {
  // Build CalculationInputs that drive the per-pillar explainer modal so
  // Rosa can reason about the sub-pillars in her explanation.
  const envInputs: CalculationInputs = {
    pillarScores: e.sub,
  }
  const socialInputs: CalculationInputs = {
    socialScores: s.sub,
  }
  const govInputs: CalculationInputs = {
    governanceScores: g.sub,
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <PillarCardCell
        title="Environmental"
        Icon={Leaf}
        toneClass="text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
        ringTone="emerald"
        pillar={e}
        subLabels={ENV_SUB_LABELS}
        sparkline={sparklines?.e}
        compact={compact}
        explainerType="environmental"
        explainerInputs={envInputs}
      />
      <PillarCardCell
        title="Social"
        Icon={Users}
        toneClass="text-sky-300 bg-sky-500/10 border-sky-500/30"
        ringTone="sky"
        pillar={s}
        subLabels={SOCIAL_SUB_LABELS}
        sparkline={sparklines?.s}
        compact={compact}
        explainerType="social"
        explainerInputs={socialInputs}
      />
      <PillarCardCell
        title="Governance"
        Icon={Scale}
        toneClass="text-purple-300 bg-purple-500/10 border-purple-500/30"
        ringTone="purple"
        pillar={g}
        subLabels={GOV_SUB_LABELS}
        sparkline={sparklines?.g}
        compact={compact}
        explainerType="governance"
        explainerInputs={govInputs}
      />
    </div>
  )
}

interface CellProps<T extends Record<string, number | null>> {
  title: string
  Icon: React.ComponentType<{ className?: string }>
  toneClass: string
  ringTone: 'emerald' | 'sky' | 'purple'
  pillar: PillarScore<T>
  subLabels: Record<keyof T, string>
  sparkline?: Array<number | null>
  compact?: boolean
  explainerType?: 'environmental' | 'social' | 'governance'
  explainerInputs?: CalculationInputs
}

function PillarCardCell<T extends Record<string, number | null>>({
  title,
  Icon,
  toneClass,
  pillar,
  subLabels,
  sparkline,
  compact,
  explainerType,
  explainerInputs,
}: CellProps<T>) {
  const subEntries = Object.entries(pillar.sub) as Array<[keyof T, number | null]>
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', compact && 'p-3')}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('rounded-md p-1.5 border', toneClass)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-wider truncate">{title}</p>
          {explainerType ? (
            <ScoreExplainer
              scoreType={explainerType}
              currentScore={pillar.score}
              calculationInputs={explainerInputs}
              className="hover:bg-muted text-muted-foreground hover:text-foreground"
            />
          ) : null}
        </div>
        {pillar.score !== null ? (
          <span className="text-2xl font-semibold tabular-nums leading-none">
            {pillar.score}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">no data</span>
        )}
      </div>
      {sparkline && sparkline.some(p => p !== null) ? (
        <MiniSparkline values={sparkline} className="mb-3 h-6" />
      ) : null}
      <ul className="space-y-1">
        {subEntries.map(([key, val]) => (
          <li key={String(key)} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted-foreground truncate">{subLabels[key]}</span>
            <span className="font-medium tabular-nums text-foreground">
              {val === null ? <span className="text-muted-foreground/60">—</span> : Math.round(val)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MiniSparkline({
  values,
  className,
}: {
  values: Array<number | null>
  className?: string
}) {
  const w = 120
  const h = 24
  const padX = 2
  const nonNull = values.filter((v): v is number => v !== null && Number.isFinite(v))
  if (nonNull.length === 0) return null
  const min = Math.min(...nonNull)
  const max = Math.max(...nonNull)
  const range = max - min || 1
  const stepX = values.length > 1 ? (w - 2 * padX) / (values.length - 1) : 0

  const segments: string[] = []
  let inSeg = false
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]
    if (v === null) {
      inSeg = false
      continue
    }
    const x = padX + i * stepX
    const y = (h - 4) * (1 - (v - min) / range) + 2
    segments.push(`${inSeg ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    inSeg = true
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className}>
      <path d={segments.join(' ')} stroke="#ccff00" strokeWidth="1.5" fill="none" />
    </svg>
  )
}
