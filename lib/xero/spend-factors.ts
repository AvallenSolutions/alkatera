/**
 * DEFRA 2024 spend-based emission factors (kg CO2e per GBP spent).
 *
 * These are used as Tier 4 (lowest quality) baselines when only financial
 * spend data is available. Users are prompted to upgrade to activity-based
 * data for higher accuracy.
 *
 * Source: UK DEFRA Environmental Reporting Guidelines, Table 13c
 */

export const SPEND_EMISSION_FACTORS: Record<string, { factor: number; source: string; uncertainty: number }> = {
  // Energy
  grid_electricity: { factor: 0.49, source: 'DEFRA 2024 Table 13c: Electricity', uncertainty: 0.6 },
  natural_gas:      { factor: 0.41, source: 'DEFRA 2024 Table 13c: Gas supply', uncertainty: 0.5 },
  diesel_stationary:{ factor: 0.62, source: 'DEFRA 2024 Table 13c: Petroleum products', uncertainty: 0.5 },
  diesel_mobile:    { factor: 0.62, source: 'DEFRA 2024 Table 13c: Petroleum products', uncertainty: 0.5 },
  petrol_mobile:    { factor: 0.62, source: 'DEFRA 2024 Table 13c: Petroleum products', uncertainty: 0.5 },
  lpg:              { factor: 0.41, source: 'DEFRA 2024 Table 13c: Gas supply', uncertainty: 0.5 },

  // Travel
  air_travel:       { factor: 1.36, source: 'DEFRA 2024 Table 13c: Air transport', uncertainty: 0.9 },
  rail_travel:      { factor: 0.28, source: 'DEFRA 2024 Table 13c: Rail transport', uncertainty: 0.3 },
  accommodation:    { factor: 0.30, source: 'DEFRA 2024 Table 13c: Hotels', uncertainty: 0.5 },

  // Freight
  road_freight:     { factor: 0.62, source: 'DEFRA 2024 Table 13c: Road freight', uncertainty: 0.7 },
  sea_freight:      { factor: 0.81, source: 'DEFRA 2024 Table 13c: Sea freight', uncertainty: 0.7 },
  air_freight:      { factor: 1.36, source: 'DEFRA 2024 Table 13c: Air freight', uncertainty: 0.8 },
  courier:          { factor: 0.62, source: 'DEFRA 2024 Table 13c: Postal & courier', uncertainty: 0.7 },

  // Supply chain
  packaging:           { factor: 0.72, source: 'DEFRA 2024 Table 13c: Paper/packaging', uncertainty: 0.8 },
  raw_materials:       { factor: 0.58, source: 'DEFRA 2024 Table 13c: Food products', uncertainty: 0.7 },
  marketing_materials: { factor: 0.60, source: 'DEFRA 2024 Table 13c: Textiles/printing', uncertainty: 0.8 },

  // Capital goods
  capital_goods:    { factor: 0.54, source: 'DEFRA 2024 Table 13c: Machinery/equipment', uncertainty: 0.9 },

  // Employee commuting
  employee_commuting: { factor: 0.27, source: 'DEFRA 2024 Table 13c: Average commuting', uncertainty: 0.7 },

  // Services
  professional_services: { factor: 0.22, source: 'DEFRA 2024 Table 13c: Professional services', uncertainty: 0.5 },
  it_services:           { factor: 0.22, source: 'DEFRA 2024 Table 13c: IT services', uncertainty: 0.5 },
  telecoms:              { factor: 0.22, source: 'DEFRA 2024 Table 13c: Telecoms', uncertainty: 0.4 },

  // Utilities & waste
  water:            { factor: 0.32, source: 'DEFRA 2024 Table 13c: Water supply', uncertainty: 0.3 },
  waste:            { factor: 0.47, source: 'DEFRA 2024 Table 13c: Waste management', uncertainty: 0.8 },

  // Catch-all
  other:            { factor: 0.33, source: 'DEFRA 2024 Table 13c: Average services', uncertainty: 0.5 },
}

/**
 * Get the spend-based emission factor for a category.
 * Returns kg CO2e per GBP spent.
 */
export function getSpendFactor(category: string): number {
  return SPEND_EMISSION_FACTORS[category]?.factor ?? SPEND_EMISSION_FACTORS.other.factor
}

/**
 * Get the uncertainty factor (0-1) for a spend-based estimate.
 * Higher = more uncertain, and thus higher priority to upgrade.
 */
export function getUncertainty(category: string): number {
  return SPEND_EMISSION_FACTORS[category]?.uncertainty ?? 0.5
}

/**
 * Approximate FX rates to GBP for spend-based emission factors.
 * DEFRA factors are denominated in GBP, so non-GBP amounts must be converted.
 * These are rough annual averages; precise FX is not critical for Tier 4 estimates.
 */
const CURRENCY_TO_GBP: Record<string, number> = {
  GBP: 1.0,
  EUR: 0.86,
  USD: 0.79,
  AUD: 0.52,
  NZD: 0.48,
  CAD: 0.58,
  CHF: 0.90,
  JPY: 0.0053,
  SEK: 0.074,
  NOK: 0.074,
  DKK: 0.115,
}

/**
 * Calculate spend-based emissions for a transaction amount.
 * Converts non-GBP amounts using approximate FX rates since DEFRA factors are per GBP.
 */
export function calculateSpendBasedEmissions(amount: number, category: string, currency: string = 'GBP'): number {
  const factor = getSpendFactor(category)
  const fxRate = CURRENCY_TO_GBP[currency.toUpperCase()] ?? 1.0
  return Math.abs(amount) * fxRate * factor
}
