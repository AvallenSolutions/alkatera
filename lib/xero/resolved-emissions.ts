/**
 * Pure Xero → resolved emissions helper.
 *
 * Pulls Xero spend-based emissions for an org + year range, then runs the
 * coverage resolver against utility / overhead / inventory-ledger / LCA
 * sources so a Xero line that overlaps a higher-priority source for the
 * same (scope slice, month) drops out deterministically.
 *
 * Callable from both the browser (useXeroTransactions hook) and the
 * server (calculateCorporateEmissions, snapshot writer, Rosa). No React,
 * no hooks, no client-only globals.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
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
import type { EmissionSource, ResolvedEmissionRow, ScopeSlice } from '@/lib/emissions/types'

/**
 * Scope 1 fuel slices that `fleet_activities` takes priority over `xero_transactions` for
 * (per lib/emissions/source-priority.ts). The fleet activity table doesn't expose a
 * fuel_type column, so when an org logs fleet emissions in month M we treat that as
 * "fleet has already accounted for vehicle fuel in M" and let the resolver suppress
 * any Xero fuel-purchase rows in M to prevent double-counting.
 */
const FLEET_SCOPE1_CANDIDATE_SLICES: ScopeSlice[] = [
  'scope1.diesel_mobile',
  'scope1.petrol_mobile',
  'scope1.diesel_stationary',
]

export interface XeroResolvedEmissions {
  /** All un-upgraded, non-suppressed Xero entries grouped by overhead category key. */
  xeroByCategory: Map<string, XeroEntry[]>
  /** Scope 1 energy entries (gas, diesel, etc.) — kept (not suppressed). */
  scope1Entries: XeroEntry[]
  /** Scope 2 energy entries (electricity) — kept (not suppressed). */
  scope2Entries: XeroEntry[]
  /** Spend-based emissions, post-suppression, in kg CO₂e. */
  totalScope1Kg: number
  totalScope2Kg: number
  /** Includes inventoryLedgerKg (non-LCA-covered material consumption). */
  totalScope3Kg: number
  /** Rows the resolver suppressed (Xero overlapping with a higher-priority source). */
  suppressedCount: number
  suppressedKg: number
  suppressedByLcaCount: number
  suppressedByInventoryCount: number
  /** Material consumption rows that aren't covered by a product LCA, booked at the consumption date. */
  inventoryLedgerKg: number
  /** Whether the org has an active Xero connection. */
  hasConnection: boolean
}

const EMPTY: XeroResolvedEmissions = {
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
  hasConnection: false,
}

export async function getXeroResolvedEmissions(
  supabase: SupabaseClient,
  organizationId: string,
  yearStart: string,
  yearEnd: string,
): Promise<XeroResolvedEmissions> {
  const { count: connCount } = await supabase
    .from('xero_connections')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  if (!connCount || connCount === 0) {
    return { ...EMPTY, hasConnection: false }
  }

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
    return { ...EMPTY, hasConnection: true }
  }

  const facilityIds = (facilitiesRes.data || []).map((f: { id: string }) => f.id)
  const reportIds = (reportsRes.data || []).map((r: { id: string }) => r.id)

  const [utilityRes, overheadRes, linksRes, consumptionsRes, lcaCoveredIds, fleetRes] = await Promise.all([
    facilityIds.length > 0
      ? supabase
          .from('utility_data_entries')
          .select('id, utility_type, quantity, unit, reporting_period_start, reporting_period_end')
          .in('facility_id', facilityIds)
          // Overlap, not "start within window": a facility entry on a non-calendar
          // or custom 12-month period (e.g. 15 Jun 2024 – 14 Jun 2025) still
          // overlaps the reporting window even when its start falls outside it.
          .lte('reporting_period_start', yearEnd)
          .gte('reporting_period_end', yearStart)
      : Promise.resolve({ data: [] as any[] }),
    reportIds.length > 0
      ? supabase
          .from('corporate_overheads')
          .select('id, category, material_type, entry_date, computed_co2e')
          .in('report_id', reportIds)
      : Promise.resolve({ data: [] as any[] }),
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
    // Pulled purely as a *suppression signal* for the resolver — fleet rows are
    // never added to the helper's returned totals here (calculateScope1/2 already
    // sums them in the SoT path). Their presence in a (slice, month) cell lets
    // the resolver mark overlapping Xero fuel rows as suppressed.
    supabase
      .from('fleet_activities')
      .select('id, scope, reporting_period_start, reporting_period_end, emissions_tco2e')
      .eq('organization_id', organizationId)
      // Overlap, not "start within window" (see utility query above).
      .lte('reporting_period_start', yearEnd)
      .gte('reporting_period_end', yearStart),
  ])

  const linkedIngredientByTxId = new Map<string, string>()
  for (const l of (linksRes.data || []) as Array<{ xero_transaction_id: string; ingredient_id: string }>) {
    linkedIngredientByTxId.set(l.xero_transaction_id, l.ingredient_id)
  }

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
    const gasUnit = (u.unit || '').toLowerCase().trim()
    if (u.utility_type === 'natural_gas' && (gasUnit === 'm3' || gasUnit === 'm³')) factorKey = 'natural_gas_m3'
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

  // Fleet activities → candidate rows at every Scope 1 fuel slice that has a
  // fleet-priority rule. `fleet_activities` doesn't expose a fuel type, so we
  // can't pinpoint which Xero category a given fleet row collides with; the
  // safe default is "if fleet logged Scope 1 emissions in month M, any Xero
  // fuel purchase in M is already represented by the activity-based fleet
  // calc and must be suppressed." The fleet rows themselves never feed the
  // helper's returned totals (the downstream filter keys only on
  // source === 'xero_transactions').
  for (const f of (fleetRes.data || []) as Array<{
    id: string
    scope: string | null
    reporting_period_start: string | null
    emissions_tco2e: number | null
  }>) {
    const scope = f.scope || ''
    if (!scope.startsWith('Scope 1')) continue
    const kg = (Number(f.emissions_tco2e) || 0) * 1000
    if (kg <= 0) continue
    const period = periodFromDate(f.reporting_period_start)
    for (const slice of FLEET_SCOPE1_CANDIDATE_SLICES) {
      rows.push({
        source: 'fleet_activities',
        sourceRowId: `${f.id}:${slice}`,
        scopeSlice: slice,
        period,
        kgCO2e: kg,
        suppressed: false,
        suppressedBy: null,
      })
    }
  }

  const resolved = resolveSuppressions(rows)

  const suppressedXeroRows = resolved.filter(
    (r: ResolvedEmissionRow) => r.source === ('xero_transactions' as EmissionSource) && r.suppressed,
  )
  const suppressedXeroIds = new Set<string>(suppressedXeroRows.map((r: ResolvedEmissionRow) => r.sourceRowId))
  const suppressedKg = suppressedXeroRows.reduce((s: number, r: ResolvedEmissionRow) => s + r.kgCO2e, 0)
  const suppressedByLcaCount = suppressedXeroRows.filter((r: ResolvedEmissionRow) => r.suppressedBy === 'product_lca').length
  const suppressedByInventoryCount = suppressedXeroRows.filter((r: ResolvedEmissionRow) => r.suppressedBy === 'inventory_ledger').length
  const inventoryLedgerKg = resolved
    .filter((r: ResolvedEmissionRow) => r.source === 'inventory_ledger' && !r.suppressed)
    .reduce((s: number, r: ResolvedEmissionRow) => s + r.kgCO2e, 0)

  const keptData = xeroData.filter((tx) => !suppressedXeroIds.has(tx.id))

  const entries: XeroEntry[] = keptData.map((tx) => ({
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

  return {
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
    hasConnection: true,
  }
}
