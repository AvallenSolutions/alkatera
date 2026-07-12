'use client'

/**
 * The one quality meter on the spend surface, cut quiet: a hairline
 * section with a single thin bar and the figures as mono labels. Same
 * query as before; the icon stat cards are gone.
 */

import { useState, useEffect, useCallback } from 'react'
import { Eyebrow } from '@/components/studio/eyebrow'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'

interface QualityStats {
  total: number
  pending: number
  upgraded: number
  dismissed: number
  notApplicable: number
  tier1: number
  tier2: number
  tier3: number
  tier4: number
  baselineKg: number
  upgradedKg: number
}

export function DataQualityProgress() {
  const { currentOrganization } = useOrganization()
  const [stats, setStats] = useState<QualityStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadStats = useCallback(async () => {
    if (!currentOrganization?.id) return

    const { data } = await supabase
      .from('xero_transactions')
      .select('upgrade_status, data_quality_tier, spend_based_emissions_kg')
      .eq('organization_id', currentOrganization.id)
      .not('emission_category', 'is', null)

    if (!data || data.length === 0) {
      setStats(null)
      setIsLoading(false)
      return
    }

    const result: QualityStats = {
      total: data.length,
      pending: 0,
      upgraded: 0,
      dismissed: 0,
      notApplicable: 0,
      tier1: 0,
      tier2: 0,
      tier3: 0,
      tier4: 0,
      baselineKg: 0,
      upgradedKg: 0,
    }

    for (const tx of data) {
      switch (tx.upgrade_status) {
        case 'pending': result.pending++; break
        case 'upgraded': result.upgraded++; break
        case 'dismissed': result.dismissed++; break
        case 'not_applicable': result.notApplicable++; break
      }

      switch (tx.data_quality_tier) {
        case 1: result.tier1++; break
        case 2: result.tier2++; break
        case 3: result.tier3++; break
        case 4: result.tier4++; break
      }

      const emissions = Math.abs(tx.spend_based_emissions_kg || 0)
      if (tx.upgrade_status === 'upgraded') {
        result.upgradedKg += emissions
      } else if (tx.upgrade_status === 'pending') {
        result.baselineKg += emissions
      }
    }

    setStats(result)
    setIsLoading(false)
  }, [currentOrganization?.id])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-[6px] bg-studio-cream" aria-hidden="true" />
  }

  if (!stats || stats.total === 0) return null

  const upgradeable = stats.pending + stats.upgraded
  const qualityPercent = upgradeable > 0
    ? Math.round((stats.upgraded / upgradeable) * 100)
    : 0

  const formatEmissions = (kg: number) => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`
    return `${Math.round(kg)} kg`
  }

  return (
    <section className="space-y-3 border-b border-studio-hairline pb-5">
      <div className="flex items-baseline justify-between gap-4">
        <Eyebrow>DATA QUALITY</Eyebrow>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground tabular-nums">
          {qualityPercent}% UPGRADED
        </span>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-studio-hairline">
        <div
          className="h-full rounded-full bg-room transition-[width] duration-500 ease-studio"
          style={{ width: `${qualityPercent}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
        <span>
          SPEND-BASED (TIER 4){' '}
          <span className="font-bold text-foreground tabular-nums">{stats.tier4}</span>
        </span>
        <span>
          ACTIVITY-BASED (TIER 1-2){' '}
          <span className="font-bold text-foreground tabular-nums">{stats.tier1 + stats.tier2}</span>
        </span>
        <span>
          BASELINE CO2E{' '}
          <span className="font-bold text-foreground tabular-nums">{formatEmissions(stats.baselineKg)}</span>
        </span>
        <span>
          UPGRADED CO2E{' '}
          <span className="font-bold text-foreground tabular-nums">{formatEmissions(stats.upgradedKg)}</span>
        </span>
      </div>
    </section>
  )
}
