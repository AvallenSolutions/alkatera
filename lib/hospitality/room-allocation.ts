/**
 * Room-night energy/water allocation.
 *
 * The allocated electricity, gas and water per room-night are converted to CO2e
 * using the same factors the rest of the platform uses (grid factor by country,
 * DEFRA natural-gas factor, DEFRA water supply+treatment). This figure is shown
 * for guest-facing per-night intensity only — it is already captured in the
 * venue's facility Scope 1/2, so it is never re-added to the company total.
 */

import { getGridFactor } from '@/lib/grid-emission-factors'

/** DEFRA 2025 natural gas, kg CO2e per kWh (gross CV). */
export const NATURAL_GAS_FACTOR = 0.18293
/** DEFRA 2025 water supply + treatment, kg CO2e per m³. */
export const WATER_FACTOR_PER_M3 = 0.344

export interface RoomAllocationInput {
  occupancy: number
  electricity_kwh: number
  gas_kwh: number
  water_litres: number
  country: string
}

export interface AllocatedImpact {
  electricity_co2e: number
  gas_co2e: number
  water_co2e: number
  total_co2e: number
  grid_factor: number
}

export function computeAllocatedImpact(input: RoomAllocationInput): AllocatedImpact {
  const grid = getGridFactor(input.country || 'GB', 'uk').factor
  const electricity_co2e = (Number(input.electricity_kwh) || 0) * grid
  const gas_co2e = (Number(input.gas_kwh) || 0) * NATURAL_GAS_FACTOR
  const water_co2e = ((Number(input.water_litres) || 0) / 1000) * WATER_FACTOR_PER_M3
  return {
    electricity_co2e,
    gas_co2e,
    water_co2e,
    total_co2e: electricity_co2e + gas_co2e + water_co2e,
    grid_factor: grid,
  }
}

export const DEFAULT_ROOM_ALLOCATION: RoomAllocationInput = {
  occupancy: 2,
  electricity_kwh: 0,
  gas_kwh: 0,
  water_litres: 0,
  country: 'GB',
}
