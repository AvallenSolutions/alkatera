'use client'

/**
 * An upgrade opportunity as a quiet hairline row: bold category, mono
 * facts, typographic state chips, one pill action. No icon box, no
 * badge pills, no card.
 */

import { StateChip } from '@/components/studio/state-chip'
import { PillButton } from '@/components/studio/pill-button'
import { getUncertainty } from '@/lib/xero/spend-factors'

const CATEGORY_META: Record<string, { label: string; scope: string }> = {
  grid_electricity:   { label: 'Electricity',           scope: 'Scope 2' },
  natural_gas:        { label: 'Natural Gas',           scope: 'Scope 1' },
  diesel_stationary:  { label: 'Diesel (Stationary)',   scope: 'Scope 1' },
  diesel_mobile:      { label: 'Diesel (Fleet)',        scope: 'Scope 1' },
  petrol_mobile:      { label: 'Petrol (Fleet)',        scope: 'Scope 1' },
  lpg:                { label: 'LPG',                   scope: 'Scope 1' },
  water:              { label: 'Water',                 scope: 'Scope 3' },
  air_travel:         { label: 'Air Travel',            scope: 'Scope 3' },
  rail_travel:        { label: 'Rail Travel',           scope: 'Scope 3' },
  road_freight:       { label: 'Road Freight',          scope: 'Scope 3' },
  sea_freight:        { label: 'Sea Freight',           scope: 'Scope 3' },
  air_freight:        { label: 'Air Freight',           scope: 'Scope 3' },
  courier:            { label: 'Courier / Parcel',      scope: 'Scope 3' },
  packaging:          { label: 'Packaging',             scope: 'Scope 3' },
  raw_materials:      { label: 'Raw Materials',         scope: 'Scope 3' },
  waste:              { label: 'Waste',                 scope: 'Scope 3' },
  accommodation:      { label: 'Accommodation',         scope: 'Scope 3' },
  other:              { label: 'Other',                 scope: '' },
}

interface UpgradePromptCardProps {
  category: string
  totalSpend: number
  estimatedEmissionsKg: number
  transactionCount: number
  /** Number already upgraded to activity-based data */
  upgradedCount?: number
  /** Number still pending upgrade */
  pendingCount?: number
  earliestDate?: string
  latestDate?: string
  canUpgrade: boolean
  isUpgraded?: boolean
  onUpgrade?: () => void
  onDismiss?: () => void
}

export function UpgradePromptCard({
  category,
  totalSpend,
  estimatedEmissionsKg,
  transactionCount,
  upgradedCount,
  pendingCount,
  earliestDate,
  latestDate,
  canUpgrade,
  isUpgraded = false,
  onUpgrade,
  onDismiss,
}: UpgradePromptCardProps) {
  const meta = CATEGORY_META[category] || CATEGORY_META.other
  const uncertainty = getUncertainty(category)
  const uncertaintyPercent = Math.round(uncertainty * 100)

  const formattedSpend = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalSpend)

  const formattedEmissions = estimatedEmissionsKg >= 1000
    ? `${(estimatedEmissionsKg / 1000).toFixed(1)} tCO2e`
    : `${Math.round(estimatedEmissionsKg)} kg CO2e`

  const formatShortDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })

  const dateRange = earliestDate && latestDate
    ? earliestDate.slice(0, 7) === latestDate.slice(0, 7)
      ? formatShortDate(earliestDate)
      : `${formatShortDate(earliestDate)} to ${formatShortDate(latestDate)}`
    : null

  const showPartial =
    !isUpgraded &&
    typeof upgradedCount === 'number' &&
    typeof pendingCount === 'number' &&
    upgradedCount + pendingCount > 0 &&
    upgradedCount > 0

  return (
    <div className={`flex items-center gap-4 border-b border-studio-hairline py-3 ${isUpgraded ? 'opacity-70' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-display text-sm font-semibold text-foreground">{meta.label}</span>
          {meta.scope && <StateChip tone="quiet">{meta.scope}</StateChip>}
          {isUpgraded && <StateChip tone="good">ACTIVITY-BASED</StateChip>}
          {!isUpgraded && <StateChip tone="attention">±{uncertaintyPercent}% UNCERTAIN</StateChip>}
        </div>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
          {formattedSpend} IDENTIFIED · {formattedEmissions} ESTIMATED · {transactionCount} TX
          {dateRange ? ` · ${dateRange.toUpperCase()}` : ''}
          {showPartial ? ` · ${upgradedCount} OF ${upgradedCount! + pendingCount!} UPGRADED` : ''}
        </p>
      </div>

      {!isUpgraded && (
        <div className="flex shrink-0 items-center gap-2">
          {canUpgrade && onUpgrade ? (
            <PillButton size="sm" variant="outline" onClick={onUpgrade}>
              Add detail
            </PillButton>
          ) : (
            !canUpgrade && <StateChip tone="quiet">COMING IN PHASE 2</StateChip>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={`Dismiss ${meta.label}`}
              className="font-mono text-xs text-studio-dim transition-colors hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  )
}
