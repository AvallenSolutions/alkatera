'use client'

import { useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'

interface FlagThresholdResult {
  loading: boolean
  flagExceeded: boolean
  maxFlagPct: number
  flagTargetsSet: boolean
  totalProducts: number
}

/**
 * Checks whether the current organisation's FLAG emissions exceed the
 * 20% threshold and whether FLAG targets have been set.
 */
export function useFlagThreshold(): FlagThresholdResult {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [loading, setLoading] = useState(true)
  const [flagExceeded, setFlagExceeded] = useState(false)
  const [maxFlagPct, setMaxFlagPct] = useState(0)
  const [flagTargetsSet, setFlagTargetsSet] = useState(false)
  const [totalProducts, setTotalProducts] = useState(0)

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const supabase = getSupabaseBrowserClient()

    async function fetchData() {
      // Fetch completed product carbon footprints with aggregated impacts
      const { data: products } = await supabase
        .from('product_carbon_footprints')
        .select('aggregated_impacts')
        .eq('organization_id', orgId!)
        .eq('status', 'completed')
        .not('aggregated_impacts', 'is', null)

      if (cancelled) return

      let anyExceeded = false
      let maxPct = 0
      const productCount = products?.length ?? 0

      for (const p of products || []) {
        const ft = (p.aggregated_impacts as any)?.breakdown?.flag_threshold
        if (ft) {
          if (ft.flag_threshold_exceeded) anyExceeded = true
          if (typeof ft.flag_emissions_pct === 'number' && ft.flag_emissions_pct > maxPct) {
            maxPct = ft.flag_emissions_pct
          }
        }
      }

      // Check whether non-draft FLAG targets exist
      const { count } = await supabase
        .from('flag_targets')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId!)
        .neq('status', 'draft')

      if (cancelled) return

      setFlagExceeded(anyExceeded)
      setMaxFlagPct(maxPct)
      setTotalProducts(productCount)
      setFlagTargetsSet((count ?? 0) > 0)
      setLoading(false)
    }

    fetchData().catch((err) => {
      console.error('[useFlagThreshold] Error:', err)
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [orgId])

  return { loading, flagExceeded, maxFlagPct, flagTargetsSet, totalProducts }
}
