'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, X } from 'lucide-react'
import { useIntegrationHealth } from '@/hooks/useIntegrationHealth'
import { Button } from '@/components/ui/button'

// Session-scoped dismissal — key per set of failing providers, so a new
// failure reappears even if the user dismissed an earlier one.
function useDismissedKey() {
  const [dismissed, setDismissed] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem('integration-health-dismissed')
  })
  return {
    dismissed,
    dismiss: (key: string) => {
      sessionStorage.setItem('integration-health-dismissed', key)
      setDismissed(key)
    },
  }
}

// Shown at the top of the authenticated app when any integration is in an
// error state. One line, actionable, dismissible for the session.
export function IntegrationHealthBanner() {
  const router = useRouter()
  const unhealthy = useIntegrationHealth()
  const { dismissed, dismiss } = useDismissedKey()

  if (unhealthy.length === 0) return null
  const key = unhealthy.map((u) => u.providerSlug).sort().join(',')
  if (dismissed === key) return null

  const names = unhealthy.map((u) => u.providerName).join(', ')
  const firstError = unhealthy[0].syncError

  return (
    <div className="w-full border-b border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-medium">{names} sync failed.</span>{' '}
          <span className="text-xs opacity-80 truncate inline-block max-w-md align-bottom">
            {firstError || 'Reconnect or try syncing again.'}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs bg-white/60 dark:bg-white/5 border-amber-500/40"
          onClick={() => router.push('/settings/integrations')}
        >
          Fix in settings
        </Button>
        <button
          type="button"
          className="p-1 rounded hover:bg-amber-500/20"
          onClick={() => dismiss(key)}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
