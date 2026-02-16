'use client'

import { useEPRDataCompleteness } from '@/hooks/data/useEPRDataCompleteness'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Package,
  Loader2,
} from 'lucide-react'
import type { EPRDataGap } from '@/lib/epr/types'

interface DataReviewStepProps {
  onComplete: () => void
  onBack: () => void
  onSkip?: () => void
}

function getCompletenessColor(pct: number): {
  text: string
  indicator: string
  indicatorColor: 'emerald' | 'lime' | 'default'
  bg: string
} {
  if (pct >= 80) {
    return {
      text: 'text-emerald-400',
      indicator: 'bg-emerald-400',
      indicatorColor: 'emerald',
      bg: 'bg-emerald-400/10',
    }
  }
  if (pct >= 50) {
    return {
      text: 'text-amber-400',
      indicator: 'bg-amber-400',
      indicatorColor: 'default',
      bg: 'bg-amber-400/10',
    }
  }
  return {
    text: 'text-red-400',
    indicator: 'bg-red-400',
    indicatorColor: 'default',
    bg: 'bg-red-400/10',
  }
}

function GapRow({ gap }: { gap: EPRDataGap }) {
  return (
    <a
      href={`/products?highlight=${gap.product_id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start justify-between gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 border border-border/50 hover:border-border transition-colors group"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {gap.product_name}
          </span>
          <ExternalLink className="w-3 h-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
        <p className="text-xs text-muted-foreground truncate">{gap.material_name}</p>
        <div className="flex flex-wrap gap-1.5">
          {gap.missing_fields.map((field) => (
            <Badge
              key={field}
              variant="outline"
              className="text-[10px] border-amber-400/30 text-amber-400 bg-amber-400/10 px-1.5 py-0"
            >
              {field}
            </Badge>
          ))}
        </div>
      </div>
    </a>
  )
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-3">
          <Skeleton className="mx-auto w-16 h-16 rounded-2xl bg-muted" />
          <Skeleton className="mx-auto h-6 w-48 bg-muted rounded-lg" />
          <Skeleton className="mx-auto h-4 w-64 bg-muted rounded-lg" />
        </div>
        <div className="bg-muted/50 backdrop-blur-md border border-border rounded-2xl p-6 space-y-4">
          <div className="flex justify-center">
            <Skeleton className="h-16 w-20 bg-muted rounded-lg" />
          </div>
          <Skeleton className="h-3 w-full bg-muted rounded-full" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16 bg-muted rounded-xl" />
            <Skeleton className="h-16 bg-muted rounded-xl" />
            <Skeleton className="h-16 bg-muted rounded-xl" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function DataReviewStep({ onComplete, onBack }: DataReviewStepProps) {
  const { completeness, loading, refresh } = useEPRDataCompleteness()
  const isRefreshing = loading && completeness !== null

  if (loading && !completeness) {
    return <LoadingSkeleton />
  }

  const pct = completeness?.completeness_pct ?? 0
  const total = completeness?.total_packaging_items ?? 0
  const complete = completeness?.complete_items ?? 0
  const incomplete = completeness?.incomplete_items ?? 0
  const gaps = completeness?.gaps ?? []
  const colors = getCompletenessColor(pct)
  const isAllComplete = pct === 100

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-neon-lime/20 backdrop-blur-md border border-neon-lime/30 rounded-2xl flex items-center justify-center">
            <Package className="w-8 h-8 text-neon-lime" />
          </div>
          <h3 className="text-xl font-serif font-bold text-foreground">
            Packaging Data Review
          </h3>
          <p className="text-sm text-muted-foreground">
            Check that all your packaging items have the required EPR fields filled in.
          </p>
        </div>

        {/* Completeness Card */}
        <div className="bg-muted/50 backdrop-blur-md border border-border rounded-2xl p-6 space-y-5">
          {/* Large Percentage */}
          <div className="text-center">
            <span className={`text-5xl font-bold tabular-nums ${colors.text}`}>
              {pct}%
            </span>
            <p className="text-sm text-muted-foreground mt-1">data completeness</p>
          </div>

          {/* Progress Bar */}
          <Progress
            value={pct}
            className="h-3"
            indicatorClassName={colors.indicator}
          />

          {/* Stats Strip */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-muted/30 border border-border/50 rounded-xl py-3 px-2">
              <p className="text-lg font-semibold text-foreground tabular-nums">{total}</p>
              <p className="text-[11px] text-muted-foreground">Total items</p>
            </div>
            <div className="bg-emerald-400/5 border border-emerald-400/10 rounded-xl py-3 px-2">
              <p className="text-lg font-semibold text-emerald-400 tabular-nums">{complete}</p>
              <p className="text-[11px] text-muted-foreground">Complete</p>
            </div>
            <div className="bg-amber-400/5 border border-amber-400/10 rounded-xl py-3 px-2">
              <p className="text-lg font-semibold text-amber-400 tabular-nums">{incomplete}</p>
              <p className="text-[11px] text-muted-foreground">Incomplete</p>
            </div>
          </div>
        </div>

        {/* Success State */}
        {isAllComplete && (
          <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-2xl p-5 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-400">
                All packaging data is complete!
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                You&apos;re ready to proceed to the next step.
              </p>
            </div>
          </div>
        )}

        {/* Gaps List */}
        {gaps.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-medium text-muted-foreground">
                  Items needing attention
                </h4>
              </div>
              <span className="text-xs text-muted-foreground/70">
                Click to edit in Products
              </span>
            </div>

            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20">
              {gaps.map((gap) => (
                <GapRow key={gap.product_material_id} gap={gap} />
              ))}
            </div>
          </div>
        )}

        {/* Refresh + Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={refresh}
              disabled={isRefreshing}
              className="text-muted-foreground hover:text-foreground hover:bg-muted text-sm"
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              Refresh
            </Button>
            <Button
              onClick={onComplete}
              className="bg-neon-lime text-black hover:bg-neon-lime/80 font-medium rounded-xl"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
