/**
 * Slice-mapping helpers shared by the emissions resolver, trace route, and
 * client hooks. A single place to answer "which ScopeSlice does this row
 * belong to?" so the resolver sees consistent keys regardless of surface.
 */

import { getXeroScopeMapping } from '@/lib/xero/scope-card-mapping'
import type { ScopeSlice } from './types'

export const OVERHEAD_CATEGORY_TO_SLICE: Record<string, ScopeSlice> = {
  business_travel: 'scope3.business_travel',
  employee_commuting: 'scope3.employee_commuting',
  capital_goods: 'scope3.capital_goods',
  operational_waste: 'scope3.operational_waste',
  downstream_logistics: 'scope3.downstream_logistics',
  upstream_transport: 'scope3.upstream_transport',
  downstream_transport: 'scope3.downstream_transport',
  use_phase: 'scope3.use_phase',
  purchased_services: 'scope3.purchased_services',
  purchased_services_materials: 'scope3.marketing_materials',
}

/**
 * Utility data → ScopeSlice plus the kgCO2e/unit factor used by the
 * corporate-emissions calculator. Kept local so diagnostic surfaces
 * don't silently diverge from a factor change.
 */
export const UTILITY_SLICE_FACTOR: Record<string, { factor: number; slice: ScopeSlice }> = {
  natural_gas: { factor: 0.18293, slice: 'scope1.natural_gas' },
  natural_gas_m3: { factor: 0.18293 * 10.55, slice: 'scope1.natural_gas' },
  diesel_stationary: { factor: 2.68787, slice: 'scope1.diesel_stationary' },
  diesel_mobile: { factor: 2.68787, slice: 'scope1.diesel_mobile' },
  petrol_mobile: { factor: 2.31, slice: 'scope1.petrol_mobile' },
  lpg: { factor: 1.55537, slice: 'scope1.lpg' },
  heavy_fuel_oil: { factor: 3.17740, slice: 'scope1.heavy_fuel_oil' },
  biomass_solid: { factor: 0.01551, slice: 'scope1.other' },
  refrigerant_leakage: { factor: 1430, slice: 'scope1.refrigerant' },
  electricity_grid: { factor: 0.207, slice: 'scope2.electricity' },
  heat_steam_purchased: { factor: 0.1662, slice: 'scope2.heat_steam' },
}

export function scopeSliceForXero(category: string): ScopeSlice {
  const mapping = getXeroScopeMapping(category)
  if (mapping.scope === 1) {
    if (category === 'natural_gas') return 'scope1.natural_gas'
    if (category === 'diesel_stationary') return 'scope1.diesel_stationary'
    if (category === 'diesel_mobile') return 'scope1.diesel_mobile'
    if (category === 'petrol_mobile') return 'scope1.petrol_mobile'
    if (category === 'lpg') return 'scope1.lpg'
    return 'scope1.other'
  }
  if (mapping.scope === 2) return 'scope2.electricity'
  if (mapping.overheadCategory && OVERHEAD_CATEGORY_TO_SLICE[mapping.overheadCategory]) {
    return OVERHEAD_CATEGORY_TO_SLICE[mapping.overheadCategory]
  }
  return 'scope3.other'
}

export function scopeSliceForOverhead(category: string, materialType: string | null): ScopeSlice {
  if (category === 'purchased_services' && materialType) return 'scope3.marketing_materials'
  return OVERHEAD_CATEGORY_TO_SLICE[category] || 'scope3.other'
}

export function scopeSliceForFleet(scope: string | null): ScopeSlice {
  if (!scope) return 'scope1.fleet'
  if (scope.startsWith('Scope 1')) return 'scope1.fleet'
  if (scope.startsWith('Scope 2')) return 'scope2.fleet'
  return 'scope3.fleet'
}

export function periodFromDate(iso: string | null | undefined): string {
  if (!iso) return 'unknown'
  return iso.slice(0, 7)
}
