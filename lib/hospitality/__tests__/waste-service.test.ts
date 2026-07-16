import { describe, it, expect } from 'vitest'
import { wasteCo2e, summariseWaste } from '@/lib/hospitality/waste-service'
import {
  WASTE_EMISSION_FACTORS_FALLBACK,
  DEFAULT_WASTE_EMISSION_FACTOR,
} from '@/lib/calculations/waste-circularity'

function makeDb(rows: any[]) {
  function builder() {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      lte: () => chain,
      gte: () => chain,
      order: () => chain,
      then: (resolve: any) => Promise.resolve({ data: rows }).then(resolve),
    }
    return chain
  }
  return { from: builder } as any
}

describe('wasteCo2e', () => {
  it('uses the DEFRA factor for a known treatment', () => {
    const factor = WASTE_EMISSION_FACTORS_FALLBACK['landfill']
    expect(factor).toBeGreaterThan(0)
    expect(wasteCo2e(100, 'landfill')).toBeCloseTo(100 * factor, 6)
  })

  it('falls back to the default factor for an unknown treatment', () => {
    expect(wasteCo2e(100, 'not_a_real_method')).toBeCloseTo(100 * DEFAULT_WASTE_EMISSION_FACTOR, 6)
  })
})

describe('summariseWaste', () => {
  it('splits food vs dry and computes the diversion rate', async () => {
    const db = makeDb([
      { waste_stream: 'food', treatment_method: 'recycling', mass_kg: 100 },
      { waste_stream: 'dry', treatment_method: 'landfill', mass_kg: 50 },
    ])
    const s = await summariseWaste(db, 'org', '2026-01-01', '2026-12-31')
    expect(s.food_kg).toBe(100)
    expect(s.dry_kg).toBe(50)
    expect(s.total_kg).toBe(150)
    // recycling is diverted, landfill is not
    expect(s.diverted_kg).toBe(100)
    expect(s.diversion_rate).toBeCloseTo(100 / 150, 6)
    expect(s.total_co2e).toBeCloseTo(
      100 * WASTE_EMISSION_FACTORS_FALLBACK['recycling'] + 50 * WASTE_EMISSION_FACTORS_FALLBACK['landfill'],
      6,
    )
  })

  it('returns an all-zero summary when there is no waste', async () => {
    const s = await summariseWaste(makeDb([]), 'org', '2026-01-01', '2026-12-31')
    expect(s.total_kg).toBe(0)
    expect(s.total_co2e).toBe(0)
    expect(s.diversion_rate).toBe(0)
  })
})
