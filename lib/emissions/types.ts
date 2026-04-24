/**
 * Shared types for the emissions double-count elimination project.
 *
 * Phase 0 (instrumentation) uses these in read-only traces.
 * Phase 1 (rules engine + resolver) produces them from the coverage resolver.
 * Phase 2 (inventory ledger) extends `source` with consumption-derived rows.
 */

export type EmissionSource =
  | 'utility_data_entries'
  | 'facility_activity_data'
  | 'fleet_activities'
  | 'product_lca'
  | 'corporate_overheads'
  | 'xero_transactions'
  | 'scope3_category_log'
  | 'inventory_ledger'

export type ScopeSlice =
  | 'scope1.natural_gas'
  | 'scope1.diesel_stationary'
  | 'scope1.diesel_mobile'
  | 'scope1.petrol_mobile'
  | 'scope1.lpg'
  | 'scope1.heavy_fuel_oil'
  | 'scope1.refrigerant'
  | 'scope1.fleet'
  | 'scope1.other'
  | 'scope2.electricity'
  | 'scope2.heat_steam'
  | 'scope2.fleet'
  | 'scope3.products'
  | 'scope3.business_travel'
  | 'scope3.employee_commuting'
  | 'scope3.capital_goods'
  | 'scope3.operational_waste'
  | 'scope3.downstream_logistics'
  | 'scope3.upstream_transport'
  | 'scope3.downstream_transport'
  | 'scope3.use_phase'
  | 'scope3.purchased_services'
  | 'scope3.marketing_materials'
  | 'scope3.fleet'
  | 'scope3.other'

export interface ResolvedEmissionRow {
  source: EmissionSource
  sourceRowId: string
  scopeSlice: ScopeSlice
  /** YYYY-MM for monthly-resolution coverage. Period-less rows fall back to the year. */
  period: string
  kgCO2e: number
  /** Phase 1+: true when a higher-priority source covers the same (scopeSlice, period). */
  suppressed: boolean
  suppressedBy: EmissionSource | null
  meta?: Record<string, unknown>
}

export interface SourceAttribution {
  scopeSlice: ScopeSlice
  period: string
  winningSource: EmissionSource | null
  kgCO2e: number
  suppressedSources: Array<{
    source: EmissionSource
    rowCount: number
    kgCO2e: number
  }>
}

export interface EmissionsTrace {
  organizationId: string
  year: number
  generatedAt: string
  rows: ResolvedEmissionRow[]
  attributions: SourceAttribution[]
  warnings: Array<{
    scopeSlice: ScopeSlice
    period: string
    message: string
    sources: EmissionSource[]
  }>
}
