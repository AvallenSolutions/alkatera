/**
 * Shared emission category labels used across Xero components.
 * Single source of truth to prevent drift between panels.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  // Scope 1: Direct emissions
  natural_gas: 'Natural Gas',
  diesel_stationary: 'Diesel (stationary)',
  diesel_mobile: 'Diesel (mobile)',
  petrol_mobile: 'Petrol (mobile)',
  lpg: 'LPG',

  // Scope 2: Purchased energy
  grid_electricity: 'Electricity',

  // Scope 3: Business travel (Cat 6)
  air_travel: 'Air Travel',
  rail_travel: 'Rail Travel',
  accommodation: 'Accommodation',

  // Scope 3: Employee commuting (Cat 7)
  employee_commuting: 'Team & Commuting',

  // Scope 3: Logistics & freight (Cat 4/9)
  road_freight: 'Road Freight',
  sea_freight: 'Sea Freight',
  air_freight: 'Air Freight',
  courier: 'Courier',

  // Scope 3: Purchased goods (Cat 1)
  packaging: 'Packaging',
  raw_materials: 'Raw Materials',
  marketing_materials: 'Marketing Materials',

  // Scope 3: Capital goods (Cat 2)
  capital_goods: 'Capital Goods',

  // Scope 3: Purchased services (Cat 8)
  professional_services: 'Professional Services',
  it_services: 'IT Services',
  telecoms: 'Telecoms',

  // Scope 3: Waste & water (Cat 5)
  water: 'Water',
  waste: 'Waste',

  // Catch-all
  other: 'Other',
}

/**
 * All emission category values for select dropdowns.
 */
export const EMISSION_CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}))

/**
 * Classification source labels.
 */
export const CLASSIFICATION_SOURCE_LABELS: Record<string, string> = {
  account_mapping: 'Account Mapping',
  supplier_rule: 'Supplier Rule',
  manual: 'Manual',
  ai: 'AI',
}

/**
 * Upgrade status labels.
 */
export const UPGRADE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  upgraded: 'Upgraded',
  dismissed: 'Dismissed',
  not_applicable: 'N/A',
}

/**
 * Data quality tier labels and colours.
 */
export const TIER_CONFIG: Record<number, { label: string; colour: string }> = {
  1: { label: 'Verified (supplier data)', colour: 'text-emerald-700 dark:text-emerald-400 border-emerald-300' },
  2: { label: 'Good (activity data)', colour: 'text-blue-700 dark:text-blue-400 border-blue-300' },
  3: { label: 'Estimated (proxy data)', colour: 'text-amber-700 dark:text-amber-400 border-amber-300' },
  4: { label: 'Estimated (spend data)', colour: 'text-red-700 dark:text-red-400 border-red-300' },
}
