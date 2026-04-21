'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'

export interface UnhealthyIntegration {
  providerSlug: string
  providerName: string
  syncError: string | null
  lastSyncAt: string | null
}

const PROVIDER_LABEL: Record<string, string> = {
  breww: 'Breww',
  xero: 'Xero',
}

// Pulls the list of integrations currently in an error state for the active
// org. Polls every 60s while mounted. Used by the global banner in AppLayout.
export function useIntegrationHealth() {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [unhealthy, setUnhealthy] = useState<UnhealthyIntegration[]>([])

  useEffect(() => {
    if (!orgId) {
      setUnhealthy([])
      return
    }
    let cancelled = false

    const fetchHealth = async () => {
      const { data } = await supabase
        .from('integration_connections')
        .select('provider_slug, sync_status, sync_error, last_sync_at, status')
        .eq('organization_id', orgId)
        .or('sync_status.eq.error,status.eq.error')

      if (cancelled) return
      setUnhealthy(
        (data ?? []).map((row) => ({
          providerSlug: row.provider_slug,
          providerName: PROVIDER_LABEL[row.provider_slug] ?? row.provider_slug,
          syncError: row.sync_error,
          lastSyncAt: row.last_sync_at,
        })),
      )
    }

    fetchHealth()
    const id = setInterval(fetchHealth, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [orgId])

  return unhealthy
}
