/**
 * Maps Xero emission categories to GHG Protocol scopes and
 * corporate_overheads categories for display on the Company Emissions page.
 *
 * Each Xero transaction is classified into an emission_category (e.g. air_travel,
 * grid_electricity). This module maps those to the correct scope tab and overhead
 * card so they appear alongside manually entered data.
 */

import { CATEGORY_LABELS } from './category-labels'

export interface ScopeCardMapping {
  /** GHG Protocol scope: 1, 2, or 3 */
  scope: 1 | 2 | 3
  /** The corporate_overheads category this maps to (null for Scope 1/2 energy) */
  overheadCategory: string | null
  /** Human-readable label for the target card */
  cardLabel: string
}

/**
 * Master mapping from Xero emission_category to scope + overhead card.
 */
export const XERO_TO_SCOPE_CARD_MAP: Record<string, ScopeCardMapping> = {
  // Scope 1: Direct emissions (energy/fuel)
  natural_gas:       { scope: 1, overheadCategory: null, cardLabel: 'Natural Gas' },
  diesel_stationary: { scope: 1, overheadCategory: null, cardLabel: 'Diesel (stationary)' },
  diesel_mobile:     { scope: 1, overheadCategory: null, cardLabel: 'Diesel (mobile)' },
  petrol_mobile:     { scope: 1, overheadCategory: null, cardLabel: 'Petrol (mobile)' },
  lpg:               { scope: 1, overheadCategory: null, cardLabel: 'LPG' },

  // Scope 2: Purchased energy
  grid_electricity:  { scope: 2, overheadCategory: null, cardLabel: 'Electricity' },

  // Scope 3: Value chain - Business Travel
  air_travel:        { scope: 3, overheadCategory: 'business_travel', cardLabel: 'Air Travel' },
  rail_travel:       { scope: 3, overheadCategory: 'business_travel', cardLabel: 'Rail Travel' },
  accommodation:     { scope: 3, overheadCategory: 'business_travel', cardLabel: 'Accommodation' },

  // Scope 3: Value chain - Logistics & Freight
  road_freight:      { scope: 3, overheadCategory: 'downstream_logistics', cardLabel: 'Road Freight' },
  sea_freight:       { scope: 3, overheadCategory: 'downstream_logistics', cardLabel: 'Sea Freight' },
  air_freight:       { scope: 3, overheadCategory: 'downstream_logistics', cardLabel: 'Air Freight' },
  courier:           { scope: 3, overheadCategory: 'downstream_logistics', cardLabel: 'Courier' },

  // Scope 3: Value chain - Purchased Services
  packaging:              { scope: 3, overheadCategory: 'purchased_services_materials', cardLabel: 'Packaging' },
  raw_materials:          { scope: 3, overheadCategory: 'purchased_services', cardLabel: 'Raw Materials' },
  professional_services:  { scope: 3, overheadCategory: 'purchased_services', cardLabel: 'Professional Services' },
  it_services:            { scope: 3, overheadCategory: 'purchased_services', cardLabel: 'IT Services' },
  telecoms:               { scope: 3, overheadCategory: 'purchased_services', cardLabel: 'Telecoms' },
  cleaning:               { scope: 3, overheadCategory: 'purchased_services', cardLabel: 'Cleaning' },
  maintenance:            { scope: 3, overheadCategory: 'purchased_services', cardLabel: 'Maintenance' },
  other:                  { scope: 3, overheadCategory: 'purchased_services', cardLabel: 'Other' },

  // Scope 3: Value chain - Waste & Water
  water:            { scope: 3, overheadCategory: 'operational_waste', cardLabel: 'Water' },
  waste:            { scope: 3, overheadCategory: 'operational_waste', cardLabel: 'Waste' },
  waste_management: { scope: 3, overheadCategory: 'operational_waste', cardLabel: 'Waste Management' },
}

/**
 * Get the scope/card mapping for a Xero emission category.
 * Falls back to Scope 3 / purchased_services for unknown categories.
 */
export function getXeroScopeMapping(emissionCategory: string): ScopeCardMapping {
  return XERO_TO_SCOPE_CARD_MAP[emissionCategory] || {
    scope: 3,
    overheadCategory: 'purchased_services',
    cardLabel: CATEGORY_LABELS[emissionCategory] || emissionCategory,
  }
}

/**
 * Get all Xero emission categories that map to a given scope.
 */
export function getScopeXeroCategories(scope: 1 | 2 | 3): string[] {
  return Object.entries(XERO_TO_SCOPE_CARD_MAP)
    .filter(([, mapping]) => mapping.scope === scope)
    .map(([category]) => category)
}

/**
 * Xero transaction entry for display in scope cards.
 */
export interface XeroEntry {
  id: string
  supplierName: string
  description: string
  amount: number
  currency: string
  emissionsKg: number
  date: string
  emissionCategory: string
  categoryLabel: string
}

/**
 * Group an array of XeroEntry items by their target overhead category.
 * Returns a Map keyed by overheadCategory (or 'scope1'/'scope2' for energy).
 */
export function groupXeroByOverheadCategory(
  entries: XeroEntry[]
): Map<string, XeroEntry[]> {
  const grouped = new Map<string, XeroEntry[]>()

  for (const entry of entries) {
    const mapping = getXeroScopeMapping(entry.emissionCategory)
    const key = mapping.overheadCategory || `scope${mapping.scope}`

    const existing = grouped.get(key) || []
    existing.push(entry)
    grouped.set(key, existing)
  }

  return grouped
}
