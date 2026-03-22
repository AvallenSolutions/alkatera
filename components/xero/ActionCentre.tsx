'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Loader2, TrendingUp } from 'lucide-react'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { UpgradePromptCard } from './UpgradePromptCard'
import { EnergyUpgradeForm } from './EnergyUpgradeForm'
import { TravelUpgradeForm } from './TravelUpgradeForm'
import { AccommodationUpgradeForm } from './AccommodationUpgradeForm'
import { FreightUpgradeForm } from './FreightUpgradeForm'
import { SupplyChainUpgradeForm } from './SupplyChainUpgradeForm'
import { DuplicateWarningBanner } from './DuplicateWarningBanner'

interface CategorySummary {
  emission_category: string
  total_amount: number
  total_emissions_kg: number
  transaction_count: number
  pending_count: number
  upgraded_count: number
}

// Categories that have upgrade forms available
const ENERGY_CATEGORIES = ['grid_electricity', 'natural_gas', 'diesel_stationary', 'diesel_mobile', 'petrol_mobile', 'lpg', 'water']
const TRAVEL_CATEGORIES = ['air_travel', 'rail_travel']
const ACCOMMODATION_CATEGORIES = ['accommodation']
const FREIGHT_CATEGORIES = ['road_freight', 'sea_freight', 'air_freight']
const SUPPLY_CHAIN_CATEGORIES = ['packaging', 'raw_materials']
const UPGRADEABLE_CATEGORIES = [...ENERGY_CATEGORIES, ...TRAVEL_CATEGORIES, ...ACCOMMODATION_CATEGORIES, ...FREIGHT_CATEGORIES, ...SUPPLY_CHAIN_CATEGORIES]

export function ActionCentre() {
  const { currentOrganization } = useOrganization()
  const [categories, setCategories] = useState<CategorySummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [upgradeCategory, setUpgradeCategory] = useState<string | null>(null)
  const [hasConnection, setHasConnection] = useState(false)

  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id) return

    // Check connection
    const { data: connections } = await supabase
      .from('xero_connections')
      .select('id')
      .eq('organization_id', currentOrganization.id)
      .limit(1)

    if (!connections || connections.length === 0) {
      setHasConnection(false)
      setIsLoading(false)
      return
    }
    setHasConnection(true)

    // Fetch transactions grouped by category
    const { data: transactions } = await supabase
      .from('xero_transactions')
      .select('emission_category, amount, spend_based_emissions_kg, upgrade_status')
      .eq('organization_id', currentOrganization.id)
      .not('emission_category', 'is', null)

    if (!transactions || transactions.length === 0) {
      setIsLoading(false)
      return
    }

    // Group by category
    const grouped = new Map<string, CategorySummary>()

    for (const tx of transactions) {
      if (!tx.emission_category) continue
      const existing = grouped.get(tx.emission_category) || {
        emission_category: tx.emission_category,
        total_amount: 0,
        total_emissions_kg: 0,
        transaction_count: 0,
        pending_count: 0,
        upgraded_count: 0,
      }

      existing.total_amount += Math.abs(tx.amount || 0)
      existing.total_emissions_kg += Math.abs(tx.spend_based_emissions_kg || 0)
      existing.transaction_count++
      if (tx.upgrade_status === 'pending') existing.pending_count++
      if (tx.upgrade_status === 'upgraded') existing.upgraded_count++

      grouped.set(tx.emission_category, existing)
    }

    // Sort by total amount descending (highest impact first)
    const sorted = Array.from(grouped.values()).sort((a, b) => b.total_amount - a.total_amount)
    setCategories(sorted)
    setIsLoading(false)
  }, [currentOrganization?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!hasConnection) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <TrendingUp className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Xero Connection</h3>
          <p className="text-sm text-muted-foreground">
            Connect your Xero account in Settings &gt; Integrations to start importing financial data.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (categories.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <TrendingUp className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Transactions Synced</h3>
          <p className="text-sm text-muted-foreground">
            Sync your Xero data from Settings &gt; Integrations, then map your accounts to emission categories.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Calculate overall data quality
  const totalTransactions = categories.reduce((sum, c) => sum + c.transaction_count, 0)
  const totalUpgraded = categories.reduce((sum, c) => sum + c.upgraded_count, 0)
  const qualityPercent = totalTransactions > 0 ? Math.round((totalUpgraded / totalTransactions) * 100) : 0

  const pendingCategories = categories.filter(c => c.pending_count > 0)
  const upgradedCategories = categories.filter(c => c.pending_count === 0 && c.upgraded_count > 0)

  // If showing an upgrade form, route to the correct one
  if (upgradeCategory) {
    const formProps = {
      onComplete: () => { setUpgradeCategory(null); fetchData() },
      onCancel: () => setUpgradeCategory(null),
    }

    let form: React.ReactNode = null

    if (ENERGY_CATEGORIES.includes(upgradeCategory)) {
      form = <EnergyUpgradeForm category={upgradeCategory} {...formProps} />
    } else if (TRAVEL_CATEGORIES.includes(upgradeCategory)) {
      form = <TravelUpgradeForm category={upgradeCategory as 'air_travel' | 'rail_travel'} {...formProps} />
    } else if (ACCOMMODATION_CATEGORIES.includes(upgradeCategory)) {
      form = <AccommodationUpgradeForm {...formProps} />
    } else if (FREIGHT_CATEGORIES.includes(upgradeCategory)) {
      form = <FreightUpgradeForm category={upgradeCategory as 'road_freight' | 'sea_freight' | 'air_freight'} {...formProps} />
    } else if (SUPPLY_CHAIN_CATEGORIES.includes(upgradeCategory)) {
      form = <SupplyChainUpgradeForm category={upgradeCategory as 'packaging' | 'raw_materials'} {...formProps} />
    }

    return <div className="space-y-4">{form}</div>
  }

  return (
    <div className="space-y-6">
      {/* Duplicate detection banner */}
      <DuplicateWarningBanner onDismissed={fetchData} />

      {/* Data quality score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Data Quality Score
          </CardTitle>
          <CardDescription>
            {qualityPercent}% of your classified transactions have been upgraded to activity-based data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={qualityPercent} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{totalUpgraded} upgraded</span>
            <span>{totalTransactions - totalUpgraded} remaining</span>
          </div>
        </CardContent>
      </Card>

      {/* Pending upgrades */}
      {pendingCategories.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Upgrade Opportunities
          </h3>
          {pendingCategories.map(category => (
            <UpgradePromptCard
              key={category.emission_category}
              category={category.emission_category}
              totalSpend={category.total_amount}
              estimatedEmissionsKg={category.total_emissions_kg}
              transactionCount={category.pending_count}
              canUpgrade={UPGRADEABLE_CATEGORIES.includes(category.emission_category)}
              onUpgrade={() => setUpgradeCategory(category.emission_category)}
              onDismiss={() => handleDismiss(category.emission_category)}
            />
          ))}
        </div>
      )}

      {/* Already upgraded */}
      {upgradedCategories.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Upgraded
          </h3>
          {upgradedCategories.map(category => (
            <UpgradePromptCard
              key={category.emission_category}
              category={category.emission_category}
              totalSpend={category.total_amount}
              estimatedEmissionsKg={category.total_emissions_kg}
              transactionCount={category.transaction_count}
              canUpgrade={false}
              isUpgraded
            />
          ))}
        </div>
      )}
    </div>
  )

  async function handleDismiss(category: string) {
    if (!currentOrganization?.id) return
    await supabase
      .from('xero_transactions')
      .update({ upgrade_status: 'dismissed', updated_at: new Date().toISOString() })
      .eq('organization_id', currentOrganization.id)
      .eq('emission_category', category)
      .eq('upgrade_status', 'pending')

    fetchData()
  }
}
