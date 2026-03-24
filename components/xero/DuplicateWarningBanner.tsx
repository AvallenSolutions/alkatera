'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, X, Check, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import {
  detectOverlaps,
  acknowledgeOverlap,
  dismissOverlappingTransactions,
  type OverlapResult,
} from '@/lib/xero/duplicate-detector'

interface DuplicateWarningBannerProps {
  onDismissed?: () => void
}

export function DuplicateWarningBanner({ onDismissed }: DuplicateWarningBannerProps) {
  const { currentOrganization } = useOrganization()
  const [overlaps, setOverlaps] = useState<OverlapResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dismissedCategories, setDismissedCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function check() {
      if (!currentOrganization?.id) return
      try {
        const results = await detectOverlaps(supabase, currentOrganization.id)
        setOverlaps(results)
      } catch (err) {
        console.error('[DuplicateWarning] Detection failed:', err)
      } finally {
        setIsLoading(false)
      }
    }
    check()
  }, [currentOrganization?.id])

  async function handleDismiss(category: string) {
    if (!currentOrganization?.id) return
    await dismissOverlappingTransactions(supabase, currentOrganization.id, category)
    setDismissedCategories(prev => {
      const next = new Set(prev)
      next.add(category)
      return next
    })
    onDismissed?.()
  }

  async function handleAcknowledge(category: string) {
    if (!currentOrganization?.id) return
    await acknowledgeOverlap(supabase, currentOrganization.id, category)
    setDismissedCategories(prev => {
      const next = new Set(prev)
      next.add(category)
      return next
    })
  }

  const visibleOverlaps = overlaps.filter(o => !dismissedCategories.has(o.category))

  if (isLoading || visibleOverlaps.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Potential duplicate data detected
          </h4>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            Some Xero spend categories overlap with data you have already entered. Review below to avoid double-counting.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {visibleOverlaps.map(overlap => (
          <div
            key={overlap.category}
            className="flex items-start justify-between gap-3 p-2.5 rounded-md bg-white dark:bg-slate-900/50 border border-amber-200 dark:border-amber-800"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-900 dark:text-slate-100">
                {overlap.message}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Xero spend: {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(overlap.xeroSpend)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleAcknowledge(overlap.category)}
                title="Keep both - I have checked and there is no overlap"
              >
                <Eye className="h-3 w-3 mr-1" />
                Keep both
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                onClick={() => handleDismiss(overlap.category)}
                title="Keep your utility/manual data and dismiss the Xero spend transactions for this category"
              >
                <X className="h-3 w-3 mr-1" />
                Use utility data only
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
