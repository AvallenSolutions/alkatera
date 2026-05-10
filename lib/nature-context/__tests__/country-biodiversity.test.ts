import { describe, expect, it } from 'vitest'
import {
  computeCountryMix,
  type CountryBiodiversityFactor,
  type MaterialOrigin,
} from '../country-biodiversity'

describe('computeCountryMix', () => {
  const factors = new Map<string, CountryBiodiversityFactor>([
    ['MX', { country_code: 'MX', country_name: 'Mexico', land_use_multiplier: 1.4, hotspot_names: ['Mesoamerica'] }],
    ['GB', { country_code: 'GB', country_name: 'United Kingdom', land_use_multiplier: 1.0, hotspot_names: null }],
    ['IT', { country_code: 'IT', country_name: 'Italy', land_use_multiplier: 1.3, hotspot_names: ['Mediterranean Basin'] }],
  ])

  it('returns 1.0 default when no origins', () => {
    const out = computeCountryMix([], factors)
    expect(out.weighted_multiplier).toBe(1.0)
    expect(out.country_breakdown).toEqual([])
  })

  it('mass-weights country multipliers', () => {
    // 80kg from Mexico (1.4) + 20kg from UK (1.0) → (80×1.4 + 20×1.0)/100 = 1.32
    const origins: MaterialOrigin[] = [
      { country_code: 'MX', mass_weight: 80 },
      { country_code: 'GB', mass_weight: 20 },
    ]
    const out = computeCountryMix(origins, factors)
    expect(out.weighted_multiplier).toBeCloseTo(1.32, 2)
    expect(out.country_breakdown[0].country_code).toBe('MX') // sorted by share
    expect(out.country_breakdown[0].share_pct).toBe(80)
  })

  it('treats unknown countries (no factor row) as multiplier 1.0', () => {
    const origins: MaterialOrigin[] = [
      { country_code: 'XX', mass_weight: 50 },
      { country_code: 'GB', mass_weight: 50 },
    ]
    const out = computeCountryMix(origins, factors)
    expect(out.weighted_multiplier).toBe(1.0)
  })

  it('counts null country_code as "unknown origin" without country breakdown', () => {
    const origins: MaterialOrigin[] = [
      { country_code: null, mass_weight: 50 },
      { country_code: 'GB', mass_weight: 50 },
    ]
    const out = computeCountryMix(origins, factors)
    expect(out.unknown_origin_share_pct).toBeCloseTo(50, 4)
    expect(out.weighted_multiplier).toBe(1.0)
  })

  it('flags hotspot countries in the breakdown', () => {
    const origins: MaterialOrigin[] = [{ country_code: 'IT', mass_weight: 100 }]
    const out = computeCountryMix(origins, factors)
    expect(out.country_breakdown[0].hotspot_names).toEqual(['Mediterranean Basin'])
  })
})
