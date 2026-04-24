/**
 * Source priority rules for the emissions coverage resolver.
 *
 * For each scope slice, lists candidate sources in descending priority. When
 * multiple sources touch the same (slice, period), the resolver keeps the
 * highest-priority one and marks the others suppressed.
 *
 * Slices NOT listed here have no suppression applied — all contributing rows
 * sum as today. This is deliberate for scope3.products (raw_materials /
 * packaging) where per-ingredient linking lands in Phase 2.
 */

import type { EmissionSource, ScopeSlice } from './types'

export interface PriorityRule {
  /** Sources in descending priority order. First present source wins. */
  sources: EmissionSource[]
}

/**
 * Activity-data-first rules (GHG Protocol data-quality hierarchy):
 * direct metered > supplier-specific > spend-based.
 *
 * Locked decisions:
 * - Utility bill always wins over Xero energy rows for the same month.
 * - corporate_overheads.business_travel wins over Xero air/rail/accommodation.
 * - corporate_overheads.downstream_logistics wins over Xero freight categories.
 * - Raw materials / packaging intentionally have NO rule in Phase 1 — the plan
 *   calls for warn-only until Phase 2 adds per-ingredient linking.
 */
export const SOURCE_PRIORITY: Partial<Record<ScopeSlice, PriorityRule>> = {
  // Scope 1 — stationary and mobile combustion
  'scope1.natural_gas': { sources: ['utility_data_entries', 'xero_transactions'] },
  'scope1.diesel_stationary': { sources: ['utility_data_entries', 'fleet_activities', 'xero_transactions'] },
  'scope1.diesel_mobile': { sources: ['fleet_activities', 'utility_data_entries', 'xero_transactions'] },
  'scope1.petrol_mobile': { sources: ['fleet_activities', 'utility_data_entries', 'xero_transactions'] },
  'scope1.lpg': { sources: ['utility_data_entries', 'xero_transactions'] },
  'scope1.heavy_fuel_oil': { sources: ['utility_data_entries', 'xero_transactions'] },

  // Scope 2 — purchased energy
  'scope2.electricity': { sources: ['utility_data_entries', 'xero_transactions'] },
  'scope2.heat_steam': { sources: ['utility_data_entries', 'xero_transactions'] },

  // Scope 3 — activity-based overhead entries beat Xero spend for these slices
  'scope3.business_travel': { sources: ['corporate_overheads', 'xero_transactions'] },
  'scope3.downstream_logistics': { sources: ['corporate_overheads', 'xero_transactions'] },
  'scope3.employee_commuting': { sources: ['corporate_overheads', 'xero_transactions'] },
  'scope3.capital_goods': { sources: ['corporate_overheads', 'xero_transactions'] },
  'scope3.operational_waste': { sources: ['corporate_overheads', 'xero_transactions'] },
}

export function getRuleForSlice(slice: ScopeSlice): PriorityRule | null {
  return SOURCE_PRIORITY[slice] ?? null
}
