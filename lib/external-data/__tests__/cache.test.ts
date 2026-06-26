import { describe, it, expect, beforeEach } from 'vitest'
import {
  warmFactorCache,
  getCachedFactor,
  isFactorCacheWarm,
  __resetFactorCache,
} from '../cache'
import { getGridFactor } from '../../grid-emission-factors'
import { getSpendFactor } from '../../xero/spend-factors'

/** Minimal Supabase stub for the `reference_factors` warm query. */
function mockSupabase(rows: unknown[]) {
  return {
    from: () => ({
      select: () => ({
        is: () => Promise.resolve({ data: rows, error: null }),
      }),
    }),
  } as any
}

const throwingSupabase = {
  from: () => {
    throw new Error('boom')
  },
} as any

function row(over: Record<string, unknown>) {
  return {
    kind: 'spend',
    lookup_key: 'grid_electricity',
    scope: 'Scope 3',
    factor: 0.4,
    unit: 'kgCO2e/GBP',
    uncertainty: 0.5,
    geographic_scope: 'GB',
    factor_sets: { provider: 'DESNZ', version: '2099', licence: 'OGL-3.0', valid_to: null },
    ...over,
  }
}

describe('reference-factor cache', () => {
  beforeEach(() => __resetFactorCache())

  it('cold cache returns undefined and lookups use built-in constants', () => {
    expect(isFactorCacheWarm()).toBe(false)
    expect(getCachedFactor('spend', 'grid_electricity', 'GB')).toBeUndefined()
    // Built-in DEFRA + grid constants are unchanged.
    expect(getSpendFactor('grid_electricity')).toBe(0.49)
    expect(getGridFactor('GB').factor).toBe(0.207)
    expect(getGridFactor('GB').isEstimated).toBe(false)
  })

  it('warm cache makes lookups prefer the loaded factor set', async () => {
    await warmFactorCache(
      mockSupabase([
        row({ kind: 'spend', lookup_key: 'grid_electricity', factor: 0.4, geographic_scope: 'GB' }),
        row({ kind: 'grid', lookup_key: 'GB', factor: 0.199, unit: 'kgCO2e/kWh', geographic_scope: 'GB' }),
        row({ kind: 'utility', lookup_key: 'natural_gas', scope: 'Scope 1', factor: 0.18, unit: 'kgCO2e/kWh', geographic_scope: null }),
      ]),
    )
    expect(isFactorCacheWarm()).toBe(true)
    // spend (geo GB) now resolves from the cache.
    expect(getSpendFactor('grid_electricity')).toBe(0.4)
    // grid GB now resolves from the cache, with the set's provenance.
    const gb = getGridFactor('GB')
    expect(gb.factor).toBe(0.199)
    expect(gb.source).toContain('DESNZ')
    // utility (geo-agnostic '*') resolves too.
    expect(getCachedFactor('utility', 'natural_gas')?.factor).toBe(0.18)
  })

  it('unknown keys still fall back to constants even when warm', async () => {
    await warmFactorCache(mockSupabase([row({ lookup_key: 'water', factor: 0.3 })]))
    // air_travel was not in the loaded set → built-in DEFRA value.
    expect(getSpendFactor('air_travel')).toBe(1.36)
    // A grid country not in the set → built-in IEA value.
    expect(getGridFactor('FR').factor).toBe(0.052)
  })

  it('warming never throws; a failed load leaves an empty cache (all fallbacks)', async () => {
    await expect(warmFactorCache(throwingSupabase)).resolves.toBeUndefined()
    expect(getCachedFactor('spend', 'grid_electricity', 'GB')).toBeUndefined()
    expect(getSpendFactor('grid_electricity')).toBe(0.49)
  })
})
