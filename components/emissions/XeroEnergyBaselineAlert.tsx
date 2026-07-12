'use client'

/**
 * Displays Xero-sourced energy spend baselines within the emissions page.
 *
 * When Xero transactions exist for energy categories (electricity, gas, diesel, etc.)
 * but haven't been upgraded to actual meter readings, this quiet row shows the
 * spend-based estimate and prompts the user to add utility data. Studio re-cut:
 * a hairline panel, a working-tone chip and typographic actions, no icons.
 */

import { useState } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import Link from 'next/link'
import { StateChip } from '@/components/studio/state-chip'
import type { XeroEntry } from '@/lib/xero/scope-card-mapping'

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
      <div className="rounded-[6px] border border-studio-hairline bg-studio-cream px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <span className="text-sm font-medium text-foreground">
                Xero spend baseline: {formatEmissions(totalEmissions)}
              </span>
              <StateChip tone="attention">Tier 4 · Spend estimate</StateChip>
            </div>
            <p className="mt-0.5 text-xs text-studio-dim">
              {formatCurrency(totalSpend, currency)} in energy spend from {entries.length} Xero transaction{entries.length !== 1 ? 's' : ''}.
              Add actual meter readings at facility level for accurate {scope} data.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <Link
              href="/company/facilities"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent transition-colors hover:text-foreground"
            >
              Add utility data
            </Link>
            {Array.from(byCategory.entries()).length > 1 && (
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim transition-colors hover:text-foreground"
                >
                  {isOpen ? 'Hide breakdown' : 'Breakdown'}
                </button>
              </CollapsibleTrigger>
            )}
          </div>
        </div>

        <CollapsibleContent>
          <div className="mt-2 space-y-1 border-t border-studio-hairline pt-2">
            {Array.from(byCategory.entries()).map(([label, data]) => (
              <div key={label} className="flex items-center justify-between py-0.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-studio-dim">{label}</span>
                  <span className="font-mono text-[10px] text-studio-dim">
                    {data.count} tx · {formatCurrency(data.spend, currency)}
                  </span>
                </div>
                <span className="font-mono tabular-nums font-medium text-studio-attention">
                  {formatEmissions(data.emissions)}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
