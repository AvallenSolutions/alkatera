'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization } from '@/lib/organizationContext'
import { Panel } from '@/components/studio'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StateChip } from '@/components/studio/state-chip'
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
  Link2, Link2Off, RefreshCcw, ExternalLink, MoreHorizontal,
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

interface UnleashedConnectionCardProps {
  connection?: ConnectionRow
  onChanged: () => void
}

export function UnleashedConnectionCard({ connection, onChanged }: UnleashedConnectionCardProps) {
  const { currentOrganization } = useOrganization()
  const router = useRouter()
  const orgId = currentOrganization?.id
  const [dialogOpen, setDialogOpen] = useState(false)
  const [apiId, setApiId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  const isConnected = connection?.status === 'active'
  const inError = connection?.status === 'error' || connection?.sync_status === 'error'

  const handleConnect = async () => {
    if (!orgId || !apiId || !apiKey) return
    setConnecting(true)
    try {
      const res = await fetch('/api/integrations/unleashed/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId, apiId, apiKey }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Connection failed')
      }
      toast.success('Unleashed connected', { description: 'Running your first sync now…' })
      setDialogOpen(false)
      setApiId('')
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
      const res = await fetch('/api/integrations/unleashed/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Sync failed')
      onChanged()
      if (!quiet) {
        toast.success('Sync complete', {
          description: `${body.productsUpserted ?? 0} products · ${body.bomLinesUpserted ?? 0} BoM lines · ${body.suppliersUpserted ?? 0} suppliers`,
        })
      }
    } catch (err: any) {
      toast.error(err.message || 'Sync failed')
      onChanged()
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    if (!orgId) return
    setDisconnecting(true)
    try {
      const res = await fetch(`/api/integrations/unleashed/disconnect?organizationId=${orgId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Disconnect failed')
      }
      toast.success('Unleashed disconnected')
      setConfirmDisconnect(false)
      onChanged()
    } catch (err: any) {
      toast.error(err.message || 'Disconnect failed')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Panel flush>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">Unleashed</p>
              {isConnected && <StateChip tone="good">Connected</StateChip>}
              {inError && <StateChip tone="attention">Needs attention</StateChip>}
              <StateChip tone="quiet">Beta</StateChip>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">
              Pull SKUs, Bills of Materials, suppliers and purchase orders. Auto-builds the LCA recipe for each finished product so you start with a draft footprint, not a blank page.
            </p>
            {connection?.last_sync_at && (
              <p className="text-[11px] text-muted-foreground">
                Last sync {new Date(connection.last_sync_at).toLocaleString()}
              </p>
            )}
            {connection?.sync_error && (
              <p className="text-[11px] text-studio-attention">{connection.sync_error}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isConnected && !inError && (
              <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
                <Link2 className="h-4 w-4" /> Connect
              </Button>
            )}
            {(isConnected || inError) && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSync(false)}
                  disabled={syncing}
                  className="gap-1.5"
                >
                  <RefreshCcw className="h-4 w-4" />
                  {syncing ? 'Syncing' : 'Sync now'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push('/settings/integrations/unleashed')}
                  className="gap-1.5"
                >
                  Open <ExternalLink className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setDialogOpen(true)}>
                      Update credentials
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setConfirmDisconnect(true)}
                    >
                      <Link2Off className="mr-2 h-4 w-4" /> Disconnect
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Unleashed</DialogTitle>
              <DialogDescription>
                In Unleashed, go to <span className="font-medium">Integration → Unleashed API Access</span>{' '}
                to find your API ID and API Key. Both are required.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="unleashed-api-id">API ID</Label>
                <Input
                  id="unleashed-api-id"
                  value={apiId}
                  onChange={(e) => setApiId(e.target.value.trim())}
                  placeholder="e.g. 6ad3-…-9b2c"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unleashed-api-key">API Key</Label>
                <Input
                  id="unleashed-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value.trim())}
                  placeholder="Long base64 string"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Credentials are stored encrypted (AES-256-GCM) and never leave alka<strong>tera</strong>'s server.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConnect} disabled={connecting || !apiId || !apiKey}>
                  {connecting ? 'Connecting' : 'Connect'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect Unleashed?</AlertDialogTitle>
              <AlertDialogDescription>
                Synced data stays in alka<strong>tera</strong>; only the connection is removed. You can reconnect any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting' : 'Disconnect'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Panel>
  )
}
