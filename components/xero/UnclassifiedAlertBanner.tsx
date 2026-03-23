'use client'

import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, X, Settings, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

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
    <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              {count} {count === 1 ? 'transaction needs' : 'transactions need'} classification
            </h4>
            <Badge variant="outline" className="text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 text-xs">
              Unclassified
            </Badge>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            These transactions couldn&apos;t be automatically classified. Map your Xero accounts or use AI classification to categorise them.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              asChild
            >
              <Link href="/settings?tab=integrations">
                <Settings className="h-3 w-3 mr-1" />
                Map Accounts
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              asChild
            >
              <a href="#ai-classification">
                <Sparkles className="h-3 w-3 mr-1" />
                Classify with AI
              </a>
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
