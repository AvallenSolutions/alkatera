'use client'

/**
 * Displays Xero-sourced energy spend baselines within Scope 1/2 tabs.
 *
 * When Xero transactions exist for energy categories (electricity, gas, diesel, etc.)
 * but haven't been upgraded to actual meter readings, this alert shows the
 * spend-based estimate and prompts the user to add utility data.
 */

import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ArrowUpCircle, ChevronDown, ChevronRight, Zap } from 'lucide-react'
import Link from 'next/link'
import type { XeroEntry } from '@/lib/xero/scope-card-mapping'
import { TIER_CONFIG } from '@/lib/xero/category-labels'

interface XeroEnergyBaselineAlertProps {
  entries: XeroEntry[]
  scope: 'Scope 1' | 'Scope 2'
}

export function XeroEnergyBaselineAlert({ entries, scope }: XeroEnergyBaselineAlertProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!entries || entries.length === 0) return null

  const totalEmissions = entries.reduce((sum, e) => sum + e.emissionsKg, 0)
  const totalSpend = entries.reduce((sum, e) => sum + e.amount, 0)
  const currency = entries[0]?.currency || 'GBP'

  const formatCurrency = (amount: number, cur: string) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, minimumFractionDigits: 0 }).format(amount)

  const formatEmissions = (kg: number) => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(2)} tCO2e`
    return `${Math.round(kg)} kg CO2e`
  }

  // Group by category label for the breakdown
  const byCategory = new Map<string, { count: number; spend: number; emissions: number }>()
  for (const entry of entries) {
    const existing = byCategory.get(entry.categoryLabel) || { count: 0, spend: 0, emissions: 0 }
    existing.count++
    existing.spend += entry.amount
    existing.emissions += entry.emissionsKg
    byCategory.set(entry.categoryLabel, existing)
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <Zap className="h-4 w-4 text-amber-500" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">
                  Xero spend baseline: {formatEmissions(totalEmissions)}
                </span>
                <Badge variant="outline" className={`text-[9px] ${TIER_CONFIG[4].colour}`}>
                  {TIER_CONFIG[4].label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(totalSpend, currency)} in energy spend from {entries.length} Xero transaction{entries.length !== 1 ? 's' : ''}.
                Add actual meter readings at facility level for accurate {scope} data.
              </p>
            </div>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              <Button variant="outline" size="sm" className="h-7 text-xs border-amber-200 dark:border-amber-800" asChild>
                <Link href="/company/facilities">
                  <ArrowUpCircle className="h-3 w-3 mr-1.5" />
                  Add Utility Data
                </Link>
              </Button>
              {Array.from(byCategory.entries()).length > 1 && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
          </div>

          <CollapsibleContent>
            <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800 space-y-1">
              {Array.from(byCategory.entries()).map(([label, data]) => (
                <div key={label} className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {data.count} tx, {formatCurrency(data.spend, currency)}
                    </span>
                  </div>
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {formatEmissions(data.emissions)}
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </AlertDescription>
      </Alert>
    </Collapsible>
  )
}
