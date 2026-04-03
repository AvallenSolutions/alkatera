'use client'

/**
 * Post-connection guided stepper for Xero integration setup.
 *
 * Appears after a fresh Xero connection and guides the user through:
 * 1. Syncing data (auto-triggered)
 * 2. Classifying suppliers into emission categories
 * 3. Viewing emissions data
 *
 * Dismissible and won't reappear once dismissed for this org.
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, RefreshCw, Users, BarChart3, X, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'

type StepStatus = 'active' | 'complete' | 'pending'

interface Step {
  number: number
  label: string
  description: string
  status: StepStatus
}

const STALE_SYNC_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

export function XeroSetupStepper() {
  const { currentOrganization } = useOrganization()
  const [isDismissed, setIsDismissed] = useState(false)
  const [supplierStats, setSupplierStats] = useState({ total: 0, classified: 0 })
  const [hasConnection, setHasConnection] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isStaleSyncing, setIsStaleSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [isResettingSync, setIsResettingSync] = useState(false)

  const storageKey = `xero-setup-dismissed-${currentOrganization?.id}`

  // Check dismissal state
  useEffect(() => {
    if (!currentOrganization?.id) return
    const dismissed = localStorage.getItem(storageKey)
    if (dismissed === 'true') setIsDismissed(true)
  }, [currentOrganization?.id, storageKey])

  // Fetch connection and supplier classification data
  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id) return

    // Check connection + sync status
    const { data: conn } = await supabase
      .from('xero_connections')
      .select('id, sync_status, last_sync_at, updated_at')
      .eq('organization_id', currentOrganization.id)
      .maybeSingle()

    setHasConnection(!!conn)
    if (conn) {
      const syncing = conn.sync_status === 'syncing'
      setIsSyncing(syncing)
      setLastSyncAt(conn.last_sync_at)

      // Detect stale sync (stuck for >5 minutes)
      if (syncing && conn.updated_at) {
        const elapsed = Date.now() - new Date(conn.updated_at).getTime()
        setIsStaleSyncing(elapsed > STALE_SYNC_THRESHOLD_MS)
      } else {
        setIsStaleSyncing(false)
      }
    }

    // Fetch supplier classification stats (distinct contact names)
    const { data: txData } = await supabase
      .from('xero_transactions')
      .select('xero_contact_name, emission_category')
      .eq('organization_id', currentOrganization.id)

    if (txData && txData.length > 0) {
      const bySupplier = new Map<string, { total: number; classified: number }>()
      for (const tx of txData) {
        const name = tx.xero_contact_name || '(unknown)'
        const existing = bySupplier.get(name) || { total: 0, classified: 0 }
        existing.total++
        if (tx.emission_category) existing.classified++
        bySupplier.set(name, existing)
      }
      // A supplier is "classified" if ALL its transactions have a category
      let totalSuppliers = 0
      let classifiedSuppliers = 0
      Array.from(bySupplier.values()).forEach(s => {
        totalSuppliers++
        if (s.classified === s.total) classifiedSuppliers++
      })
      setSupplierStats({ total: totalSuppliers, classified: classifiedSuppliers })
    }
  }, [currentOrganization?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Poll while syncing to update status
  useEffect(() => {
    if (!isSyncing) return
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [isSyncing, fetchData])

  async function handleResetSync() {
    if (!currentOrganization?.id) return
    setIsResettingSync(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/xero/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          stage: 'complete',
        }),
      })
      await fetchData()
    } catch {
      // Ignore — fetchData will pick up the new status
    } finally {
      setIsResettingSync(false)
    }
  }

  // Don't show if dismissed, not connected, or no org
  if (isDismissed || !hasConnection || !currentOrganization) return null

  // Determine step statuses
  const hasSynced = !!lastSyncAt
  const allClassified = supplierStats.total > 0 && supplierStats.classified >= supplierStats.total
  const setupComplete = hasSynced && allClassified

  // Don't show if setup is fully complete
  if (setupComplete) return null

  const steps: Step[] = [
    {
      number: 1,
      label: 'Sync your data',
      description: isStaleSyncing
        ? 'Sync may have stalled'
        : isSyncing
          ? 'Importing transactions...'
          : hasSynced
            ? 'Data synced'
            : 'Waiting to sync',
      status: hasSynced ? 'complete' : 'active',
    },
    {
      number: 2,
      label: 'Classify your suppliers',
      description: supplierStats.total > 0
        ? `${supplierStats.classified} of ${supplierStats.total} suppliers classified`
        : 'Assign emission categories to suppliers',
      status: allClassified ? 'complete' : hasSynced ? 'active' : 'pending',
    },
    {
      number: 3,
      label: 'View your emissions',
      description: 'See your data in the Action Centre',
      status: allClassified ? 'active' : 'pending',
    },
  ]

  function handleDismiss() {
    localStorage.setItem(storageKey, 'true')
    setIsDismissed(true)
  }

  return (
    <Card className="border-neon-lime/30 bg-neon-lime/5">
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-neon-lime/50 text-neon-lime">
              Setup Guide
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-0">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center flex-1">
              {/* Step circle */}
              <div className="flex items-center gap-2.5 flex-1">
                <div className={`
                  flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold
                  ${step.status === 'complete'
                    ? 'bg-emerald-500 text-white'
                    : step.status === 'active'
                      ? isStaleSyncing && step.number === 1
                        ? 'bg-amber-500 text-white'
                        : 'bg-neon-lime text-black'
                      : 'bg-slate-200 dark:bg-slate-700 text-muted-foreground'
                  }
                `}>
                  {step.status === 'complete' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : step.status === 'active' && step.number === 1 && isSyncing ? (
                    isStaleSyncing ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    )
                  ) : step.number === 2 ? (
                    <Users className="h-3.5 w-3.5" />
                  ) : (
                    step.number
                  )}
                </div>

                <div className="min-w-0">
                  <div className={`text-xs font-medium ${step.status === 'pending' ? 'text-muted-foreground' : ''}`}>
                    {step.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {step.description}
                  </div>
                </div>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className={`h-px w-6 mx-1 shrink-0 ${
                  steps[index + 1].status !== 'pending'
                    ? 'bg-emerald-400'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Stale sync warning */}
        {isStaleSyncing && (
          <div className="mt-3 pt-3 border-t border-amber-500/30">
            <div className="flex items-center justify-between">
              <p className="text-xs text-amber-400">
                Sync appears to have stalled. You can reset it and try again.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                onClick={handleResetSync}
                disabled={isResettingSync}
              >
                {isResettingSync ? 'Resetting...' : 'Reset sync'}
              </Button>
            </div>
          </div>
        )}

        {/* Action button for current step */}
        {hasSynced && !allClassified && supplierStats.total > 0 && (
          <div className="mt-3 pt-3 border-t border-neon-lime/20">
            <Button size="sm" variant="outline" className="w-full" asChild>
              <Link href="/data/xero-upgrades/">
                <Users className="h-3.5 w-3.5 mr-1.5" />
                Classify your suppliers ({supplierStats.total - supplierStats.classified} remaining)
              </Link>
            </Button>
          </div>
        )}

        {allClassified && (
          <div className="mt-3 pt-3 border-t border-neon-lime/20">
            <Button size="sm" variant="outline" className="w-full" asChild>
              <Link href="/data/xero-upgrades/">
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                View your emissions in the Action Centre
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
