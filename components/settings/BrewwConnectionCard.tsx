'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization } from '@/lib/organizationContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  Link2, Link2Off, Loader2, CheckCircle2, AlertTriangle, RefreshCcw, ExternalLink, MoreHorizontal,
} from 'lucide-react'

interface ConnectionRow {
  id: string
  provider_slug: string
  status: 'active' | 'error' | 'disconnected'
  last_sync_at: string | null
  sync_status: 'idle' | 'syncing' | 'error' | null
  sync_error: string | null
  connected_at: string
  metadata: Record<string, any>
}

interface BrewwConnectionCardProps {
  connection?: ConnectionRow
  onChanged: () => void
}

export function BrewwConnectionCard({ connection, onChanged }: BrewwConnectionCardProps) {
  const { currentOrganization } = useOrganization()
  const router = useRouter()
  const orgId = currentOrganization?.id
  const [dialogOpen, setDialogOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncPhase, setSyncPhase] = useState<{ label: string; index: number; total: number } | null>(null)
  const [rebuilding, setRebuilding] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [showErrorDetails, setShowErrorDetails] = useState(false)

  const isConnected = connection?.status === 'active'
  const inError = connection?.status === 'error' || connection?.sync_status === 'error'

  const handleConnect = async () => {
    if (!orgId || !apiKey) return
    setConnecting(true)
    try {
      const res = await fetch('/api/integrations/breww/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId, apiKey }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Connection failed')
      }
      toast.success('Breww connected', { description: 'Running your first sync now...' })
      setDialogOpen(false)
      setApiKey('')
      onChanged()
      handleSync(true)
    } catch (err: any) {
      toast.error(err.message || 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  const handleSync = async (quiet = false) => {
    if (!orgId) return
    setSyncing(true)
    setSyncPhase(null)

    const notifyDone = (body: any) => {
      if (quiet) return
      const hl = body?.totalHl?.toFixed?.(1) ?? '0'
      const skus = body?.skusUpserted ?? 0
      const ing = body?.ingredientsUpserted ?? 0
      const ct = body?.containerTypesUpserted ?? 0
      toast.success('Synced Breww data', {
        description: `${skus} products · ${hl} hL · ${ing} ingredients · ${ct} packaging types`,
      })
    }

    // Try SSE stream first for live progress; fall back to one-shot POST.
    try {
      const res = await fetch(`/api/integrations/breww/sync/stream?organizationId=${orgId}`)
      if (!res.ok || !res.body) throw new Error('stream_unavailable')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalResult: any = null
      let streamError: string | null = null

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.split('\n').find((l) => l.startsWith('data:'))
          if (!line) continue
          try {
            const evt = JSON.parse(line.slice(5).trim())
            if (evt.type === 'phase') {
              setSyncPhase({ label: evt.label, index: evt.index, total: evt.total })
            } else if (evt.type === 'done') {
              finalResult = evt.result
            } else if (evt.type === 'error') {
              streamError = evt.message || 'Sync failed'
            }
          } catch { /* ignore */ }
        }
      }

      if (streamError) throw new Error(streamError)
      notifyDone(finalResult)
      onChanged()
    } catch (err: any) {
      if (err?.message && err.message !== 'stream_unavailable') {
        toast.error('Sync failed', { description: err.message })
      } else {
        // Fallback: one-shot sync.
        try {
          const res = await fetch('/api/integrations/breww/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organizationId: orgId }),
          })
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            throw new Error(body.error || 'Sync failed')
          }
          const body = await res.json()
          notifyDone(body)
          onChanged()
        } catch (err2: any) {
          toast.error('Sync failed', { description: err2.message || 'Please try again' })
        }
      }
    } finally {
      setSyncing(false)
      setSyncPhase(null)
    }
  }

  const handleRebuildPackaging = async () => {
    if (!orgId) return
    setRebuilding(true)
    try {
      const res = await fetch('/api/integrations/breww/rebuild-packaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Rebuild failed')
      toast.success('Packaging rebuilt', {
        description: `${body.processed} product${body.processed === 1 ? '' : 's'} updated with latest container defaults`,
      })
    } catch (err: any) {
      toast.error('Rebuild failed', { description: err.message || 'Please try again' })
    } finally {
      setRebuilding(false)
    }
  }

  const handleDisconnect = async () => {
    if (!orgId) return
    setDisconnecting(true)
    try {
      const res = await fetch(`/api/integrations/breww/disconnect?organizationId=${orgId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Disconnect failed')
      }
      toast.success('Breww disconnected')
      setConfirmDisconnect(false)
      onChanged()
    } catch (err: any) {
      toast.error(err.message || 'Disconnect failed')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <>
      <Card className={inError ? 'border-amber-500/40' : undefined}>
        <CardContent className="p-5 flex flex-col sm:flex-row items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-[#ccff00]/15 flex items-center justify-center flex-shrink-0">
            <Link2 className="h-5 w-5 text-[#8da300] dark:text-[#ccff00]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">Breww</p>
              <Badge
                variant="outline"
                className={
                  isConnected
                    ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[10px]'
                    : inError
                      ? 'border-amber-500/40 text-amber-700 dark:text-amber-300 text-[10px]'
                      : 'text-[10px]'
                }
              >
                {isConnected ? 'Connected' : inError ? 'Error' : 'Available'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Syncs production volumes, batch ingredients and packaging types from your Breww account. Links to your alka<strong>tera</strong> products and facilities so recipes and footprints update automatically.
            </p>
            {isConnected && connection?.last_sync_at && (
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Last synced {new Date(connection.last_sync_at).toLocaleString()}
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/settings/integrations/breww')}
                  className="text-[11px] text-[#8da300] dark:text-[#ccff00] flex items-center gap-1 hover:underline"
                >
                  View synced data
                  <ExternalLink className="h-2.5 w-2.5" />
                </button>
              </div>
            )}
            {inError && connection?.sync_error && (
              <div className="mt-2">
                <div className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  <span>Sync failed. </span>
                  <button
                    type="button"
                    onClick={() => setShowErrorDetails((v) => !v)}
                    className="underline"
                  >
                    {showErrorDetails ? 'Hide' : 'Show'} technical details
                  </button>
                </div>
                {showErrorDetails && (
                  <div className="mt-1.5 flex items-start gap-2">
                    <pre className="flex-1 whitespace-pre-wrap text-[11px] font-mono bg-muted/50 rounded border p-2 overflow-x-auto max-h-32 overflow-y-auto">
                      {connection.sync_error}
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        navigator.clipboard.writeText(connection.sync_error || '')
                        toast.success('Copied error to clipboard')
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!isConnected ? (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                Connect
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSync()}
                  disabled={syncing}
                  className="gap-1.5"
                >
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                  {syncing && syncPhase
                    ? `${syncPhase.label} (${syncPhase.index + 1}/${syncPhase.total})`
                    : 'Sync now'}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={handleRebuildPackaging}
                      disabled={rebuilding}
                    >
                      {rebuilding ? (
                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      ) : (
                        <RefreshCcw className="h-3.5 w-3.5 mr-2" />
                      )}
                      Rebuild packaging
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setConfirmDisconnect(true)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Link2Off className="h-3.5 w-3.5 mr-2" />
                      Disconnect
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Connect dialog */}
      <Dialog open={dialogOpen} onOpenChange={(next) => { if (!connecting) setDialogOpen(next) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Breww</DialogTitle>
            <DialogDescription>
              Generate an API key from your Breww account settings and paste it below. It&apos;ll be stored encrypted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="breww-api-key">Breww API key</Label>
              <Input
                id="breww-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="brw_..."
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConnect()
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                Breww → Settings → Breww Apps &amp; API → create a Private app → generate a read-only key.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={connecting}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConnect} disabled={connecting || !apiKey}>
                {connecting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                Test &amp; save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disconnect confirmation */}
      <AlertDialog open={confirmDisconnect} onOpenChange={(next) => { if (!disconnecting) setConfirmDisconnect(next) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Breww?</AlertDialogTitle>
            <AlertDialogDescription>
              Your synced data stays in place. Links between Breww SKUs and your alka<strong>tera</strong> products remain intact, so reconnecting later will pick up where you left off. You&apos;ll just stop receiving fresh data until you reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Keep connected</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDisconnect() }}
              disabled={disconnecting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {disconnecting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
