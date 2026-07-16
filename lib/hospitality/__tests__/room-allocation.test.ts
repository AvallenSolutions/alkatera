import { describe, it, expect } from 'vitest'
import {
  computeAllocatedImpact,
  NATURAL_GAS_FACTOR,
  WATER_FACTOR_PER_M3,
} from '@/lib/hospitality/room-allocation'
import { getGridFactor } from '@/lib/grid-emission-factors'

describe('computeAllocatedImpact', () => {
  it('applies grid, gas and water factors and sums the total', () => {
    const grid = getGridFactor('GB', 'uk').factor
    const r = computeAllocatedImpact({
      occupancy: 2,
      electricity_kwh: 10,
      gas_kwh: 20,
      water_litres: 500,
      laundry_kwh: 4,
      country: 'GB',
    })
    expect(r.electricity_co2e).toBeCloseTo(10 * grid, 6)
    expect(r.gas_co2e).toBeCloseTo(20 * NATURAL_GAS_FACTOR, 6)
    // 500 litres → 0.5 m³
    expect(r.water_co2e).toBeCloseTo(0.5 * WATER_FACTOR_PER_M3, 6)
    // laundry treated as electricity
    expect(r.laundry_co2e).toBeCloseTo(4 * grid, 6)
    expect(r.total_co2e).toBeCloseTo(r.electricity_co2e + r.gas_co2e + r.water_co2e + r.laundry_co2e, 6)
    expect(r.grid_factor).toBeCloseTo(grid, 6)
  })

  it('coerces missing/garbage inputs to zero', () => {
    const r = computeAllocatedImpact({
      occupancy: 2,
      electricity_kwh: Number.NaN,
      gas_kwh: undefined as unknown as number,
      water_litres: null as unknown as number,
      laundry_kwh: Number.NaN,
      country: 'GB',
    })
    expect(r.electricity_co2e).toBe(0)
    expect(r.gas_co2e).toBe(0)
    expect(r.water_co2e).toBe(0)
    expect(r.laundry_co2e).toBe(0)
    expect(r.total_co2e).toBe(0)
  })
})
