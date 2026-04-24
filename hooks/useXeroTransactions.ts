'use client'

/**
 * Hook to fetch un-upgraded Xero transactions for the Company Emissions page.
 *
 * Phase 1b: runs the emissions coverage resolver against Xero + utility +
 * overhead rows, so Xero lines that overlap a higher-priority source for
 * the same (scope slice, month) are filtered out deterministically. This
 * replaces the old behaviour where only user-driven upgrade_status stopped
 * the sum.
 */

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { CATEGORY_LABELS } from '@/lib/xero/category-labels'
import {
  getXeroScopeMapping,
  groupXeroByOverheadCategory,
  type XeroEntry,
} from '@/lib/xero/scope-card-mapping'
import { resolveSuppressions } from '@/lib/emissions/coverage-resolver'
import {
  UTILITY_SLICE_FACTOR,
  periodFromDate,
  scopeSliceForOverhead,
  scopeSliceForXero,
} from '@/lib/emissions/slice-mapping'
import { getLcaCoveredIngredientIds } from '@/lib/emissions/lca-coverage'
import type { EmissionSource, ResolvedEmissionRow } from '@/lib/emissions/types'

export type { XeroEntry }

interface UseXeroTransactionsResult {
  /** All un-upgraded, non-suppressed Xero entries grouped by overhead category key */
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
  /** Number of Xero rows hidden by the resolver (a higher-priority source covered the same period). */
  suppressedCount: number
  /** kgCO2e hidden by the resolver — useful to explain total changes to users. */
  suppressedKg: number
  /** Xero rows suppressed because the linked ingredient is already in a completed product LCA. */
  suppressedByLcaCount: number
  /** Xero rows suppressed because the inventory ledger now books them at the consumption date. */
  suppressedByInventoryCount: number
  /** Consumption-date scope 3 emissions from the inventory ledger (products without an LCA). */
  inventoryLedgerKg: number
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
    suppressedCount: 0,
    suppressedKg: 0,
    suppressedByLcaCount: 0,
    suppressedByInventoryCount: 0,
    inventoryLedgerKg: 0,
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

      const { count: connCount } = await supabase
        .from('xero_connections')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)

      if (!connCount || connCount === 0) {
        setResult(prev => ({ ...prev, isLoading: false, hasConnection: false }))
        return
      }

      // Derive year from yearStart (YYYY-MM-DD) for corporate_reports lookup
      const year = Number(yearStart.slice(0, 4))

      const [xeroRes, facilitiesRes, reportsRes] = await Promise.all([
        supabase
          .from('xero_transactions')
          .select('id, xero_contact_name, description, amount, currency, emission_category, spend_based_emissions_kg, transaction_date, upgrade_status')
          .eq('organization_id', organizationId)
          .not('emission_category', 'is', null)
          .neq('upgrade_status', 'upgraded')
          .neq('upgrade_status', 'dismissed')
          .gte('transaction_date', yearStart)
          .lte('transaction_date', yearEnd),
        supabase
          .from('facilities')
          .select('id')
          .eq('organization_id', organizationId),
        supabase
          .from('corporate_reports')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('year', year),
      ])

      const xeroData = xeroRes.data || []

      if (xeroData.length === 0) {
        setResult({
          xeroByCategory: new Map(),
          scope1Entries: [],
          scope2Entries: [],
          totalScope1Kg: 0,
          totalScope2Kg: 0,
          totalScope3Kg: 0,
          suppressedCount: 0,
          suppressedKg: 0,
          suppressedByLcaCount: 0,
          suppressedByInventoryCount: 0,
          inventoryLedgerKg: 0,
          isLoading: false,
          hasConnection: true,
        })
        return
      }

      // Load utility + overhead rows that could outrank a Xero row for the same slice+month
      const facilityIds = (facilitiesRes.data || []).map((f: { id: string }) => f.id)
      const reportIds = (reportsRes.data || []).map((r: { id: string }) => r.id)

      const [utilityRes, overheadRes, linksRes, consumptionsRes, lcaCoveredIds] = await Promise.all([
        facilityIds.length > 0
          ? supabase
              .from('utility_data_entries')
              .select('id, utility_type, quantity, unit, reporting_period_start')
              .in('facility_id', facilityIds)
              .gte('reporting_period_start', yearStart)
              .lte('reporting_period_start', yearEnd)
          : Promise.resolve({ data: [] }),
        reportIds.length > 0
          ? supabase
              .from('corporate_overheads')
              .select('id, category, material_type, entry_date, computed_co2e')
              .in('report_id', reportIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from('material_ingredient_links')
          .select('xero_transaction_id, ingredient_id')
          .eq('organization_id', organizationId),
        supabase
          .from('material_consumptions')
          .select('id, ingredient_id, consumed_emission_kg, consumption_date')
          .eq('organization_id', organizationId)
          .gte('consumption_date', yearStart)
          .lte('consumption_date', yearEnd),
        getLcaCoveredIngredientIds(supabase, organizationId),
      ])

      const linkedIngredientByTxId = new Map<string, string>()
      for (const l of (linksRes.data || []) as Array<{ xero_transaction_id: string; ingredient_id: string }>) {
        linkedIngredientByTxId.set(l.xero_transaction_id, l.ingredient_id)
      }

      // Build candidate ResolvedEmissionRow[] for all three sources
      const rows: ResolvedEmissionRow[] = []

      for (const tx of xeroData) {
        if (!tx.emission_category || !tx.spend_based_emissions_kg) continue
        const linkedIngredientId = linkedIngredientByTxId.get(tx.id) || null
        let preSuppressed = false
        let preSuppressedBy: EmissionSource | null = null
        if (linkedIngredientId) {
          if (lcaCoveredIds.has(linkedIngredientId)) {
            preSuppressed = true
            preSuppressedBy = 'product_lca'
          } else {
            preSuppressed = true
            preSuppressedBy = 'inventory_ledger'
          }
        }
        rows.push({
          source: 'xero_transactions',
          sourceRowId: tx.id,
          scopeSlice: scopeSliceForXero(tx.emission_category),
          period: periodFromDate(tx.transaction_date),
          kgCO2e: Math.abs(Number(tx.spend_based_emissions_kg) || 0),
          suppressed: preSuppressed,
          suppressedBy: preSuppressedBy,
        })
      }

      for (const c of (consumptionsRes.data || []) as Array<{
        id: string
        ingredient_id: string
        consumed_emission_kg: number | null
        consumption_date: string
      }>) {
        if (lcaCoveredIds.has(c.ingredient_id)) continue
        const kg = Number(c.consumed_emission_kg) || 0
        if (kg <= 0) continue
        rows.push({
          source: 'inventory_ledger',
          sourceRowId: c.id,
          scopeSlice: 'scope3.products',
          period: periodFromDate(c.consumption_date),
          kgCO2e: kg,
          suppressed: false,
          suppressedBy: null,
        })
      }

      for (const u of (utilityRes.data || []) as Array<{
        id: string
        utility_type: string
        quantity: number
        unit: string | null
        reporting_period_start: string
      }>) {
        let factorKey: keyof typeof UTILITY_SLICE_FACTOR | null = null
        if (u.utility_type === 'natural_gas' && u.unit === 'm3') factorKey = 'natural_gas_m3'
        else if (u.utility_type in UTILITY_SLICE_FACTOR) factorKey = u.utility_type as keyof typeof UTILITY_SLICE_FACTOR
        if (!factorKey) continue
        const { factor, slice } = UTILITY_SLICE_FACTOR[factorKey]
        rows.push({
          source: 'utility_data_entries',
          sourceRowId: u.id,
          scopeSlice: slice,
          period: periodFromDate(u.reporting_period_start),
          kgCO2e: Number(u.quantity) * factor,
          suppressed: false,
          suppressedBy: null,
        })
      }

      for (const o of (overheadRes.data || []) as Array<{
        id: string
        category: string
        material_type: string | null
        entry_date: string | null
        computed_co2e: number | null
      }>) {
        if (!o.computed_co2e) continue
        rows.push({
          source: 'corporate_overheads',
          sourceRowId: o.id,
          scopeSlice: scopeSliceForOverhead(o.category, o.material_type),
          period: periodFromDate(o.entry_date || yearStart),
          kgCO2e: Number(o.computed_co2e),
          suppressed: false,
          suppressedBy: null,
        })
      }

      const resolved = resolveSuppressions(rows)

      const suppressedXeroRows = resolved.filter(
        (r: ResolvedEmissionRow) => r.source === ('xero_transactions' as EmissionSource) && r.suppressed,
      )
      const suppressedXeroIds = new Set<string>(
        suppressedXeroRows.map((r: ResolvedEmissionRow) => r.sourceRowId),
      )
      const suppressedKg = suppressedXeroRows.reduce(
        (s: number, r: ResolvedEmissionRow) => s + r.kgCO2e,
        0,
      )
      const suppressedByLcaCount = suppressedXeroRows.filter(
        (r: ResolvedEmissionRow) => r.suppressedBy === 'product_lca',
      ).length
      const suppressedByInventoryCount = suppressedXeroRows.filter(
        (r: ResolvedEmissionRow) => r.suppressedBy === 'inventory_ledger',
      ).length
      const inventoryLedgerKg = resolved
        .filter((r: ResolvedEmissionRow) => r.source === 'inventory_ledger' && !r.suppressed)
        .reduce((s: number, r: ResolvedEmissionRow) => s + r.kgCO2e, 0)

      const keptData = xeroData.filter(tx => !suppressedXeroIds.has(tx.id))

      const entries: XeroEntry[] = keptData.map(tx => ({
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

      const grouped = groupXeroByOverheadCategory(entries)
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
        totalScope3Kg: totalScope3 + inventoryLedgerKg,
        suppressedCount: suppressedXeroIds.size,
        suppressedKg,
        suppressedByLcaCount,
        suppressedByInventoryCount,
        inventoryLedgerKg,
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
