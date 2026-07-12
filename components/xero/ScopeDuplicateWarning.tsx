'use client'

/**
 * Inline duplicate warning shown on the emissions page when Xero
 * spend-based energy data overlaps with facility-level utility meter
 * readings.
 *
 * Unlike the DuplicateWarningBanner in ActionCentre, this component:
 * - Filters to a specific scope (1 or 2)
 * - Filters to the selected reporting period
 * - Sits quietly under the scope's fact row (studio re-cut: a hairline
 *   panel, a working-tone chip and two typographic actions, no icons)
 */

import { useState, useEffect } from 'react'
import { StateChip } from '@/components/studio/state-chip'
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
    <div className="rounded-[6px] border border-studio-hairline bg-studio-cream px-4 py-3">
      <div className="divide-y divide-studio-hairline">
        {visibleOverlaps.map(overlap => (
          <div
            key={overlap.category}
            className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-2 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex-1">
              <StateChip tone="attention">Possible double count</StateChip>
              <p className="mt-1 text-sm text-foreground">{overlap.message}</p>
              <p className="mt-0.5 text-xs text-studio-dim">
                Xero spend: {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(overlap.xeroSpend)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <button
                type="button"
                className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim transition-colors hover:text-foreground"
                onClick={() => handleAcknowledge(overlap.category)}
                title="Keep both: I have checked and there is no overlap"
              >
                Keep both
              </button>
              <button
                type="button"
                className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-attention transition-colors hover:text-foreground"
                onClick={() => handleDismiss(overlap.category)}
                title="Keep your utility data and dismiss the Xero spend transactions"
              >
                Use utility data only
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
