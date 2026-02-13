'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useEPRDataCompleteness } from '@/hooks/data/useEPRDataCompleteness'
import type { EPRDataCompletenessResult } from '@/lib/epr/types'

interface ValidationStepProps {
  onComplete: () => void
  onBack: () => void
  onSkip?: () => void
}

export function ValidationStep({ onComplete, onBack }: ValidationStepProps) {
  const { completeness, loading, error, refresh } = useEPRDataCompleteness()
  const [refreshing, setRefreshing] = useState(false)

  const pct = completeness?.completeness_pct ?? 0
  const isComplete = pct === 100
  const totalItems = completeness?.total_packaging_items ?? 0
  const completeItems = completeness?.complete_items ?? 0
  const incompleteItems = completeness?.incomplete_items ?? 0
  const gaps = completeness?.gaps ?? []

  const handleRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  // Group gaps by product for cleaner display
  const gapsByProduct = gaps.reduce<
    Record<string, { productName: string; items: typeof gaps }>
  >((acc, gap) => {
    const key = String(gap.product_id)
    if (!acc[key]) {
      acc[key] = { productName: gap.product_name, items: [] }
    }
    acc[key].items.push(gap)
    return acc
  }, {})

  if (loading && !completeness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 animate-in fade-in duration-500">
        <Loader2 className="w-8 h-8 text-[#ccff00] animate-spin" />
        <p className="text-white/60 text-sm">Checking data completeness...</p>
      </div>
    )
  }

  if (error && !completeness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 animate-in fade-in duration-500">
        <XCircle className="w-10 h-10 text-red-400" />
        <p className="text-white/60 text-sm">{error}</p>
        <Button
          variant="ghost"
          onClick={handleRefresh}
          className="text-white/40 hover:text-white hover:bg-white/10"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">
          Data Validation
        </h2>
        <p className="text-white/60 text-sm max-w-md mx-auto">
          Checking that every packaging item has the required EPR fields
          completed before generating your submission.
        </p>
      </div>

      {/* Completeness Score */}
      <Card className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col items-center gap-6">
            {/* Percentage circle */}
            <div className="relative w-32 h-32">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={isComplete ? '#22c55e' : '#ccff00'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${pct * 2.639} ${263.9 - pct * 2.639}`}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white">{pct}%</span>
                <span className="text-xs text-white/40">Complete</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full max-w-sm space-y-2">
              <Progress
                value={pct}
                indicatorColor={isComplete ? 'emerald' : 'lime'}
                className="h-3 bg-white/5"
              />
              <div className="flex justify-between text-xs text-white/40">
                <span>
                  {completeItems} of {totalItems} items complete
                </span>
                {incompleteItems > 0 && (
                  <span className="text-amber-400">
                    {incompleteItems} need attention
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Banner */}
      {isComplete ? (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-400">
              All packaging data is complete!
            </p>
            <p className="text-xs text-emerald-400/70 mt-1">
              You&apos;re ready to generate your submission.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400">
              Some packaging items are missing EPR data
            </p>
            <p className="text-xs text-amber-400/70 mt-1">
              Please complete them before generating your submission.{' '}
              <button
                onClick={onBack}
                className="underline hover:text-amber-300 transition-colors"
              >
                Go to Data Review
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Per-Product Status List */}
      {totalItems > 0 && (
        <Card className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Packaging Item Status
              </h3>
              <Badge
                variant="outline"
                className="text-xs border-white/10 text-white/40"
              >
                {totalItems} items
              </Badge>
            </div>

            <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
              {/* Complete items summary */}
              {completeItems > 0 && gaps.length > 0 && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-emerald-500/5 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-white/70">
                    {completeItems} item{completeItems !== 1 ? 's' : ''} fully
                    complete
                  </span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/50 ml-auto" />
                </div>
              )}

              {/* Show all-complete when 100% */}
              {isComplete && (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-white/60">
                    All {totalItems} packaging items have complete EPR data.
                  </p>
                </div>
              )}

              {/* Incomplete items by product */}
              {Object.entries(gapsByProduct).map(
                ([productId, { productName, items }]) => (
                  <div key={productId} className="mb-3">
                    <p className="text-xs font-medium text-white/50 px-3 py-1.5 uppercase tracking-wide">
                      {productName}
                    </p>
                    {items.map((gap) => (
                      <div
                        key={gap.product_material_id}
                        className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/80 truncate">
                            {gap.material_name}
                          </p>
                          <p className="text-xs text-red-400/70 mt-0.5">
                            Missing: {gap.missing_fields.join(', ')}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-red-400/20 text-red-400/60 flex-shrink-0"
                        >
                          {gap.missing_fields.length} field
                          {gap.missing_fields.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-white/40 hover:text-white hover:bg-white/10"
        >
          Back
        </Button>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-white/40 hover:text-white hover:bg-white/10"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>

          <Button
            onClick={onComplete}
            disabled={!isComplete}
            className="bg-[#ccff00] text-black hover:bg-[#b8e600] font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
