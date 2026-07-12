'use client'

import { cn } from '@/lib/utils'
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
    socialBreakdown: 'social_breakdown' in s ? (s as any).social_breakdown : null,
  }
  const govInputs: CalculationInputs = {
    governanceScores: g.sub,
    governanceBreakdown: 'governance_breakdown' in g ? (g as any).governance_breakdown : null,
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <PillarCardCell
        title="Environmental"
        pillar={e}
        subLabels={ENV_SUB_LABELS}
        sparkline={sparklines?.e}
        compact={compact}
        explainerType="environmental"
        explainerInputs={envInputs}
      />
      <PillarCardCell
        title="Social"
        pillar={s}
        subLabels={SOCIAL_SUB_LABELS}
        sparkline={sparklines?.s}
        compact={compact}
        explainerType="social"
        explainerInputs={socialInputs}
      />
      <PillarCardCell
        title="Governance"
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

interface CellProps<T extends object> {
  title: string
  pillar: PillarScore<T>
  subLabels: Record<keyof T, string>
  sparkline?: Array<number | null>
  compact?: boolean
  explainerType?: 'environmental' | 'social' | 'governance'
  explainerInputs?: CalculationInputs
}

function PillarCardCell<T extends object>({
  title,
  pillar,
  subLabels,
  sparkline,
  compact,
  explainerType,
  explainerInputs,
}: CellProps<T>) {
  const subEntries = Object.entries(pillar.sub) as Array<[keyof T, number | null]>
  return (
    <div className={cn('rounded-[6px] border border-border bg-card p-4', compact && 'p-3')}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim truncate">
            {title}
          </p>
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
          <span className="font-display text-2xl font-semibold tabular-nums leading-none">
            {pillar.score}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">no data</span>
        )}
      </div>
      {sparkline && sparkline.some(p => p !== null) ? (
        <MiniTrendBars values={sparkline} className="mb-3" />
      ) : null}
      <ul className="space-y-1">
        {subEntries.map(([key, val]) => (
          <li key={String(key)} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted-foreground truncate">{subLabels[key]}</span>
            <span className="font-medium tabular-nums text-foreground">
              {val === null ? <span className="text-muted-foreground/60">·</span> : Math.round(val)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Compact 12-week trend bars used inside each pillar card. Mirrors the
 * same bar-chart pattern as the main hero `TrendStrip` for visual
 * consistency, just shorter: each bar's height encodes that week's
 * sub-pillar score (0-100), latest week is full opacity, earlier weeks
 * soft, empty slots are a faint placeholder track so the data density
 * is visible at a glance.
 */
function MiniTrendBars({
  values,
  className,
}: {
  values: Array<number | null>
  className?: string
}) {
  if (!values.some(v => v !== null && Number.isFinite(v))) return null
  let lastNonNullIdx = -1
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (values[i] !== null && Number.isFinite(values[i] as number)) {
      lastNonNullIdx = i
      break
    }
  }
  return (
    <div className={cn('flex items-end gap-0.5 h-5', className)} aria-hidden="true">
      {values.map((v, i) => {
        const filled = v !== null && Number.isFinite(v)
        const heightPct = filled ? Math.max(10, Math.min(100, v as number)) : 6
        const isLast = i === lastNonNullIdx
        return (
          <div key={i} className="flex-1 flex items-end h-full">
            <div
              className={cn(
                'w-full rounded-sm transition-colors',
                filled ? (isLast ? 'opacity-100' : 'opacity-65') : 'opacity-15',
              )}
              style={{ height: `${heightPct}%`, backgroundColor: '#205E40' }}
            />
          </div>
        )
      })}
    </div>
  )
}
