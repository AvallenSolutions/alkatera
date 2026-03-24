'use client'

/**
 * Inline duplicate warning shown on the Scope 1/2 page when Xero spend-based
 * energy data overlaps with facility-level utility meter readings.
 *
 * Unlike the DuplicateWarningBanner in ActionCentre, this component:
 * - Filters to a specific scope (1 or 2)
 * - Filters to the selected reporting period
 * - Shows a compact alert directly above the scope total
 */

import { useState, useEffect } from 'react'
import { AlertTriangle, X, Eye } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import {
  detectOverlaps,
  acknowledgeOverlap,
  dismissOverlappingTransactions,
  type OverlapResult,
} from '@/lib/xero/duplicate-detector'
import { XERO_TO_SCOPE_CARD_MAP } from '@/lib/xero/scope-card-mapping'

interface ScopeDuplicateWarningProps {
  scope: 1 | 2
  yearStart: string
  yearEnd: string
  onDismissed?: () => void
}

export function ScopeDuplicateWarning({
  scope,
  yearStart,
  yearEnd,
  onDismissed,
}: ScopeDuplicateWarningProps) {
  const { currentOrganization } = useOrganization()
  const [overlaps, setOverlaps] = useState<OverlapResult[]>([])
  const [dismissedCategories, setDismissedCategories] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function check() {
      if (!currentOrganization?.id) return
      try {
        const results = await detectOverlaps(
          supabase,
          currentOrganization.id,
          yearStart,
          yearEnd
        )
        // Filter to only overlaps for this scope
        const scopeCategories = Object.entries(XERO_TO_SCOPE_CARD_MAP)
          .filter(([, mapping]) => mapping.scope === scope)
          .map(([cat]) => cat)

        const scopeOverlaps = results.filter(o => scopeCategories.includes(o.category))
        setOverlaps(scopeOverlaps)
      } catch (err) {
        console.error('[ScopeDuplicateWarning] Detection failed:', err)
      } finally {
        setIsLoading(false)
      }
    }
    check()
  }, [currentOrganization?.id, scope, yearStart, yearEnd])

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
    <Alert className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription>
        <div className="space-y-2">
          {visibleOverlaps.map(overlap => (
            <div key={overlap.category} className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-amber-900 dark:text-amber-100">
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
                  title="Keep your utility data and dismiss the Xero spend transactions"
                >
                  <X className="h-3 w-3 mr-1" />
                  Use utility data only
                </Button>
              </div>
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  )
}
