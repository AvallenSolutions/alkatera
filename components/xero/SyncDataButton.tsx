'use client'

/**
 * The sync as a margin note, the studio way: a quiet mono action reading
 * "LAST SYNCED 3 JUL · SYNC" rather than a header button. Same sync logic
 * as before (runXeroSync); the last-synced time comes from xero_connections.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { runXeroSync } from '@/lib/xero/run-sync'

interface SyncDataButtonProps {
  onComplete?: () => void
  className?: string
}

function formatSyncDay(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    .toUpperCase()
}

export function SyncDataButton({ onComplete, className }: SyncDataButtonProps) {
  const { currentOrganization } = useOrganization()
  const [isSyncing, setIsSyncing] = useState(false)
  const [progress, setProgress] = useState('')
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  useEffect(() => {
    if (!currentOrganization?.id || isSyncing) return
    let cancelled = false
    supabase
      .from('xero_connections')
      .select('last_sync_at')
      .eq('organization_id', currentOrganization.id)
      .not('last_sync_at', 'is', null)
      .order('last_sync_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (!cancelled) setLastSyncAt(data?.[0]?.last_sync_at ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [currentOrganization?.id, isSyncing])

  async function handleClick() {
    if (!currentOrganization?.id || isSyncing) return

    setIsSyncing(true)
    setProgress('Starting sync')

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

  const label = isSyncing
    ? `SYNCING · ${(progress || 'WORKING').replace(/\.+$/, '').toUpperCase()}`
    : lastSyncAt
      ? `LAST SYNCED ${formatSyncDay(lastSyncAt)} · SYNC`
      : 'NEVER SYNCED · SYNC'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSyncing}
      className={cn(
        'font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-room-accent transition-opacity duration-200 ease-studio hover:opacity-70 disabled:pointer-events-none disabled:opacity-50',
        className
      )}
    >
      {label}
    </button>
  )
}
