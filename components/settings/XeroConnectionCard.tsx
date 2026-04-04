'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link2, Loader2, CheckCircle2, AlertCircle, RefreshCw, Unlink, Building2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'

interface XeroStatus {
  connected: boolean
  tenantName: string | null
  connectedAt: string | null
  lastSyncAt: string | null
  syncStatus: string | null
  syncError: string | null
}

interface XeroTenant {
  tenantId: string
  tenantName: string | null
}

export function XeroConnectionCard() {
  const router = useRouter()
  const { currentOrganization, userRole } = useOrganization()
  const isAdmin = userRole === 'owner' || userRole === 'admin'

  const [status, setStatus] = useState<XeroStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [autoSyncRequested, setAutoSyncRequested] = useState(false)

  // Tenant picker state (multi-tenant flow)
  const [showTenantPicker, setShowTenantPicker] = useState(false)
  const [pendingTenants, setPendingTenants] = useState<XeroTenant[]>([])
  const [isSelectingTenant, setIsSelectingTenant] = useState(false)

  const fetchStatus = useCallback(async () => {
    if (!currentOrganization?.id) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `/api/xero/status?organizationId=${currentOrganization.id}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      )
      if (res.ok) {
        setStatus(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch Xero status:', err)
    } finally {
      setIsLoading(false)
    }
  }, [currentOrganization?.id])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Check URL params for connection result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const xeroParam = params.get('xero')
    if (xeroParam === 'connected') {
      toast.success('Xero connected successfully. Starting sync...')
      // Clean URL immediately
      const url = new URL(window.location.href)
      url.searchParams.delete('xero')
      url.searchParams.delete('auto-sync')
      window.history.replaceState({}, '', url.toString())
      // Fetch fresh status, then auto-sync
      fetchStatus().then(() => {
        setAutoSyncRequested(true)
      })
    } else if (xeroParam === 'select-tenant') {
      // Multi-tenant flow: fetch the pending tenant list and show picker
      const url = new URL(window.location.href)
      url.searchParams.delete('xero')
      window.history.replaceState({}, '', url.toString())

      ;(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const res = await fetch('/api/xero/select-tenant', {
            headers: { Authorization: `Bearer ${session?.access_token}` },
          })
          if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || 'Failed to load Xero organisations')
          }
          const data = await res.json()
          setPendingTenants(data.tenants)
          setShowTenantPicker(true)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to load Xero organisations'
          toast.error(message)
        }
      })()
    } else if (xeroParam === 'error') {
      const message = params.get('message') || 'Failed to connect to Xero'
      toast.error(message)
      const url = new URL(window.location.href)
      url.searchParams.delete('xero')
      url.searchParams.delete('message')
      window.history.replaceState({}, '', url.toString())
    }
  }, [fetchStatus])

  // Auto-sync after fresh connection (waits for status to be loaded)
  useEffect(() => {
    if (autoSyncRequested && !isSyncing && currentOrganization?.id) {
      setAutoSyncRequested(false)
      handleSync()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncRequested, isSyncing, currentOrganization?.id])

  async function handleSelectTenant(tenantId: string) {
    setIsSelectingTenant(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/xero/select-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ tenantId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setShowTenantPicker(false)
      setPendingTenants([])
      toast.success('Xero connected successfully. Starting sync...')
      fetchStatus().then(() => {
        setAutoSyncRequested(true)
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect to Xero organisation'
      toast.error(message)
    } finally {
      setIsSelectingTenant(false)
    }
  }

  async function handleConnect() {
    if (!currentOrganization?.id) return
    setIsConnecting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/xero/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ organizationId: currentOrganization.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Redirect to Xero consent
      window.location.href = data.url
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initiate connection'
      toast.error(message)
      setIsConnecting(false)
    }
  }

  const [syncProgress, setSyncProgress] = useState<string>('')

  async function handleSync() {
    if (!currentOrganization?.id) return
    setIsSyncing(true)
    setSyncProgress('Starting sync...')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      }

      // Run stages sequentially until done
      let stage = 'accounts'
      let cursor: any = undefined
      let totalFetched = 0
      let totalClassified = 0

      while (stage) {
        setSyncProgress(`${stage.replace('_', ' ')}...`)

        const res = await fetch('/api/xero/sync', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            organizationId: currentOrganization.id,
            stage,
            cursor,
          }),
        })

        let data
        try {
          data = await res.json()
        } catch {
          // Function crashed (502 HTML response) - skip this stage gracefully
          console.error(`Sync stage '${stage}' returned non-JSON response (status ${res.status})`)
          if (stage === 'ai_classify' || stage === 'classify') {
            // Classification is optional - skip to complete
            console.warn(`Skipping '${stage}' stage due to server error`)
            stage = 'complete'
            cursor = undefined
            continue
          }
          throw new Error(`Sync failed at stage '${stage}' (server error)`)
        }
        if (!res.ok) throw new Error(data.error || `Sync failed at stage '${stage}'`)

        setSyncProgress(data.progress || stage)

        if (data.stats?.transactionsFetched) totalFetched += data.stats.transactionsFetched
        if (data.stats?.transactionsClassified) totalClassified += data.stats.transactionsClassified

        if (data.done) break
        stage = data.nextStage || ''
        cursor = data.cursor
      }

      // Check for remaining unclassified transactions
      const { count: unclassifiedCount } = await supabase
        .from('xero_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .is('emission_category', null)
        .eq('upgrade_status', 'not_applicable')

      if (unclassifiedCount && unclassifiedCount > 0) {
        toast.success(
          `Sync complete: ${totalFetched} transactions imported, ${totalClassified} classified`,
          {
            description: `${unclassifiedCount} transaction${unclassifiedCount !== 1 ? 's' : ''} still need classification. Redirecting...`,
            duration: 8000,
          }
        )
      } else {
        toast.success(
          `Sync complete: ${totalFetched} transactions imported, ${totalClassified} classified. All transactions categorised. Redirecting...`
        )
      }
      fetchStatus()

      // Redirect to Spend Data page after a short delay so the toast is visible
      setTimeout(() => {
        router.push('/data/spend-data/')
      }, 1500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sync failed'
      toast.error(message)
      // Reset server-side sync status so it doesn't get stuck on 'syncing'
      try {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/xero/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            organizationId: currentOrganization?.id,
            stage: 'complete',
          }),
        })
      } catch {
        // Best effort — if this also fails, stepper stale detection handles it
      }
      // Always refresh displayed status — earlier stages may have succeeded
      fetchStatus()
    } finally {
      setIsSyncing(false)
      setSyncProgress('')
    }
  }

  async function handleDisconnect() {
    if (!currentOrganization?.id) return
    setIsDisconnecting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/xero/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ organizationId: currentOrganization.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Xero disconnected')
      setStatus({ connected: false, tenantName: null, connectedAt: null, lastSyncAt: null, syncStatus: null, syncError: null })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect'
      toast.error(message)
    } finally {
      setIsDisconnecting(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#13B5EA]/10">
              <Link2 className="h-5 w-5 text-[#13B5EA]" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Xero
                <Badge variant="outline" className="text-xs font-normal">Beta</Badge>
              </CardTitle>
              <CardDescription>
                {status?.connected
                  ? `Connected to ${status.tenantName || 'Xero organisation'}`
                  : 'Connect your Xero account to import financial data'}
              </CardDescription>
            </div>
          </div>
          {status?.connected && (
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {status?.connected ? (
          <div className="space-y-4">
            {/* Connection details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Organisation</p>
                <p className="font-medium">{status.tenantName || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Connected</p>
                <p className="font-medium">
                  {status.connectedAt
                    ? new Date(status.connectedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Last synced</p>
                <p className="font-medium">
                  {status.lastSyncAt
                    ? new Date(status.lastSyncAt).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Never'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium flex items-center gap-1">
                  {status.syncStatus === 'syncing' && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Syncing...
                    </>
                  )}
                  {status.syncStatus === 'error' && (
                    <>
                      <AlertCircle className="h-3 w-3 text-red-500" />
                      <span className="text-red-500">Error</span>
                    </>
                  )}
                  {status.syncStatus === 'idle' && 'Ready'}
                </p>
              </div>
            </div>

            {status.syncError && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-600 dark:text-red-400">
                {status.syncError}
              </div>
            )}

            {/* Actions */}
            {isAdmin && (
              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={isSyncing || status.syncStatus === 'syncing'}
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {isSyncing ? (syncProgress || 'Syncing...') : 'Sync Now'}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                      disabled={isDisconnecting}
                    >
                      <Unlink className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Xero?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the Xero connection and delete all synced transaction data,
                        account mappings, and sync history. Your existing sustainability data
                        (utility entries, LCA data) will not be affected.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDisconnect}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {isDisconnecting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Xero accounting software to automatically import expense data for
              spend-based carbon calculations. We only request read-only access to your financial data.
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                Auto-import expense transactions
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                Classify spend into emission categories
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                Prompt for higher-quality activity data
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                Read-only access only
              </li>
            </ul>
            {isAdmin ? (
              <Button onClick={handleConnect} disabled={isConnecting} className="bg-[#13B5EA] hover:bg-[#0ea5d9]">
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                {isConnecting ? 'Connecting...' : 'Connect to Xero'}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Only organisation admins can connect integrations.
              </p>
            )}
          </div>
        )}
      </CardContent>

      {/* Tenant picker dialog (multi-org flow) */}
      <Dialog open={showTenantPicker} onOpenChange={(open) => {
        if (!open && !isSelectingTenant) {
          setShowTenantPicker(false)
          setPendingTenants([])
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose a Xero Organisation</DialogTitle>
            <DialogDescription>
              Your Xero account has access to multiple organisations.
              Select the one you would like to connect to alka<strong>tera</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {pendingTenants.map((tenant) => (
              <button
                key={tenant.tenantId}
                onClick={() => handleSelectTenant(tenant.tenantId)}
                disabled={isSelectingTenant}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent hover:border-[#13B5EA]/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#13B5EA]/10">
                  <Building2 className="h-4 w-4 text-[#13B5EA]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {tenant.tenantName || 'Unnamed Organisation'}
                  </p>
                </div>
                {isSelectingTenant && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
