import { describe, it, expect } from 'vitest'
import { loadFactorSet } from '../upsert'
import type { FactorSetSpec, ParsedFactor } from '../types'
import { desnzLoader, DESNZ_FACTOR_COUNT } from '../loaders/desnz'

const SPEC: FactorSetSpec = {
  provider: 'DESNZ',
  dataset: 'ghg_conversion_factors',
  version: '2024',
  validFrom: '2024-06-01',
  licence: 'OGL-3.0',
}

const FACTORS: ParsedFactor[] = [
  { kind: 'utility', lookupKey: 'natural_gas', scope: 'Scope 1', factor: 0.18293, unit: 'kgCO2e/kWh' },
  { kind: 'grid', lookupKey: 'GB', scope: 'Scope 2', factor: 0.207, unit: 'kgCO2e/kWh', geographicScope: 'GB' },
]

/**
 * Stateful Supabase stub covering the chains loadFactorSet uses:
 *   factor_sets.select().eq().eq().eq().maybeSingle()   → exact-version lookup
 *   factor_sets.select().eq().eq().is().maybeSingle()    → current-set lookup
 *   factor_sets.update().eq()                            → supersede
 *   factor_sets.insert().select().single()               → new set
 *   reference_factors.delete().eq()                      → refresh
 *   reference_factors.insert()                           → factors (awaited)
 */
function makeMock(opts: { exact?: any; current?: any }) {
  const calls = { updates: [] as any[], inserted: {} as Record<string, any>, deleted: [] as string[] }
  let setSelects = 0

  const client = {
    from(table: string) {
      return {
        select() {
          const chain: any = {
            eq: () => chain,
            is: () => chain,
            maybeSingle: () => {
              if (table === 'factor_sets') {
                setSelects += 1
                return Promise.resolve({ data: setSelects === 1 ? (opts.exact ?? null) : (opts.current ?? null) })
              }
              return Promise.resolve({ data: null })
            },
            // factor_sets insert().select().single()
            single: () => Promise.resolve({ data: { id: 'new-set' }, error: null }),
          }
          return chain
        },
        insert(rows: any) {
          calls.inserted[table] = rows
          const thenable: any = {
            select: () => ({ single: () => Promise.resolve({ data: { id: 'new-set' }, error: null }) }),
            then: (res: any) => Promise.resolve({ error: null }).then(res),
          }
          return thenable
        },
        update(vals: any) {
          return { eq: () => { calls.updates.push(vals); return Promise.resolve({ error: null }) } }
        },
        delete() {
          return { eq: () => { calls.deleted.push(table); return Promise.resolve({ error: null }) } }
        },
      }
    },
  } as any

  return { client, calls }
}

describe('loadFactorSet', () => {
  it('supersedes the prior current set when a new version is loaded', async () => {
    const { client, calls } = makeMock({ exact: null, current: { id: 'old-set', version: '2023' } })
    const result = await loadFactorSet(client, SPEC, FACTORS)

    expect(result.supersededVersion).toBe('2023')
    expect(result.factorsInserted).toBe(FACTORS.length)
    // The prior set was stamped with valid_to = the new set's valid_from.
    expect(calls.updates).toEqual([{ valid_to: '2024-06-01' }])
    expect(calls.inserted.reference_factors).toHaveLength(FACTORS.length)
  })

  it('refreshes in place when the exact version already exists', async () => {
    const { client, calls } = makeMock({ exact: { id: 'existing-set' }, current: null })
    const result = await loadFactorSet(client, SPEC, FACTORS)

    expect(result.supersededVersion).toBeNull()
    expect(calls.updates).toHaveLength(0) // nothing superseded
    expect(calls.deleted).toContain('reference_factors') // old factors cleared
    expect(calls.inserted.reference_factors).toHaveLength(FACTORS.length)
  })

  it('throws rather than writing an empty set', async () => {
    const { client } = makeMock({})
    await expect(loadFactorSet(client, SPEC, [])).rejects.toThrow(/no factors/i)
  })
})

describe('desnzLoader', () => {
  it('produces the expected factor kinds and count', async () => {
    const factors = await desnzLoader.load()
    expect(factors).toHaveLength(DESNZ_FACTOR_COUNT)
    const kinds = new Set(factors.map((f) => f.kind))
    expect(kinds).toEqual(new Set(['utility', 'grid', 'spend']))
    // Spend factors carry the GB geo so USEEIO (US) can coexist later.
    expect(factors.filter((f) => f.kind === 'spend').every((f) => f.geographicScope === 'GB')).toBe(true)
    // Electricity grid value matches the engine's built-in default.
    expect(factors.find((f) => f.kind === 'grid' && f.lookupKey === 'GB')?.factor).toBe(0.207)
  })
})
