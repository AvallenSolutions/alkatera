'use client'

/**
 * The duplicate-data notice as quiet hairline rows with an attention-tone
 * chip, not an amber banner. Detection, acknowledge and dismiss behaviour
 * are unchanged.
 */

import { useState, useEffect } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { StateChip } from '@/components/studio/state-chip'
import { PillButton } from '@/components/studio/pill-button'
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
    <div className="border-b border-studio-hairline pb-3">
      <div className="flex items-baseline gap-2 py-2">
        <span className="font-display text-sm font-semibold text-foreground">
          Potential duplicate data detected
        </span>
        <StateChip tone="attention">CHECK BEFORE COUNTING</StateChip>
      </div>
      <p className="text-xs text-muted-foreground">
        Some Xero spend categories overlap with data you have already entered. Review below to
        avoid double-counting.
      </p>

      <div className="mt-2">
        {visibleOverlaps.map(overlap => (
          <div
            key={overlap.category}
            className="flex items-start justify-between gap-3 border-t border-studio-hairline py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{overlap.message}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
                XERO SPEND · {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(overlap.xeroSpend)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <PillButton
                variant="ghost"
                size="sm"
                onClick={() => handleAcknowledge(overlap.category)}
                title="Keep both - I have checked and there is no overlap"
              >
                Keep both
              </PillButton>
              <PillButton
                variant="outline"
                size="sm"
                onClick={() => handleDismiss(overlap.category)}
                title="Keep your utility/manual data and dismiss the Xero spend transactions for this category"
              >
                Use utility data only
              </PillButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
