'use client'

/**
 * Displays un-upgraded Xero transactions within a Scope 3 overhead card.
 *
 * Renders as a collapsible amber-tinted section below the manual entries,
 * clearly labelled as spend-based estimates with an upgrade CTA.
 */

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, ChevronRight, ArrowUpCircle } from 'lucide-react'
import Link from 'next/link'
import type { XeroEntry } from '@/lib/xero/scope-card-mapping'
import { TIER_CONFIG } from '@/lib/xero/category-labels'

interface XeroSpendEntriesProps {
  entries: XeroEntry[]
  upgradeHref?: string
}

export function XeroSpendEntries({ entries, upgradeHref = '/data/xero-upgrades/' }: XeroSpendEntriesProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!entries || entries.length === 0) return null

  const totalEmissions = entries.reduce((sum, e) => sum + e.emissionsKg, 0)
  const totalSpend = entries.reduce((sum, e) => sum + e.amount, 0)
  // Use the most common currency for the summary
  const currency = entries[0]?.currency || 'GBP'

  const formatCurrency = (amount: number, cur: string) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, minimumFractionDigits: 0 }).format(amount)

  const formatEmissions = (kg: number) => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(2)} tCO2e`
    return `${Math.round(kg)} kg CO2e`
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    })
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border-l-2 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 rounded-r-md mt-3">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/20 rounded-r-md transition-colors">
            <div className="flex items-center gap-2">
              {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-amber-600" /> : <ChevronRight className="h-3.5 w-3.5 text-amber-600" />}
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                {entries.length} Xero transaction{entries.length !== 1 ? 's' : ''}
              </span>
              <Badge variant="outline" className={`text-[9px] ${TIER_CONFIG[4].colour}`}>
                {TIER_CONFIG[4].label}
              </Badge>
            </div>
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {formatEmissions(totalEmissions)}
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-2 space-y-1">
            <p className="text-[10px] text-muted-foreground mb-1.5">
              Spend-based estimates ({formatCurrency(totalSpend, currency)} total). Upgrade for activity-based accuracy.
            </p>

            {entries.map(entry => (
              <div
                key={entry.id}
                className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-amber-100/50 dark:hover:bg-amber-900/20"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="truncate max-w-[140px] text-muted-foreground" title={entry.supplierName}>
                    {entry.supplierName}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDate(entry.date)}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatCurrency(entry.amount, entry.currency)}
                  </span>
                </div>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0 ml-2">
                  {formatEmissions(entry.emissionsKg)}
                </span>
              </div>
            ))}

            <div className="pt-1.5">
              <Button variant="outline" size="sm" className="w-full h-7 text-xs border-amber-200 dark:border-amber-800" asChild>
                <Link href={upgradeHref}>
                  <ArrowUpCircle className="h-3 w-3 mr-1.5" />
                  Upgrade to activity-based data
                </Link>
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
