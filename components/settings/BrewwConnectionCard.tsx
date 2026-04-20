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
import { toast } from 'sonner'
import {
  Link2, Link2Off, Loader2, CheckCircle2, AlertTriangle, RefreshCcw, ExternalLink,
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
  const [disconnecting, setDisconnecting] = useState(false)

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
      toast.success('Breww connected — running first sync')
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
      if (!quiet) {
        const hl = body.totalHl?.toFixed?.(1) ?? '0'
        const runs = body.runsUpserted ?? 0
        const ing = body.ingredientsUpserted ?? 0
        const ct = body.containerTypesUpserted ?? 0
        toast.success(
          `Synced ${runs} product-months (${hl} hL), ${ing} ingredient records, ${ct} container types`,
        )
      }
      onChanged()
    } catch (err: any) {
      toast.error(err.message || 'Sync failed')
    } finally {
      setSyncing(false)
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
              Syncs production volumes, batch ingredients, and packaging types from your Breww account.
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
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" />
                {connection.sync_error.slice(0, 160)}
              </p>
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
                  Sync now
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-muted-foreground hover:text-red-500 gap-1.5"
                >
                  {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2Off className="h-3.5 w-3.5" />}
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

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
                placeholder="brw_…"
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
    </>
  )
}
