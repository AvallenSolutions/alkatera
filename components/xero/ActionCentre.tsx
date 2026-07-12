'use client'

/**
 * Upgrade opportunities, cut quiet. The page supplies the section eyebrow;
 * this renders the duplicate and unclassified notices, then the upgrade
 * prompts as hairline rows. The old duplicate "Data Quality Score" card is
 * gone: the page's single quality meter says it once.
 */

import { useState, useEffect, useCallback } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { getUncertainty } from '@/lib/xero/spend-factors'
import { Eyebrow } from '@/components/studio/eyebrow'
import { UpgradePromptCard } from './UpgradePromptCard'
import { EnergyUpgradeForm } from './EnergyUpgradeForm'
import { TravelUpgradeForm } from './TravelUpgradeForm'
import { AccommodationUpgradeForm } from './AccommodationUpgradeForm'
import { FreightUpgradeForm } from './FreightUpgradeForm'
import { SupplyChainUpgradeForm } from './SupplyChainUpgradeForm'
import { GenericUpgradeForm } from './GenericUpgradeForm'
import { GENERIC_UPGRADE_CONFIG, type GenericUpgradeCategory } from '@/lib/xero/generic-upgrade-config'
import { DuplicateWarningBanner } from './DuplicateWarningBanner'
import { UnclassifiedAlertBanner } from './UnclassifiedAlertBanner'

interface CategorySummary {
  emission_category: string
  total_amount: number
  total_emissions_kg: number
  transaction_count: number
  pending_count: number
  upgraded_count: number
  earliest_date: string
  latest_date: string
}

// Categories that have upgrade forms available
const ENERGY_CATEGORIES = ['grid_electricity', 'natural_gas', 'diesel_stationary', 'diesel_mobile', 'petrol_mobile', 'lpg', 'water']
const TRAVEL_CATEGORIES = ['air_travel', 'rail_travel']
const ACCOMMODATION_CATEGORIES = ['accommodation']
const FREIGHT_CATEGORIES = ['road_freight', 'sea_freight', 'air_freight']
const SUPPLY_CHAIN_CATEGORIES = ['packaging', 'raw_materials']
const GENERIC_CATEGORIES = Object.keys(GENERIC_UPGRADE_CONFIG) as GenericUpgradeCategory[]
const UPGRADEABLE_CATEGORIES = [
  ...ENERGY_CATEGORIES,
  ...TRAVEL_CATEGORIES,
  ...ACCOMMODATION_CATEGORIES,
  ...FREIGHT_CATEGORIES,
  ...SUPPLY_CHAIN_CATEGORIES,
  ...GENERIC_CATEGORIES,
]

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
      .select('emission_category, amount, spend_based_emissions_kg, upgrade_status, transaction_date')
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
        earliest_date: tx.transaction_date || '',
        latest_date: tx.transaction_date || '',
      }

      existing.total_amount += Math.abs(tx.amount || 0)
      existing.total_emissions_kg += Math.abs(tx.spend_based_emissions_kg || 0)
      existing.transaction_count++
      if (tx.upgrade_status === 'pending') existing.pending_count++
      if (tx.upgrade_status === 'upgraded') existing.upgraded_count++
      if (tx.transaction_date) {
        if (!existing.earliest_date || tx.transaction_date < existing.earliest_date) existing.earliest_date = tx.transaction_date
        if (!existing.latest_date || tx.transaction_date > existing.latest_date) existing.latest_date = tx.transaction_date
      }

      grouped.set(tx.emission_category, existing)
    }

    // Sort by uncertainty (highest first), then by total emissions as tiebreaker
    const sorted = Array.from(grouped.values()).sort((a, b) => {
      const uncA = getUncertainty(a.emission_category)
      const uncB = getUncertainty(b.emission_category)
      if (uncB !== uncA) return uncB - uncA
      return b.total_emissions_kg - a.total_emissions_kg
    })
    setCategories(sorted)
    setIsLoading(false)
  }, [currentOrganization?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-[6px] bg-studio-cream" aria-hidden="true" />
  }

  if (!hasConnection) {
    return (
      <p className="text-sm text-muted-foreground">
        Connect your Xero account in Settings &gt; Integrations to start importing financial data.
      </p>
    )
  }

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No transactions synced yet. Sync your Xero data, then map your accounts to emission categories.
      </p>
    )
  }

  const pendingCategories = categories.filter(c => c.pending_count > 0)
  const upgradedCategories = categories.filter(c => c.pending_count === 0 && c.upgraded_count > 0)

  // If showing an upgrade form, route to the correct one
  if (upgradeCategory) {
    // Forms handle their own per-transaction linking; we just refresh on completion.
    const formProps = {
      onComplete: () => {
        setUpgradeCategory(null)
        fetchData()
      },
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
    } else if ((GENERIC_CATEGORIES as string[]).includes(upgradeCategory)) {
      form = <GenericUpgradeForm category={upgradeCategory as GenericUpgradeCategory} {...formProps} />
    }

    return <div className="space-y-4">{form}</div>
  }

  return (
    <div className="space-y-6">
      {/* Duplicate detection notice */}
      <DuplicateWarningBanner onDismissed={fetchData} />

      {/* Unclassified transactions notice */}
      {currentOrganization && (
        <UnclassifiedAlertBanner organizationId={currentOrganization.id} />
      )}

      {/* Pending upgrades: the section eyebrow above says it; just the rows. */}
      {pendingCategories.length > 0 && (
        <div>
          {pendingCategories.map(category => (
            <UpgradePromptCard
              key={category.emission_category}
              category={category.emission_category}
              totalSpend={category.total_amount}
              estimatedEmissionsKg={category.total_emissions_kg}
              transactionCount={category.pending_count}
              upgradedCount={category.upgraded_count}
              pendingCount={category.pending_count}
              earliestDate={category.earliest_date}
              latestDate={category.latest_date}
              canUpgrade={UPGRADEABLE_CATEGORIES.includes(category.emission_category)}
              onUpgrade={() => setUpgradeCategory(category.emission_category)}
              onDismiss={() => handleDismiss(category.emission_category)}
            />
          ))}
        </div>
      )}

      {pendingCategories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing waiting. Every upgradeable category has been dealt with.
        </p>
      )}

      {/* Already upgraded */}
      {upgradedCategories.length > 0 && (
        <div>
          <Eyebrow tone="dim" className="mb-1">UPGRADED</Eyebrow>
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
