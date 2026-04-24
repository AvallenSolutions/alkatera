'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { runXeroSync } from '@/lib/xero/run-sync'

interface SyncDataButtonProps {
  onComplete?: () => void
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'outline' | 'secondary'
}

export function SyncDataButton({ onComplete, size = 'default', variant = 'default' }: SyncDataButtonProps) {
  const { currentOrganization } = useOrganization()
  const [isSyncing, setIsSyncing] = useState(false)
  const [progress, setProgress] = useState('')

  async function handleClick() {
    if (!currentOrganization?.id || isSyncing) return

    setIsSyncing(true)
    setProgress('Starting sync...')

    try {
      const result = await runXeroSync(currentOrganization.id, (p) => {
        setProgress(p.message)
      })

      const base = `Sync complete: ${result.totalFetched} transactions imported, ${result.totalClassified} classified`
      if (result.unclassifiedCount > 0) {
        toast.success(base, {
          description: `${result.unclassifiedCount} transaction${result.unclassifiedCount !== 1 ? 's' : ''} still need classification.`,
          duration: 8000,
        })
      } else {
        toast.success(`${base}. All transactions categorised.`)
      }

      onComplete?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed'
      toast.error(message)
    } finally {
      setIsSyncing(false)
      setProgress('')
    }
  }

  return (
    <Button onClick={handleClick} disabled={isSyncing} size={size} variant={variant}>
      {isSyncing ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-2" />
      )}
      {isSyncing ? (progress || 'Syncing...') : 'Sync Data'}
    </Button>
  )
}
