'use client'

import { useCallback, useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'

export interface SpendInboxState {
  loading: boolean
  connected: boolean
  unclassifiedCount: number
  pendingUpgradeCount: number
  upgradedCount: number
  refetch: () => Promise<void>
}

const INITIAL = {
  loading: true,
  connected: false,
  unclassifiedCount: 0,
  pendingUpgradeCount: 0,
  upgradedCount: 0,
}

export function useSpendInboxState(): SpendInboxState {
  const { currentOrganization } = useOrganization()
  const [state, setState] = useState(INITIAL)
  const orgId = currentOrganization?.id

  const fetchState = useCallback(async () => {
    if (!orgId) {
      setState({ ...INITIAL, loading: false })
      return
    }

    const { data: conn } = await supabase
      .from('xero_connections')
      .select('id')
      .eq('organization_id', orgId)
      .limit(1)

    const connected = !!conn && conn.length > 0

    if (!connected) {
      setState({
        loading: false,
        connected: false,
        unclassifiedCount: 0,
        pendingUpgradeCount: 0,
        upgradedCount: 0,
      })
      return
    }

    const [unclassifiedRes, pendingRes, upgradedRes] = await Promise.all([
      supabase
        .from('xero_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .is('emission_category', null),
      supabase
        .from('xero_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .not('emission_category', 'is', null)
        .eq('upgrade_status', 'pending'),
      supabase
        .from('xero_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('upgrade_status', 'upgraded'),
    ])

    setState({
      loading: false,
      connected: true,
      unclassifiedCount: unclassifiedRes.count ?? 0,
      pendingUpgradeCount: pendingRes.count ?? 0,
      upgradedCount: upgradedRes.count ?? 0,
    })
  }, [orgId])

  useEffect(() => {
    fetchState()
  }, [fetchState])

  return { ...state, refetch: fetchState }
}
