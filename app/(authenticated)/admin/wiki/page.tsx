'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, Loader2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react'
import { useIsAlkateraAdmin } from '@/hooks/usePermissions'
import { format } from 'date-fns'

interface SyncStatus {
  pagesOnDisk: number
  syncedCount: number
  lastSyncedAt: string | null
}

export default function AdminWikiPage() {
  const { isAlkateraAdmin: isAdmin, isLoading: adminLoading } = useIsAlkateraAdmin()
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const loadStatus = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/wiki-sync')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then(setStatus)
      .catch(() => setError('Could not load wiki sync status.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (adminLoading || !isAdmin) return
    loadStatus()
  }, [adminLoading, isAdmin, loadStatus])

  const runSync = async () => {
    setSyncing(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/wiki-sync', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Sync failed (${res.status})`)
      setResult(`Synced ${body.synced} wiki pages into Rosa's knowledge base.`)
      loadStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
        <AlertCircle className="h-5 w-5" />
        Admin access required.
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-semibold">Sustainability wiki</h1>
          <p className="text-sm text-muted-foreground">
            The public wiki ships with each deploy from wiki/pages in the repo. Sync pushes the
            published pages into Rosa&apos;s knowledge base so she cites them with clickable links.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rosa knowledge base sync</CardTitle>
          <CardDescription>
            Replaces all knowledge base entries in the &quot;wiki&quot; category with the pages in
            this deploy. Run after every deploy that changes wiki content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : status ? (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-2xl font-semibold">{status.pagesOnDisk}</p>
                <p className="text-muted-foreground">published pages in this deploy</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">{status.syncedCount}</p>
                <p className="text-muted-foreground">entries in Rosa&apos;s knowledge base</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {status.lastSyncedAt ? format(new Date(status.lastSyncedAt), 'd MMM yyyy') : 'never'}
                </p>
                <p className="text-muted-foreground">last synced</p>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <Button onClick={runSync} disabled={syncing || loading}>
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {syncing ? 'Syncing...' : 'Sync wiki to Rosa'}
            </Button>
            <Button variant="outline" asChild>
              <a href="/wiki" target="_blank" rel="noopener noreferrer">
                View the wiki
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>

          {result && <p className="text-sm text-green-600">{result}</p>}
          {error && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
