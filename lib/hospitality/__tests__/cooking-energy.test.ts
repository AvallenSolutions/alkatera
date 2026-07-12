import { describe, it, expect } from 'vitest'
import { cookingCo2e, COOKING_METHODS } from '@/lib/hospitality/cooking-energy'
import { NATURAL_GAS_FACTOR } from '@/lib/hospitality/room-allocation'
import { getGridFactor } from '@/lib/grid-emission-factors'

describe('cookingCo2e', () => {
  it('returns null when no method is set', () => {
    expect(cookingCo2e(null, 30)).toBeNull()
    expect(cookingCo2e('not_a_method', 30)).toBeNull()
  })

  it('is zero for no-cook or zero time', () => {
    expect(cookingCo2e('no_cook', 30)).toEqual({ kwh: 0, co2e: 0 })
    expect(cookingCo2e('oven_electric', 0)).toEqual({ kwh: 0, co2e: 0 })
  })

  it('uses the grid factor for electric methods', () => {
    const grid = getGridFactor('GB', 'uk').factor
    const meta = COOKING_METHODS.oven_electric
    const r = cookingCo2e('oven_electric', 30, 'GB')!
    // 2.5 kW * 0.5 h = 1.25 kWh
    expect(r.kwh).toBeCloseTo(meta.kw * 0.5, 6)
    expect(r.co2e).toBeCloseTo(meta.kw * 0.5 * grid, 6)
  })

  it('uses the gas factor for gas methods', () => {
    const meta = COOKING_METHODS.hob_gas
    const r = cookingCo2e('hob_gas', 20, 'GB')!
    // 3.0 kW * (20/60) h
    const kwh = meta.kw * (20 / 60)
    expect(r.kwh).toBeCloseTo(kwh, 6)
    expect(r.co2e).toBeCloseTo(kwh * NATURAL_GAS_FACTOR, 6)
  })
})
