'use client'

/**
 * Post-connection guided stepper for Xero integration setup.
 *
 * Appears after a fresh Xero connection and guides the user through:
 * 1. Syncing data (auto-triggered)
 * 2. Mapping accounts to emission categories
 * 3. Viewing emissions data
 *
 * Dismissible and won't reappear once dismissed for this org.
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, RefreshCw, Settings, BarChart3, X } from 'lucide-react'
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

export function XeroSetupStepper() {
  const { currentOrganization } = useOrganization()
  const [isDismissed, setIsDismissed] = useState(false)
  const [mappedCount, setMappedCount] = useState(0)
  const [totalAccounts, setTotalAccounts] = useState(0)
  const [hasConnection, setHasConnection] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  const storageKey = `xero-setup-dismissed-${currentOrganization?.id}`

  // Check dismissal state
  useEffect(() => {
    if (!currentOrganization?.id) return
    const dismissed = localStorage.getItem(storageKey)
    if (dismissed === 'true') setIsDismissed(true)
  }, [currentOrganization?.id, storageKey])

  // Fetch connection and mapping data
  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id) return

    // Check connection + sync status
    const { data: conn } = await supabase
      .from('xero_connections')
      .select('id, sync_status, last_sync_at')
      .eq('organization_id', currentOrganization.id)
      .maybeSingle()

    setHasConnection(!!conn)
    if (conn) {
      setIsSyncing(conn.sync_status === 'syncing')
      setLastSyncAt(conn.last_sync_at)
    }

    // Fetch account mapping stats
    const { data: mappings } = await supabase
      .from('xero_account_mappings')
      .select('id, emission_category, is_excluded')
      .eq('organization_id', currentOrganization.id)

    if (mappings) {
      setTotalAccounts(mappings.length)
      setMappedCount(
        mappings.filter(m => m.emission_category !== null || m.is_excluded).length
      )
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

  // Don't show if dismissed, not connected, or no org
  if (isDismissed || !hasConnection || !currentOrganization) return null

  // Determine step statuses
  const hasSynced = !!lastSyncAt
  const allMapped = totalAccounts > 0 && mappedCount >= totalAccounts
  const setupComplete = hasSynced && allMapped

  // Don't show if setup is fully complete
  if (setupComplete) return null

  const steps: Step[] = [
    {
      number: 1,
      label: 'Sync your data',
      description: isSyncing ? 'Importing transactions...' : hasSynced ? 'Data synced' : 'Waiting to sync',
      status: hasSynced ? 'complete' : isSyncing ? 'active' : 'active',
    },
    {
      number: 2,
      label: 'Map your accounts',
      description: totalAccounts > 0
        ? `${mappedCount} of ${totalAccounts} mapped`
        : 'Map Xero accounts to emission categories',
      status: allMapped ? 'complete' : hasSynced ? 'active' : 'pending',
    },
    {
      number: 3,
      label: 'View your emissions',
      description: 'See your data in the Action Centre',
      status: allMapped ? 'active' : 'pending',
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
                      ? 'bg-neon-lime text-black'
                      : 'bg-slate-200 dark:bg-slate-700 text-muted-foreground'
                  }
                `}>
                  {step.status === 'complete' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : step.status === 'active' && step.number === 1 && isSyncing ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
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

        {/* Action button for current step */}
        {hasSynced && !allMapped && totalAccounts > 0 && (
          <div className="mt-3 pt-3 border-t border-neon-lime/20">
            <p className="text-xs text-muted-foreground mb-2">
              Map your Xero accounts to emission categories so transactions are classified correctly.
              Scroll down to see your accounts.
            </p>
          </div>
        )}

        {allMapped && (
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
