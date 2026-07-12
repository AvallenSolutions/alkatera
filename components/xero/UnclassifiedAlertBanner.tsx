'use client'

/**
 * The unclassified-transactions notice as a quiet hairline row with an
 * attention-tone chip and mono actions, not an amber banner. Same query
 * and dismissal behaviour as before.
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { StateChip } from '@/components/studio/state-chip'

interface UnclassifiedAlertBannerProps {
  organizationId: string
}

export function UnclassifiedAlertBanner({ organizationId }: UnclassifiedAlertBannerProps) {
  const [count, setCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isDismissed, setIsDismissed] = useState(false)
  const prevCountRef = useRef<number | null>(null)

  const storageKey = `xero-unclassified-dismissed-${organizationId}`

  useEffect(() => {
    async function fetchCount() {
      const { count: total, error } = await supabase
        .from('xero_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .is('emission_category', null)
        .eq('upgrade_status', 'not_applicable')

      if (error) {
        console.error('[UnclassifiedAlert] Query failed:', error)
        setIsLoading(false)
        return
      }

      const newCount = total ?? 0
      setCount(newCount)

      // Reset dismissed state if count changed
      if (prevCountRef.current !== null && prevCountRef.current !== newCount) {
        localStorage.removeItem(storageKey)
        setIsDismissed(false)
      } else {
        setIsDismissed(localStorage.getItem(storageKey) === 'true')
      }

      prevCountRef.current = newCount
      setIsLoading(false)
    }

    // Check localStorage on first load before query completes
    setIsDismissed(localStorage.getItem(storageKey) === 'true')
    fetchCount()
  }, [organizationId, storageKey])

  if (isLoading || count === 0 || isDismissed) return null

  function handleDismiss() {
    localStorage.setItem(storageKey, 'true')
    setIsDismissed(true)
  }

  return (
    <div className="border-b border-studio-hairline py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-display text-sm font-semibold text-foreground">
            {count} {count === 1 ? 'transaction needs' : 'transactions need'} classification
          </span>
          <StateChip tone="attention">UNCLASSIFIED</StateChip>
        </div>
        <div className="flex shrink-0 items-baseline gap-4">
          <Link
            href="/settings?tab=integrations"
            className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent transition-opacity hover:opacity-70"
          >
            Map accounts
          </Link>
          <a
            href="#ai-classification"
            className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent transition-opacity hover:opacity-70"
          >
            Classify with AI
          </a>
          <button
            onClick={handleDismiss}
            className="font-mono text-xs text-studio-dim transition-colors hover:text-foreground"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        These transactions couldn&apos;t be automatically classified. Map your Xero accounts or use
        AI classification to categorise them.
      </p>
    </div>
  )
}
