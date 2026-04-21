'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AlertTriangle, CheckCircle2, Loader2, MoreHorizontal, RefreshCcw } from 'lucide-react'

interface SyncStatusStripProps {
  status: 'active' | 'error' | 'disconnected' | 'unknown'
  lastSyncAt: string | null
  syncStatus: 'idle' | 'syncing' | 'error' | null
  syncError: string | null
  syncing: boolean
  onSync: () => void
  onRebuildPackaging: () => void
  onDisconnect: () => void
  progressLabel?: string | null
  counts: {
    label: string
    current: number
    total: number
    onClick?: () => void
  }[]
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'never'
  const diff = Date.now() - t
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString()
}

// Horizontal strip showing connection health, last-sync time, and link progress.
// Lives above the tabs on the Breww data page.
export function SyncStatusStrip({
  status,
  lastSyncAt,
  syncStatus,
  syncError,
  syncing,
  onSync,
  onRebuildPackaging,
  onDisconnect,
  progressLabel,
  counts,
}: SyncStatusStripProps) {
  const inError = status === 'error' || syncStatus === 'error'

  const statusDot = useMemo(() => {
    if (syncing || syncStatus === 'syncing') {
      return <Loader2 className="h-3 w-3 animate-spin text-[#8da300] dark:text-[#ccff00]" />
    }
    if (inError) return <AlertTriangle className="h-3 w-3 text-amber-500" />
    if (status === 'active') return <CheckCircle2 className="h-3 w-3 text-emerald-500" />
    return <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />
  }, [syncing, syncStatus, inError, status])

  const statusLabel = syncing || syncStatus === 'syncing'
    ? (progressLabel || 'Syncing...')
    : inError
      ? 'Sync error'
      : status === 'active'
        ? 'Connected'
        : 'Not connected'

  return (
    <div className={`rounded-lg border p-3 ${inError ? 'border-amber-500/40 bg-amber-500/5' : 'bg-muted/30'}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Status + last sync */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 text-xs font-medium">
            {statusDot}
            {statusLabel}
          </span>
          {!syncing && syncStatus !== 'syncing' && (
            <span className="text-xs text-muted-foreground">
              · Last synced {relativeTime(lastSyncAt)}
            </span>
          )}
        </div>

        {/* Progress counts */}
        {counts.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            {counts.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={c.onClick}
                disabled={!c.onClick}
                className="text-xs text-muted-foreground hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground transition-colors"
              >
                <span className="font-medium tabular-nums text-foreground">
                  {c.current}/{c.total}
                </span>{' '}
                {c.label}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant={inError ? 'default' : 'outline'}
            onClick={onSync}
            disabled={syncing}
            className="gap-1.5"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Sync now
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRebuildPackaging}>
                Rebuild packaging
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDisconnect} className="text-red-600 focus:text-red-600">
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Error detail (full, not truncated) */}
      {inError && syncError && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-amber-700 dark:text-amber-300">
            Show technical details
          </summary>
          <div className="mt-1.5 flex items-start gap-2">
            <pre className="flex-1 whitespace-pre-wrap text-[11px] font-mono bg-background/60 rounded border p-2 overflow-x-auto max-h-40 overflow-y-auto">{syncError}</pre>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px]"
              onClick={() => {
                navigator.clipboard.writeText(syncError)
              }}
            >
              Copy
            </Button>
          </div>
        </details>
      )}
    </div>
  )
}
