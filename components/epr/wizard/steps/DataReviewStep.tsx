'use client'

import { useEPRDataCompleteness } from '@/hooks/data/useEPRDataCompleteness'
import { Button } from '@/components/ui/button'
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
      text: 'text-studio-good',
      indicator: 'bg-studio-good',
      indicatorColor: 'emerald',
      bg: 'bg-secondary',
    }
  }
  if (pct >= 50) {
    return {
      text: 'text-studio-attention',
      indicator: 'bg-studio-attention',
      indicatorColor: 'default',
      bg: 'bg-secondary',
    }
  }
  return {
    text: 'text-studio-stale',
    indicator: 'bg-studio-stale',
    indicatorColor: 'default',
    bg: 'bg-secondary',
  }
}

function GapRow({ gap }: { gap: EPRDataGap }) {
  return (
    <a
      href={`/products?highlight=${gap.product_id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start justify-between gap-3 p-3 rounded-[6px] border border-border bg-card hover:bg-secondary transition-colors group"
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
            <span key={field} className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-attention">
              {field}
            </span>
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
          <Skeleton className="mx-auto w-16 h-16 rounded-[6px] bg-muted" />
          <Skeleton className="mx-auto h-6 w-48 bg-muted rounded-lg" />
          <Skeleton className="mx-auto h-4 w-64 bg-muted rounded-lg" />
        </div>
        <div className="rounded-[6px] border border-border bg-card p-6 space-y-4">
          <div className="flex justify-center">
            <Skeleton className="h-16 w-20 bg-muted rounded-lg" />
          </div>
          <Skeleton className="h-3 w-full bg-muted rounded-full" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16 bg-muted rounded-[6px]" />
            <Skeleton className="h-16 bg-muted rounded-[6px]" />
            <Skeleton className="h-16 bg-muted rounded-[6px]" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full bg-muted rounded-[6px]" />
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
          <div className="mx-auto w-16 h-16 rounded-[6px] border border-border bg-card flex items-center justify-center">
            <Package className="w-8 h-8 text-studio-brick" />
          </div>
          <h3 className="text-xl font-display font-bold text-foreground">
            Packaging Data Review
          </h3>
          <p className="text-sm text-muted-foreground">
            Check that all your packaging items have the required EPR fields filled in.
          </p>
        </div>

        {/* Completeness Card */}
        <div className="rounded-[6px] border border-border bg-card p-6 space-y-5">
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
            <div className="rounded-[6px] border border-border bg-card py-3 px-2">
              <p className="text-lg font-semibold text-foreground tabular-nums">{total}</p>
              <p className="text-[11px] text-muted-foreground">Total items</p>
            </div>
            <div className="rounded-[6px] border border-border bg-card py-3 px-2">
              <p className="text-lg font-semibold text-studio-good tabular-nums">{complete}</p>
              <p className="text-[11px] text-muted-foreground">Complete</p>
            </div>
            <div className="rounded-[6px] border border-border bg-card py-3 px-2">
              <p className="text-lg font-semibold text-studio-attention tabular-nums">{incomplete}</p>
              <p className="text-[11px] text-muted-foreground">Incomplete</p>
            </div>
          </div>
        </div>

        {/* Success State */}
        {isAllComplete && (
          <div className="rounded-[6px] border border-border bg-card p-5 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-studio-good flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-studio-good">
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
                <AlertTriangle className="w-4 h-4 text-studio-attention" />
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
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button
              onClick={onComplete}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full"
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
