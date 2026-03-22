/**
 * Shared emission category labels used across Xero components.
 * Single source of truth to prevent drift between panels.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  grid_electricity: 'Electricity',
  natural_gas: 'Natural Gas',
  diesel_stationary: 'Diesel (stationary)',
  diesel_mobile: 'Diesel (mobile)',
  petrol_mobile: 'Petrol (mobile)',
  lpg: 'LPG',
  water: 'Water',
  air_travel: 'Air Travel',
  rail_travel: 'Rail Travel',
  accommodation: 'Accommodation',
  road_freight: 'Road Freight',
  sea_freight: 'Sea Freight',
  air_freight: 'Air Freight',
  courier: 'Courier',
  packaging: 'Packaging',
  raw_materials: 'Raw Materials',
  professional_services: 'Professional Services',
  it_services: 'IT Services',
  telecoms: 'Telecoms',
  waste_management: 'Waste Management',
  waste: 'Waste',
  cleaning: 'Cleaning',
  maintenance: 'Maintenance',
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
  1: { label: 'Tier 1 (Supplier)', colour: 'text-emerald-700 dark:text-emerald-400 border-emerald-300' },
  2: { label: 'Tier 2 (Activity)', colour: 'text-blue-700 dark:text-blue-400 border-blue-300' },
  3: { label: 'Tier 3 (Proxy)', colour: 'text-amber-700 dark:text-amber-400 border-amber-300' },
  4: { label: 'Tier 4 (Spend)', colour: 'text-red-700 dark:text-red-400 border-red-300' },
}
