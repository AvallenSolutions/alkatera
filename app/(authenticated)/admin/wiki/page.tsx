'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ExternalLink } from 'lucide-react'
import { useIsAlkateraAdmin } from '@/hooks/usePermissions'
import { Statement } from '@/components/studio/statement'
import { Panel } from '@/components/studio/panel'
import { BigNumber } from '@/components/studio/big-number'
import { PillButton } from '@/components/studio/pill-button'
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
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">Loading…</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-studio-dim">
        <AlertCircle className="h-4 w-4" />
        Admin access required.
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div>
        <Statement eyebrow="THE WIRING · ADMIN · WIKI" headline="Sustainability wiki." />
        <p className="mt-2 max-w-2xl text-sm text-studio-dim">
          The public wiki ships with each deploy from wiki/pages in the repo. Sync pushes the
          published pages into Rosa&apos;s knowledge base so she cites them with clickable links.
        </p>
      </div>

      <Panel>
        <div className="mb-4 space-y-1">
          <h2 className="font-display text-base font-semibold text-foreground">
            Rosa knowledge base sync
          </h2>
          <p className="text-sm text-studio-dim">
            Runs automatically after every production deploy. This button is the manual fallback:
            it replaces all knowledge base entries in the &quot;wiki&quot; category with the pages
            in this deploy.
          </p>
        </div>
        <div className="space-y-4">
          {loading ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
              Loading…
            </p>
          ) : status ? (
            <div className="flex flex-wrap gap-10">
              <BigNumber value={String(status.pagesOnDisk)} label="PAGES IN THIS DEPLOY" />
              <BigNumber value={String(status.syncedCount)} label="ENTRIES IN ROSA" />
              <BigNumber
                value={
                  status.lastSyncedAt
                    ? format(new Date(status.lastSyncedAt), 'd MMM yyyy')
                    : 'never'
                }
                label="LAST SYNCED"
              />
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <PillButton onClick={runSync} disabled={syncing || loading}>
              {syncing ? 'Syncing…' : 'Sync wiki to Rosa'}
            </PillButton>
            <a
              href="/wiki"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-studio-ink/25 bg-transparent px-4 text-sm font-medium text-foreground transition-colors duration-200 ease-studio hover:border-studio-ink/60"
            >
              View the wiki
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {result && <p className="text-sm text-studio-good">{result}</p>}
          {error && (
            <p className="flex items-center gap-2 text-sm text-studio-stale">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          )}
        </div>
      </Panel>
    </div>
  )
}
