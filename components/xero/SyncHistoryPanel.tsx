'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, RefreshCw, ChevronDown, ChevronRight, Clock } from 'lucide-react'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'

interface SyncLog {
  id: string
  sync_type: string
  status: string
  transactions_fetched: number | null
  transactions_classified: number | null
  accounts_fetched: number | null
  error_message: string | null
  started_at: string
  completed_at: string | null
}

const PAGE_SIZE = 20

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'destructive' | 'outline' | 'secondary' }> = {
  completed: { label: 'Completed', variant: 'default' },
  failed: { label: 'Failed', variant: 'destructive' },
  started: { label: 'In Progress', variant: 'secondary' },
}

export function SyncHistoryPanel() {
  const { currentOrganization } = useOrganization()
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLogs = useCallback(async (append = false) => {
    if (!currentOrganization?.id) return

    const offset = append ? logs.length : 0
    const { data } = await supabase
      .from('xero_sync_logs')
      .select('id, sync_type, status, transactions_fetched, transactions_classified, accounts_fetched, error_message, started_at, completed_at')
      .eq('organization_id', currentOrganization.id)
      .order('started_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (data) {
      if (append) {
        setLogs(prev => [...prev, ...data])
      } else {
        setLogs(data)
      }
      setHasMore(data.length === PAGE_SIZE)
    }

    setIsLoading(false)
  }, [currentOrganization?.id, logs.length])

  useEffect(() => {
    fetchLogs()
  }, [currentOrganization?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh while any sync is in progress
  useEffect(() => {
    const hasInProgress = logs.some(l => l.status === 'started')

    if (hasInProgress && !intervalRef.current) {
      intervalRef.current = setInterval(() => fetchLogs(), 5000)
    } else if (!hasInProgress && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [logs, fetchLogs])

  function formatDuration(started: string, completed: string | null): string {
    if (!completed) return 'Running...'
    const ms = new Date(completed).getTime() - new Date(started).getTime()
    if (ms < 1000) return '<1s'
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
  }

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
        <p className="text-sm text-muted-foreground">No sync history yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Trigger a sync from Settings &gt; Integrations to import your Xero data.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Sync History
        </h3>
        <Button variant="ghost" size="sm" onClick={() => fetchLogs()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Fetched</TableHead>
              <TableHead className="text-right">Classified</TableHead>
              <TableHead className="text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map(log => {
              const isExpanded = expandedId === log.id
              const statusConfig = STATUS_BADGES[log.status] || { label: log.status, variant: 'outline' as const }

              return (
                <>
                  <TableRow
                    key={log.id}
                    className={log.error_message ? 'cursor-pointer' : ''}
                    onClick={() => log.error_message && setExpandedId(isExpanded ? null : log.id)}
                  >
                    <TableCell className="w-8 pr-0">
                      {log.error_message && (
                        isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDateTime(log.started_at)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {log.sync_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig.variant} className="text-xs">
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {log.transactions_fetched ?? '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {log.transactions_classified ?? '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatDuration(log.started_at, log.completed_at)}
                    </TableCell>
                  </TableRow>
                  {isExpanded && log.error_message && (
                    <TableRow key={`${log.id}-error`}>
                      <TableCell colSpan={7} className="bg-red-50 dark:bg-red-950/20">
                        <p className="text-xs text-red-700 dark:text-red-300 py-1">
                          <strong>Error:</strong> {log.error_message}
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => fetchLogs(true)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
