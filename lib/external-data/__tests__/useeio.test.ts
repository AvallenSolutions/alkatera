import { describe, it, expect, beforeEach } from 'vitest'
import { warmFactorCache, __resetFactorCache } from '../cache'
import { useeioLoader, USEEIO_FACTOR_COUNT } from '../loaders/useeio'
import { calculateSpendBasedEmissions, getSpendFactorDetail } from '../../xero/spend-factors'
import type { ParsedFactor } from '../types'

/** Warm the cache from a loader's factors (mimics the reference_factors query). */
async function warmFrom(factors: ParsedFactor[], provider: string, version: string) {
  const rows = factors.map((f) => ({
    kind: f.kind,
    lookup_key: f.lookupKey,
    scope: f.scope ?? null,
    factor: f.factor,
    unit: f.unit,
    uncertainty: f.uncertainty ?? null,
    geographic_scope: f.geographicScope ?? null,
    factor_sets: { provider, version, licence: 'public-domain', valid_to: null },
  }))
  await warmFactorCache({ from: () => ({ select: () => ({ is: () => Promise.resolve({ data: rows, error: null }) }) }) } as any)
}

describe('useeioLoader', () => {
  it('produces US per-USD spend factors and omits electricity', async () => {
    const factors = await useeioLoader.load()
    expect(factors).toHaveLength(USEEIO_FACTOR_COUNT)
    expect(factors.every((f) => f.kind === 'spend')).toBe(true)
    expect(factors.every((f) => f.geographicScope === 'US')).toBe(true)
    expect(factors.every((f) => f.unit === 'kgCO2e/USD')).toBe(true)
    // USEEIO has no NAICS-6 electricity commodity — deliberately absent.
    expect(factors.find((f) => f.lookupKey === 'grid_electricity')).toBeUndefined()
    // A spot-check on a real with-margins value.
    expect(factors.find((f) => f.lookupKey === 'waste')?.factor).toBe(0.988)
  })
})

describe('calculateSpendBasedEmissions currency awareness', () => {
  beforeEach(() => __resetFactorCache())

  it('USD spend uses USEEIO per-USD factor directly (no FX) when the US set is loaded', async () => {
    await warmFrom(await useeioLoader.load(), 'EPA_USEEIO', 'v1.3.0')
    expect(getSpendFactorDetail('professional_services', 'US').unit).toBe('kgCO2e/USD')
    // 100 USD * 0.078 = 7.8, applied directly with no FX conversion.
    expect(calculateSpendBasedEmissions(100, 'professional_services', 'USD')).toBeCloseTo(7.8, 4)
  })

  it('USD spend falls back to DEFRA + FX when no US set is loaded', async () => {
    // Cold cache: USD path finds no per-USD factor → DEFRA (0.22) with USD→GBP FX (0.79).
    expect(calculateSpendBasedEmissions(100, 'professional_services', 'USD')).toBeCloseTo(100 * 0.79 * 0.22, 4)
  })

  it('US set omitting electricity → USD electricity still uses DEFRA + FX', async () => {
    await warmFrom(await useeioLoader.load(), 'EPA_USEEIO', 'v1.3.0')
    // grid_electricity absent from USEEIO → DEFRA 0.49 with FX, not a per-USD value.
    expect(calculateSpendBasedEmissions(100, 'grid_electricity', 'USD')).toBeCloseTo(100 * 0.79 * 0.49, 4)
  })

  it('GBP spend is unchanged by a loaded US set', async () => {
    await warmFrom(await useeioLoader.load(), 'EPA_USEEIO', 'v1.3.0')
    // GBP path ignores the US set; DEFRA 0.22, FX 1.0.
    expect(calculateSpendBasedEmissions(100, 'professional_services', 'GBP')).toBeCloseTo(22, 4)
  })
})
