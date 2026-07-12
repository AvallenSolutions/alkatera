import { describe, it, expect } from 'vitest'
import { perCoverImpact } from '@/lib/hospitality/meal-types'

describe('perCoverImpact', () => {
  it('divides per-functional-unit impacts by the cover count', () => {
    // Mirrors the verified browser case: beef ragù for 4 covers.
    const aggregated = {
      climate_change_gwp100: 37.12,
      water_consumption: 9.895,
      land_use: 99.52,
    }
    const impact = perCoverImpact(aggregated, 4)
    expect(impact).not.toBeNull()
    expect(impact!.total_co2e).toBe(37.12)
    expect(impact!.per_cover_co2e).toBeCloseTo(9.28, 5)
    expect(impact!.per_cover_water).toBeCloseTo(2.47375, 5)
    expect(impact!.per_cover_land).toBeCloseTo(24.88, 5)
  })

  it('returns null when there is no aggregated impact', () => {
    expect(perCoverImpact(null, 4)).toBeNull()
    expect(perCoverImpact(undefined, 4)).toBeNull()
  })

  it('treats zero or negative covers as a single cover to avoid divide-by-zero', () => {
    const aggregated = { climate_change_gwp100: 10 }
    expect(perCoverImpact(aggregated, 0)!.per_cover_co2e).toBe(10)
    expect(perCoverImpact(aggregated, -3)!.per_cover_co2e).toBe(10)
  })

  it('defaults missing impact keys to zero', () => {
    const impact = perCoverImpact({ climate_change_gwp100: 8 }, 2)
    expect(impact!.per_cover_co2e).toBe(4)
    expect(impact!.per_cover_water).toBe(0)
    expect(impact!.per_cover_land).toBe(0)
    expect(impact!.per_cover_cooking_co2e).toBe(0)
    expect(impact!.per_cover_display_co2e).toBe(4)
  })

  it('uplifts ingredient impact by the prep-waste percentage', () => {
    const impact = perCoverImpact({ climate_change_gwp100: 10, water_consumption: 4 }, 2, { prepWastePct: 10 })
    // 10 * 1.1 / 2 = 5.5; water 4 * 1.1 / 2 = 2.2
    expect(impact!.per_cover_co2e).toBeCloseTo(5.5, 6)
    expect(impact!.per_cover_water).toBeCloseTo(2.2, 6)
    expect(impact!.total_co2e).toBeCloseTo(11, 6)
  })

  it('adds cooking energy to the display figure only, not the ingredient figure', () => {
    const impact = perCoverImpact({ climate_change_gwp100: 8 }, 4, { cookingCo2eTotal: 2 })
    expect(impact!.per_cover_co2e).toBe(2) // 8 / 4, ingredients only
    expect(impact!.per_cover_cooking_co2e).toBe(0.5) // 2 / 4
    expect(impact!.per_cover_display_co2e).toBe(2.5)
  })
})
