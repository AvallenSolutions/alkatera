'use client'

import Link from 'next/link'
import { ArrowUpRight, Loader2, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { VitalityRing } from './VitalityRing'
import { EsgPillarCards } from './EsgPillarCards'
import type { VitalityComposite } from '@/lib/vitality/composite'
import type { TrendPoint } from '@/lib/vitality/snapshot'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  composite: VitalityComposite | null
  trend: TrendPoint[] | null
  trendDelta: { delta_points: number | null } | null
  read: {
    headline: string
    detail: string
    next_move: string | null
    confidence: 'high' | 'medium' | 'low'
  } | null
  /** True while the parent is fetching the AI-curated read in the background. */
  readUpgrading?: boolean
}

export function VitalityBreakdownModal({
  open,
  onOpenChange,
  composite,
  trend,
  trendDelta,
  read,
  readUpgrading = false,
}: Props) {
  if (!composite) return null

  const sparklines = trend
    ? {
        e: trend.map(p => p.e),
        s: trend.map(p => p.s),
        g: trend.map(p => p.g),
      }
    : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vitality breakdown</DialogTitle>
          <DialogDescription>
            Composite ESG score across environmental, social, and governance pillars,
            weighted at E {Math.round(composite.weights.e * 100)}% / S{' '}
            {Math.round(composite.weights.s * 100)}% / G{' '}
            {Math.round(composite.weights.g * 100)}%.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center mt-2">
          <div className="sm:col-span-1 flex flex-col items-center justify-center">
            <VitalityRing
              score={composite.composite}
              size="lg"
              animated
              showLabel
              label={composite.band}
            />
          </div>
          <div className="sm:col-span-2 space-y-3">
            {trend && trend.length > 0 ? (
              <CompositeTrend trend={trend} />
            ) : null}
            {trendDelta?.delta_points !== null && trendDelta?.delta_points !== undefined ? (
              <p className="text-xs text-muted-foreground">
                {trendDelta.delta_points > 0
                  ? `Up ${trendDelta.delta_points} points across the snapshot window.`
                  : trendDelta.delta_points < 0
                    ? `Down ${Math.abs(trendDelta.delta_points)} points across the snapshot window.`
                    : 'Flat across the snapshot window.'}
              </p>
            ) : null}
            {read ? (
              <div className="rounded-lg border border-border bg-card/40 p-3">
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
                {/* Detail can swap when the AI version arrives; we fade it
                    so the change feels intentional rather than glitchy. */}
                <p
                  key={read.detail}
                  className={cn(
                    'mt-1.5 text-xs text-muted-foreground leading-relaxed',
                    'transition-opacity duration-300',
                    readUpgrading ? 'opacity-60' : 'opacity-100 animate-in fade-in',
                  )}
                >
                  {read.detail}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Pillar breakdown
          </h3>
          <EsgPillarCards
            e={composite.e}
            s={composite.s}
            g={composite.g}
            sparklines={sparklines}
          />
        </div>

        {read?.next_move ? (
          <div className="mt-4 rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/[0.04] p-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Best next move
            </p>
            <p className="text-sm leading-snug">{read.next_move}</p>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <Link
            href="/performance/"
            className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-[#ccff00] transition-colors"
          >
            View full Vitality dashboard
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/governance/vitality-weights/"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Adjust weights
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CompositeTrend({ trend }: { trend: TrendPoint[] }) {
  const w = 240
  const h = 48
  const padX = 4
  const padY = 4
  const vals = trend.map(p => p.composite)
  const nonNull = vals.filter((v): v is number => v !== null && Number.isFinite(v))
  if (nonNull.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Trend will fill out as you keep visiting; come back next week for a 12-week shape.
      </p>
    )
  }
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
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-12">
      <path d={seg.join(' ')} stroke="#ccff00" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}
