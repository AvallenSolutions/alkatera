'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Loader2, TrendingUp, ArrowUpCircle, BarChart3, Zap } from 'lucide-react'
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
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
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
    <Card>
      <CardContent className="py-4 space-y-3">
        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Data Quality Score</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{qualityPercent}%</span>
            </div>
            <Progress value={qualityPercent} className="h-2" />
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            label="Spend-based"
            value={stats.tier4.toString()}
            sublabel="Tier 4"
            colour="text-red-600 dark:text-red-400"
          />
          <StatCard
            icon={<ArrowUpCircle className="h-3.5 w-3.5" />}
            label="Activity-based"
            value={(stats.tier1 + stats.tier2).toString()}
            sublabel="Tier 1-2"
            colour="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            icon={<Zap className="h-3.5 w-3.5" />}
            label="Baseline CO2e"
            value={formatEmissions(stats.baselineKg)}
            sublabel="Pending"
            colour="text-amber-600 dark:text-amber-400"
          />
          <StatCard
            icon={<Zap className="h-3.5 w-3.5" />}
            label="Upgraded CO2e"
            value={formatEmissions(stats.upgradedKg)}
            sublabel="Completed"
            colour="text-emerald-600 dark:text-emerald-400"
          />
        </div>
      </CardContent>
    </Card>
  )
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
  colour,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sublabel: string
  colour: string
}) {
  return (
    <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
      <div className={`flex items-center justify-center gap-1 ${colour} mb-0.5`}>
        {icon}
        <span className="text-lg font-bold">{value}</span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
      <p className="text-[10px] text-muted-foreground opacity-70">{sublabel}</p>
    </div>
  )
}
