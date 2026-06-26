/**
 * DESNZ loader — UK Government GHG conversion factors (DESNZ/BEIS).
 *
 * Licence: Open Government Licence v3.0 (commercial reuse permitted with
 * attribution). Source:
 * https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting
 *
 * This first release is a CURATED set of the 2024 factors, matching the values
 * the corporate engine already uses (so loading it changes no totals — it simply
 * moves the factors into the versioned, dated, citable library). Each annual
 * release is added as a new spec + factor list; loading a newer one supersedes
 * this one and retains it for historical recompute. A live fetch+parse of the
 * gov.uk "flat file for automation" workbook can later replace the curated array
 * inside `load()` without changing the loader's contract.
 *
 * Units mirror the corporate engine's `UTILITY_EMISSION_FACTORS`:
 *   - gas/biomass: kgCO2e per kWh (gross CV)
 *   - liquid fuels: kgCO2e per litre
 *   - natural_gas_m3: kgCO2e per m³ (1 m³ ≈ 10.55 kWh)
 *   - electricity/heat: kgCO2e per kWh (location-based)
 *   - spend: kgCO2e per GBP (DEFRA Table 13c indirect/spend-based)
 */

import type { FactorLoader, FactorSetSpec, ParsedFactor } from '../types'

const SPEC: FactorSetSpec = {
  provider: 'DESNZ',
  dataset: 'ghg_conversion_factors',
  version: '2024',
  validFrom: '2024-06-01',
  licence: 'OGL-3.0',
  sourceUrl:
    'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
  metadata: {
    publisher: 'Department for Energy Security and Net Zero (DESNZ)',
    note: 'Curated 2024 release. Spend factors are DEFRA Environmental Reporting Guidelines Table 13c.',
  },
}

const KWH_PER_M3_GAS = 10.55

// ── Scope 1 fuel combustion + Scope 2 energy (utility kind) ──
const UTILITY: ParsedFactor[] = [
  { kind: 'utility', lookupKey: 'diesel_stationary', scope: 'Scope 1', factor: 2.68787, unit: 'kgCO2e/litre' },
  { kind: 'utility', lookupKey: 'diesel_mobile', scope: 'Scope 1', factor: 2.68787, unit: 'kgCO2e/litre' },
  { kind: 'utility', lookupKey: 'petrol_mobile', scope: 'Scope 1', factor: 2.31, unit: 'kgCO2e/litre' },
  { kind: 'utility', lookupKey: 'natural_gas', scope: 'Scope 1', factor: 0.18293, unit: 'kgCO2e/kWh' },
  { kind: 'utility', lookupKey: 'natural_gas_m3', scope: 'Scope 1', factor: 0.18293 * KWH_PER_M3_GAS, unit: 'kgCO2e/m3' },
  { kind: 'utility', lookupKey: 'lpg', scope: 'Scope 1', factor: 1.55537, unit: 'kgCO2e/litre' },
  { kind: 'utility', lookupKey: 'heavy_fuel_oil', scope: 'Scope 1', factor: 3.1774, unit: 'kgCO2e/litre' },
  { kind: 'utility', lookupKey: 'biomass_solid', scope: 'Scope 1', factor: 0.01551, unit: 'kgCO2e/kWh' },
  { kind: 'utility', lookupKey: 'electricity_grid', scope: 'Scope 2', factor: 0.207, unit: 'kgCO2e/kWh' },
  { kind: 'utility', lookupKey: 'heat_steam_purchased', scope: 'Scope 2', factor: 0.1662, unit: 'kgCO2e/kWh' },
]

// ── UK grid intensity (grid kind), for the product/agri calculators ──
const GRID: ParsedFactor[] = [
  { kind: 'grid', lookupKey: 'GB', scope: 'Scope 2', factor: 0.207, unit: 'kgCO2e/kWh', geographicScope: 'GB' },
]

// ── Spend-based factors (spend kind, geo GB) — DEFRA Table 13c ──
const SPEND_DEFS: Array<[string, number, number]> = [
  // [lookupKey, kgCO2e/GBP, uncertainty]
  ['grid_electricity', 0.49, 0.6],
  ['natural_gas', 0.41, 0.5],
  ['diesel_stationary', 0.62, 0.5],
  ['diesel_mobile', 0.62, 0.5],
  ['petrol_mobile', 0.62, 0.5],
  ['lpg', 0.41, 0.5],
  ['air_travel', 1.36, 0.9],
  ['rail_travel', 0.28, 0.3],
  ['accommodation', 0.3, 0.5],
  ['road_freight', 0.62, 0.7],
  ['sea_freight', 0.81, 0.7],
  ['air_freight', 1.36, 0.8],
  ['courier', 0.62, 0.7],
  ['packaging', 0.72, 0.8],
  ['raw_materials', 0.58, 0.7],
  ['marketing_materials', 0.6, 0.8],
  ['capital_goods', 0.54, 0.9],
  ['employee_commuting', 0.27, 0.7],
  ['professional_services', 0.22, 0.5],
  ['it_services', 0.22, 0.5],
  ['telecoms', 0.22, 0.4],
  ['water', 0.32, 0.3],
  ['waste', 0.47, 0.8],
  ['other', 0.33, 0.5],
]

const SPEND: ParsedFactor[] = SPEND_DEFS.map(([lookupKey, factor, uncertainty]) => ({
  kind: 'spend' as const,
  lookupKey,
  scope: 'Scope 3' as const,
  factor,
  unit: 'kgCO2e/GBP',
  uncertainty,
  geographicScope: 'GB',
}))

export const DESNZ_FACTOR_COUNT = UTILITY.length + GRID.length + SPEND.length

export const desnzLoader: FactorLoader = {
  key: 'desnz-2024',
  label: 'UK DESNZ GHG conversion factors (2024)',
  description:
    'Official UK Government Scope 1/2/3 conversion factors. OGL v3.0. Powers corporate fuel, electricity and spend-based emissions.',
  spec: SPEC,
  async load(): Promise<ParsedFactor[]> {
    return [...UTILITY, ...GRID, ...SPEND]
  },
}
