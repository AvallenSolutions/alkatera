import { describe, it, expect } from 'vitest'
import { parseSoilGridsOcs } from '../sources/soilgrids'
import { roundCoord } from '../point-lookup'
import {
  planBaselineWrite,
  buildBaselineRow,
  runSoilBaseline,
  SOILGRIDS_LAB,
  type SoilBaselineParams,
} from '../soil-baseline'
import type { GeoLookupResult } from '../types'

describe('parseSoilGridsOcs', () => {
  const payload = (mean: unknown) => ({
    properties: { layers: [{ name: 'ocs', depths: [{ values: { mean } }] }] },
  })
  it('reads the 0-30cm ocs mean as t C/ha', () => {
    expect(parseSoilGridsOcs(payload(49))).toBe(49)
  })
  it('returns null for a no-data point', () => {
    expect(parseSoilGridsOcs(payload(null))).toBeNull()
  })
  it('returns null for an unexpected shape', () => {
    expect(parseSoilGridsOcs({})).toBeNull()
    expect(parseSoilGridsOcs({ properties: { layers: [] } })).toBeNull()
  })
})

describe('roundCoord', () => {
  it('rounds to the given precision', () => {
    expect(roundCoord(44.83219, 3)).toBe(44.832)
    expect(roundCoord(-0.5708, 3)).toBe(-0.571)
  })
})

describe('planBaselineWrite', () => {
  it('writes freely when there are no samples', () => {
    expect(planBaselineWrite([])).toEqual({ interfere: false, priorBaselineIds: [] })
  })
  it('refreshes its own prior baseline', () => {
    const r = planBaselineWrite([
      { id: 'a', lab_name: SOILGRIDS_LAB, verification_status: 'unverified' },
    ])
    expect(r.interfere).toBe(false)
    expect(r.priorBaselineIds).toEqual(['a'])
  })
  it('never interferes with a real measured sample', () => {
    const r = planBaselineWrite([
      { id: 'm', lab_name: 'Eurofins', verification_status: 'verified' },
      { id: 'b', lab_name: SOILGRIDS_LAB, verification_status: 'unverified' },
    ])
    expect(r.interfere).toBe(true)
  })
  it('treats a null lab_name as a real (non-baseline) sample', () => {
    expect(planBaselineWrite([{ id: 'x', lab_name: null, verification_status: 'unverified' }]).interfere).toBe(true)
  })
})

describe('buildBaselineRow', () => {
  it('builds an unverified 0-30cm stock sample', () => {
    const p: SoilBaselineParams = {
      organizationId: 'org', landUnitType: 'vineyard', landUnitId: 'v1', lat: 45, lng: 0,
    }
    const row = buildBaselineRow(p, 49.2, '2026-06-26')
    expect(row).toMatchObject({
      organization_id: 'org',
      land_unit_type: 'vineyard',
      land_unit_id: 'v1',
      depth_cm: 30,
      soc_input_method: 'stock',
      soc_stock_tc_ha: 49.2,
      lab_name: SOILGRIDS_LAB,
      verification_status: 'unverified',
      is_active: true,
    })
    expect(row.notes).toMatch(/Not a field measurement/i)
  })
})

function mockSb(samples: unknown[]) {
  const calls: { inserted: any; deletedIds: string[] | null } = { inserted: null, deletedIds: null }
  const selectChain: any = {
    eq: () => selectChain,
    then: (res: any) => Promise.resolve({ data: samples }).then(res),
  }
  const sb: any = {
    from: () => ({
      select: () => selectChain,
      delete: () => ({ in: (_c: string, ids: string[]) => { calls.deletedIds = ids; return Promise.resolve({ error: null }) } }),
      insert: (row: any) => { calls.inserted = row; return Promise.resolve({ error: null }) },
    }),
  }
  return { sb, calls }
}

const lookupReturning = (value: number | null) =>
  async (): Promise<GeoLookupResult> => ({
    dataset: 'soilgrids_ocs_0_30cm', value, label: null, unit: 't C/ha', source: SOILGRIDS_LAB, cached: false,
  })

const P: SoilBaselineParams = { organizationId: 'org', landUnitType: 'vineyard', landUnitId: 'v1', lat: 45, lng: 0.1 }

describe('runSoilBaseline', () => {
  it('rejects null-island / invalid coordinates without touching the DB', async () => {
    const { sb, calls } = mockSb([])
    const r = await runSoilBaseline(sb, { ...P, lat: 0, lng: 0 }, lookupReturning(50))
    expect(r.status).toBe('invalid_coords')
    expect(calls.inserted).toBeNull()
  })

  it('skips a land unit that already has a real measured sample (lookup not called)', async () => {
    const { sb, calls } = mockSb([{ id: 'm', lab_name: 'Eurofins', verification_status: 'verified' }])
    let lookedUp = false
    const r = await runSoilBaseline(sb, P, async () => { lookedUp = true; return lookupReturning(50)() })
    expect(r.status).toBe('skipped_existing')
    expect(lookedUp).toBe(false)
    expect(calls.inserted).toBeNull()
  })

  it('records no_data when SoilGrids has no value here', async () => {
    const { sb, calls } = mockSb([])
    const r = await runSoilBaseline(sb, P, lookupReturning(null))
    expect(r.status).toBe('no_data')
    expect(calls.inserted).toBeNull()
  })

  it('writes a baseline when none exists', async () => {
    const { sb, calls } = mockSb([])
    const r = await runSoilBaseline(sb, P, lookupReturning(49.2))
    expect(r).toEqual({ status: 'written', value: 49.2 })
    expect(calls.inserted).toMatchObject({ soc_stock_tc_ha: 49.2, lab_name: SOILGRIDS_LAB })
    expect(calls.deletedIds).toBeNull()
  })

  it('refreshes its own prior baseline before writing the new one', async () => {
    const { sb, calls } = mockSb([{ id: 'b', lab_name: SOILGRIDS_LAB, verification_status: 'unverified' }])
    const r = await runSoilBaseline(sb, P, lookupReturning(51))
    expect(r.status).toBe('written')
    expect(calls.deletedIds).toEqual(['b'])
    expect(calls.inserted.soc_stock_tc_ha).toBe(51)
  })
})
