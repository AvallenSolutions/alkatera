'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Zap,
  Flame,
  Droplets,
  Plane,
  Train,
  Truck,
  Ship,
  Package,
  Trash2,
  Hotel,
  Fuel,
  Leaf,
  ArrowUpCircle,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

const CATEGORY_META: Record<string, { label: string; icon: LucideIcon; scope: string }> = {
  grid_electricity:   { label: 'Electricity',           icon: Zap,       scope: 'Scope 2' },
  natural_gas:        { label: 'Natural Gas',           icon: Flame,     scope: 'Scope 1' },
  diesel_stationary:  { label: 'Diesel (Stationary)',   icon: Fuel,      scope: 'Scope 1' },
  diesel_mobile:      { label: 'Diesel (Fleet)',        icon: Fuel,      scope: 'Scope 1' },
  petrol_mobile:      { label: 'Petrol (Fleet)',        icon: Fuel,      scope: 'Scope 1' },
  lpg:                { label: 'LPG',                   icon: Flame,     scope: 'Scope 1' },
  water:              { label: 'Water',                 icon: Droplets,  scope: 'Scope 3' },
  air_travel:         { label: 'Air Travel',            icon: Plane,     scope: 'Scope 3' },
  rail_travel:        { label: 'Rail Travel',           icon: Train,     scope: 'Scope 3' },
  road_freight:       { label: 'Road Freight',          icon: Truck,     scope: 'Scope 3' },
  sea_freight:        { label: 'Sea Freight',           icon: Ship,      scope: 'Scope 3' },
  air_freight:        { label: 'Air Freight',           icon: Plane,     scope: 'Scope 3' },
  courier:            { label: 'Courier / Parcel',      icon: Package,   scope: 'Scope 3' },
  packaging:          { label: 'Packaging',             icon: Package,   scope: 'Scope 3' },
  raw_materials:      { label: 'Raw Materials',         icon: Leaf,      scope: 'Scope 3' },
  waste:              { label: 'Waste',                 icon: Trash2,    scope: 'Scope 3' },
  accommodation:      { label: 'Accommodation',         icon: Hotel,     scope: 'Scope 3' },
  other:              { label: 'Other',                 icon: Leaf,      scope: '' },
}

interface UpgradePromptCardProps {
  category: string
  totalSpend: number
  estimatedEmissionsKg: number
  transactionCount: number
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
  earliestDate,
  latestDate,
  canUpgrade,
  isUpgraded = false,
  onUpgrade,
  onDismiss,
}: UpgradePromptCardProps) {
  const meta = CATEGORY_META[category] || CATEGORY_META.other
  const Icon = meta.icon

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
      : `${formatShortDate(earliestDate)} \u2013 ${formatShortDate(latestDate)}`
    : null

  return (
    <Card className={isUpgraded ? 'border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/10' : undefined}>
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            isUpgraded
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
          }`}>
            <Icon className="h-5 w-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">{meta.label}</h4>
              {meta.scope && (
                <Badge variant="outline" className="text-xs font-normal">
                  {meta.scope}
                </Badge>
              )}
              {isUpgraded && (
                <Badge
                  variant="outline"
                  className="text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Activity-based
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
              <span>{formattedSpend} identified</span>
              <span>{formattedEmissions} estimated</span>
              <span>{transactionCount} transaction{transactionCount !== 1 ? 's' : ''}</span>
              {dateRange && <span>{dateRange}</span>}
            </div>
          </div>

          {/* Actions */}
          {!isUpgraded && (
            <div className="flex items-center gap-2 shrink-0">
              {canUpgrade && onUpgrade && (
                <Button size="sm" onClick={onUpgrade}>
                  <ArrowUpCircle className="h-4 w-4 mr-1" />
                  Add Detail
                </Button>
              )}
              {!canUpgrade && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Coming in Phase 2
                </Badge>
              )}
              {onDismiss && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={onDismiss}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
