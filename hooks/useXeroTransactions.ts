'use client'

/**
 * Hook to fetch un-upgraded Xero transactions for the Company Emissions page.
 *
 * Groups transactions by scope and overhead category so they can be injected
 * into the correct scope tab and card alongside manually entered data.
 */

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { CATEGORY_LABELS } from '@/lib/xero/category-labels'
import {
  getXeroScopeMapping,
  groupXeroByOverheadCategory,
  type XeroEntry,
} from '@/lib/xero/scope-card-mapping'

export type { XeroEntry }

interface UseXeroTransactionsResult {
  /** All un-upgraded Xero entries grouped by overhead category key */
  xeroByCategory: Map<string, XeroEntry[]>
  /** Scope 1 energy entries (gas, diesel, etc.) */
  scope1Entries: XeroEntry[]
  /** Scope 2 energy entries (electricity) */
  scope2Entries: XeroEntry[]
  /** Total spend-based emissions for Scope 1 (kg) */
  totalScope1Kg: number
  /** Total spend-based emissions for Scope 2 (kg) */
  totalScope2Kg: number
  /** Total spend-based emissions for Scope 3 (kg) */
  totalScope3Kg: number
  /** Whether data is still loading */
  isLoading: boolean
  /** Whether the org has an active Xero connection */
  hasConnection: boolean
}

export function useXeroTransactions(
  organizationId: string | undefined,
  yearStart: string,
  yearEnd: string
): UseXeroTransactionsResult {
  const [result, setResult] = useState<UseXeroTransactionsResult>({
    xeroByCategory: new Map(),
    scope1Entries: [],
    scope2Entries: [],
    totalScope1Kg: 0,
    totalScope2Kg: 0,
    totalScope3Kg: 0,
    isLoading: true,
    hasConnection: false,
  })

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setResult(prev => ({ ...prev, isLoading: false }))
      return
    }

    try {
    const supabase = getSupabaseBrowserClient()

    // Check for Xero connection
    const { count: connCount } = await supabase
      .from('xero_connections')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    if (!connCount || connCount === 0) {
      setResult(prev => ({ ...prev, isLoading: false, hasConnection: false }))
      return
    }

    // Fetch un-upgraded Xero transactions within date range
    const { data } = await supabase
      .from('xero_transactions')
      .select('id, xero_contact_name, description, amount, currency, emission_category, spend_based_emissions_kg, transaction_date')
      .eq('organization_id', organizationId)
      .not('emission_category', 'is', null)
      .neq('upgrade_status', 'upgraded')
      .neq('upgrade_status', 'dismissed')
      .gte('transaction_date', yearStart)
      .lte('transaction_date', yearEnd)

    if (!data || data.length === 0) {
      setResult(prev => ({
        ...prev,
        isLoading: false,
        hasConnection: true,
        xeroByCategory: new Map(),
        scope1Entries: [],
        scope2Entries: [],
        totalScope1Kg: 0,
        totalScope2Kg: 0,
        totalScope3Kg: 0,
      }))
      return
    }

    // Map to XeroEntry objects
    const entries: XeroEntry[] = data.map(tx => ({
      id: tx.id,
      supplierName: tx.xero_contact_name || 'Unknown supplier',
      description: tx.description || '',
      amount: Math.abs(tx.amount || 0),
      currency: tx.currency || 'GBP',
      emissionsKg: Math.abs(tx.spend_based_emissions_kg || 0),
      date: tx.transaction_date || '',
      emissionCategory: tx.emission_category!,
      categoryLabel: CATEGORY_LABELS[tx.emission_category!] || tx.emission_category!,
    }))

    // Group by overhead category
    const grouped = groupXeroByOverheadCategory(entries)

    // Extract scope 1/2 entries and calculate totals
    const scope1 = grouped.get('scope1') || []
    const scope2 = grouped.get('scope2') || []

    let totalScope1 = 0
    let totalScope2 = 0
    let totalScope3 = 0

    for (const entry of entries) {
      const mapping = getXeroScopeMapping(entry.emissionCategory)
      if (mapping.scope === 1) totalScope1 += entry.emissionsKg
      else if (mapping.scope === 2) totalScope2 += entry.emissionsKg
      else totalScope3 += entry.emissionsKg
    }

    setResult({
      xeroByCategory: grouped,
      scope1Entries: scope1,
      scope2Entries: scope2,
      totalScope1Kg: totalScope1,
      totalScope2Kg: totalScope2,
      totalScope3Kg: totalScope3,
      isLoading: false,
      hasConnection: true,
    })
    } catch (err) {
      console.error('Error loading Xero transactions:', err)
      setResult(prev => ({ ...prev, isLoading: false }))
    }
  }, [organizationId, yearStart, yearEnd])

  useEffect(() => {
    loadData()
  }, [loadData])

  return result
}
