/**
 * USEEIO loader — EPA Supply Chain GHG Emission Factors (US, spend-based Scope 3).
 *
 * Licence: US Government work (public domain). Source dataset:
 *   "Supply Chain Greenhouse Gas Emission Factors v1.3.0 by NAICS-6"
 *   https://pasteur.epa.gov/uploads/10.23719/1531143/SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv
 *   kg CO2e per 2022 USD (purchaser price, "with margins"), AR5 GWP-100, 1,016 commodities.
 *
 * USEEIO factors are denominated per US DOLLAR, so for USD-denominated spend they
 * are applied directly (no FX), which is more accurate for US value chains than
 * FX-converting UK DEFRA factors. The corporate engine selects this set for USD
 * transactions via `calculateSpendBasedEmissions` (geo 'US').
 *
 * The factors below are the REAL with-margins values from the published v1.3.0
 * file, each mapped from one alkatera spend category to a representative 2017
 * NAICS-6 commodity (recorded in metadata for provenance). A live fetch+parse of
 * the EPA CSV can later replace this curated table inside `load()`.
 *
 * Notes:
 *  - `grid_electricity` is intentionally OMITTED: USEEIO's NAICS-6 file has no
 *    electric-power-generation commodity, so US electricity spend cleanly falls
 *    back to the DEFRA factor (with FX). Documented, not a silent gap.
 *  - `raw_materials` and `other` are proxies (a food-manufacturing commodity and
 *    the all-commodity economy mean, respectively); flagged in metadata.
 */

import type { FactorLoader, FactorSetSpec, ParsedFactor } from '../types'

const SPEC: FactorSetSpec = {
  provider: 'EPA_USEEIO',
  dataset: 'supply_chain_ghg',
  version: 'v1.3.0',
  validFrom: '2024-07-05',
  licence: 'public-domain',
  sourceUrl:
    'https://pasteur.epa.gov/uploads/10.23719/1531143/SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv',
  metadata: {
    publisher: 'US EPA',
    basis: 'kg CO2e per 2022 USD, purchaser price (with margins), AR5 GWP-100',
    note: 'grid_electricity omitted (no NAICS-6 electricity commodity in USEEIO). raw_materials/other are documented proxies.',
  },
}

// [alkatera category, factor (kgCO2e/USD), NAICS-6, NAICS title, proxy?]
const DEFS: Array<[string, number, string, string, boolean]> = [
  ['natural_gas', 0.532, '221210', 'Natural Gas Distribution', false],
  ['diesel_stationary', 0.27, '324110', 'Petroleum Refineries', false],
  ['diesel_mobile', 0.27, '324110', 'Petroleum Refineries', false],
  ['petrol_mobile', 0.27, '324110', 'Petroleum Refineries', false],
  ['lpg', 0.27, '324110', 'Petroleum Refineries', false],
  ['air_travel', 0.644, '481111', 'Scheduled Passenger Air Transportation', false],
  ['rail_travel', 0.466, '482111', 'Line-Haul Railroads', false],
  ['accommodation', 0.145, '721110', 'Hotels (except Casino Hotels) and Motels', false],
  ['road_freight', 0.595, '484110', 'General Freight Trucking, Local', false],
  ['sea_freight', 0.816, '483111', 'Deep Sea Freight Transportation', false],
  ['air_freight', 0.644, '481212', 'Nonscheduled Chartered Freight Air Transportation', false],
  ['courier', 0.303, '492110', 'Couriers and Express Delivery Services', false],
  ['packaging', 0.479, '322212', 'Folding Paperboard Box Manufacturing', false],
  ['raw_materials', 0.401, '311991', 'Perishable Prepared Food Manufacturing', true],
  ['marketing_materials', 0.236, '323111', 'Commercial Printing (except Screen and Books)', false],
  ['capital_goods', 0.228, '333120', 'Construction Machinery Manufacturing', false],
  ['employee_commuting', 0.566, '485113', 'Bus and Other Motor Vehicle Transit Systems', true],
  ['professional_services', 0.078, '541611', 'Administrative Management and General Management Consulting', false],
  ['it_services', 0.089, '541512', 'Computer Systems Design Services', false],
  ['telecoms', 0.075, '517311', 'Wired Telecommunications Carriers', false],
  ['water', 0.578, '221310', 'Water Supply and Irrigation Systems', false],
  ['waste', 0.988, '562111', 'Solid Waste Collection', false],
  ['other', 0.282, '*', 'All-commodity economy mean', true],
]

export const USEEIO_FACTOR_COUNT = DEFS.length

export const useeioLoader: FactorLoader = {
  key: 'useeio-v1.3.0',
  label: 'EPA USEEIO supply-chain factors (US, 2022)',
  description:
    'US spend-based Scope 3 factors (kg CO2e per USD). Applied directly to USD-denominated spend, no FX. Public domain.',
  spec: SPEC,
  async load(): Promise<ParsedFactor[]> {
    return DEFS.map(([lookupKey, factor, naics, title, proxy]) => ({
      kind: 'spend' as const,
      lookupKey,
      scope: 'Scope 3' as const,
      factor,
      unit: 'kgCO2e/USD',
      geographicScope: 'US',
      metadata: { naics, naics_title: title, ...(proxy ? { proxy: true } : {}) },
    }))
  },
}
