'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, ChevronRight, ArrowUpCircle, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { CATEGORY_LABELS } from '@/lib/xero/category-labels'
import Link from 'next/link'

interface CategoryBreakdown {
  category: string
  label: string
  spend: number
  emissionsKg: number
  transactionCount: number
}

interface XeroBaselineCardProps {
  organizationId: string
  yearStart: string
  yearEnd: string
  onTotalCalculated?: (totalKg: number) => void
}

export function XeroBaselineCard({
  organizationId,
  yearStart,
  yearEnd,
  onTotalCalculated,
}: XeroBaselineCardProps) {
  const [breakdowns, setBreakdowns] = useState<CategoryBreakdown[]>([])
  const [totalEmissions, setTotalEmissions] = useState(0)
  const [hasConnection, setHasConnection] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currency, setCurrency] = useState('GBP')

  const loadData = useCallback(async () => {
    // Check for Xero connection
    const { count: connCount } = await supabase
      .from('xero_connections')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    if (!connCount || connCount === 0) {
      setHasConnection(false)
      setIsLoading(false)
      return
    }
    setHasConnection(true)

    // Fetch un-upgraded Xero transactions within date range
    const { data } = await supabase
      .from('xero_transactions')
      .select('emission_category, amount, spend_based_emissions_kg, currency')
      .eq('organization_id', organizationId)
      .not('emission_category', 'is', null)
      .neq('upgrade_status', 'upgraded')
      .neq('upgrade_status', 'dismissed')
      .gte('transaction_date', yearStart)
      .lte('transaction_date', yearEnd)

    if (!data || data.length === 0) {
      setIsLoading(false)
      onTotalCalculated?.(0)
      return
    }

    // Detect predominant currency for display
    const currencyCounts = new Map<string, number>()
    for (const tx of data) {
      const c = tx.currency || 'GBP'
      currencyCounts.set(c, (currencyCounts.get(c) || 0) + 1)
    }
    let predominantCurrency = 'GBP'
    let maxCount = 0
    currencyCounts.forEach((count, currency) => {
      if (count > maxCount) { maxCount = count; predominantCurrency = currency }
    })

    // Aggregate by category
    const catMap = new Map<string, { spend: number; emissions: number; count: number }>()
    for (const tx of data) {
      if (!tx.emission_category) continue
      const existing = catMap.get(tx.emission_category) || { spend: 0, emissions: 0, count: 0 }
      existing.spend += Math.abs(tx.amount || 0)
      existing.emissions += Math.abs(tx.spend_based_emissions_kg || 0)
      existing.count++
      catMap.set(tx.emission_category, existing)
    }

    const sorted = Array.from(catMap.entries())
      .map(([cat, data]) => ({
        category: cat,
        label: CATEGORY_LABELS[cat] || cat,
        spend: data.spend,
        emissionsKg: data.emissions,
        transactionCount: data.count,
      }))
      .sort((a, b) => b.emissionsKg - a.emissionsKg)

    const total = sorted.reduce((sum, b) => sum + b.emissionsKg, 0)
    setBreakdowns(sorted)
    setTotalEmissions(total)
    setCurrency(predominantCurrency)
    onTotalCalculated?.(total)
    setIsLoading(false)
  }, [organizationId, yearStart, yearEnd, onTotalCalculated])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (isLoading || !hasConnection || breakdowns.length === 0) return null

  const formatEmissions = (kg: number) => {
    if (kg >= 1000) return `${(kg / 1000).toFixed(2)} tCO2e`
    return `${Math.round(kg)} kg CO2e`
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpCircle className="h-4 w-4 text-amber-500" />
              Xero Spend Baselines
              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:text-amber-400">
                Tier 4
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {formatEmissions(totalEmissions)}
              </span>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Spend-based emission estimates from {breakdowns.reduce((s, b) => s + b.transactionCount, 0)} un-upgraded Xero transactions.
            Upgrade to activity-based data for higher accuracy.
          </p>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            <div className="space-y-1">
              {breakdowns.map(b => (
                <div
                  key={b.category}
                  className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {b.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {b.transactionCount} tx, {formatCurrency(b.spend)}
                    </span>
                  </div>
                  <span className="text-sm font-medium shrink-0 ml-2">
                    {formatEmissions(b.emissionsKg)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t">
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link href="/data/xero-upgrades/">
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Upgrade data quality in the Action Centre
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
