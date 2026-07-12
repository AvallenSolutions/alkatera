import { describe, it, expect } from 'vitest'
import { calculateHospitality, scope3Of } from '@/lib/calculations/hospitality-emissions'

/**
 * Stateful Supabase stub. Every chained query resolves to `{ data: tables[name] }`
 * for the table it was opened on, so `await db.from(t).select()...` yields that
 * table's rows regardless of the intermediate .eq/.in/.lte/.gte/.order calls.
 */
function makeDb(tables: Record<string, any[]>) {
  function builder(table: string) {
    const rows = tables[table] ?? []
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      lte: () => chain,
      gte: () => chain,
      order: () => chain,
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null }),
      single: () => Promise.resolve({ data: rows[0] ?? null }),
      then: (resolve: any) => Promise.resolve({ data: rows }).then(resolve),
    }
    return chain
  }
  return { from: builder } as any
}

const YEAR_START = '2026-01-01'
const YEAR_END = '2026-12-31'

describe('scope3Of', () => {
  it('uses the explicit scope3 figure when present', () => {
    expect(scope3Of({ climate_change_gwp100: 100, breakdown: { by_scope: { scope3: 60 } } })).toBe(60)
  })

  it('derives total − scope1 − scope2 when by_scope has no scope3 key (no double count)', () => {
    // A PCF that somehow carries Scope 1/2 must not count those as Scope 3.
    expect(scope3Of({ climate_change_gwp100: 100, breakdown: { by_scope: { scope1: 10, scope2: 15 } } })).toBe(75)
  })

  it('falls back to the full GWP only when there is no scope split at all', () => {
    expect(scope3Of({ climate_change_gwp100: 42 })).toBe(42)
  })

  it('never returns a negative figure', () => {
    expect(scope3Of({ climate_change_gwp100: 5, breakdown: { by_scope: { scope1: 10 } } })).toBe(0)
  })
})

describe('calculateHospitality', () => {
  it('weights per-serving Scope 3 by covers and units sold', async () => {
    const db = makeDb({
      hospitality_waste: [],
      hospitality_service_volumes: [{ product_id: 1, units_sold: 100 }],
      products: [{ id: 1, product_kind: 'hospitality_meal' }],
      hospitality_meal_meta: [{ product_id: 1, covers: 4 }],
      product_carbon_footprints: [
        { product_id: 1, aggregated_impacts: { breakdown: { by_scope: { scope3: 12 } } }, created_at: '2026-02-01' },
      ],
    })
    const r = await calculateHospitality(db, 'org', YEAR_START, YEAR_END)
    // (12 / 4) * 100 = 300
    expect(r.food).toBeCloseTo(300, 6)
    expect(r.supplies).toBe(0)
    expect(r.waste).toBe(0)
    expect(r.total).toBeCloseTo(300, 6)
    expect(r.volume_rows).toBe(1)
  })

  it('computes throughput-weighted embodied water and land alongside carbon', async () => {
    const db = makeDb({
      hospitality_waste: [],
      hospitality_service_volumes: [{ product_id: 1, units_sold: 100 }],
      products: [{ id: 1, product_kind: 'hospitality_meal' }],
      hospitality_meal_meta: [{ product_id: 1, covers: 4 }],
      product_carbon_footprints: [
        {
          product_id: 1,
          aggregated_impacts: { breakdown: { by_scope: { scope3: 12 } }, water_consumption: 8, land_use: 20 },
          created_at: '2026-02-01',
        },
      ],
    })
    const r = await calculateHospitality(db, 'org', YEAR_START, YEAR_END)
    expect(r.water_m3).toBeCloseTo((8 / 4) * 100, 6) // 200
    expect(r.land_m2).toBeCloseTo((20 / 4) * 100, 6) // 500
  })

  it('routes room-nights to supplies, not food', async () => {
    const db = makeDb({
      hospitality_waste: [],
      hospitality_service_volumes: [{ product_id: 2, units_sold: 10 }],
      products: [{ id: 2, product_kind: 'hospitality_room_night' }],
      hospitality_meal_meta: [{ product_id: 2, covers: 1 }],
      product_carbon_footprints: [
        { product_id: 2, aggregated_impacts: { breakdown: { by_scope: { scope3: 5 } } }, created_at: '2026-02-01' },
      ],
    })
    const r = await calculateHospitality(db, 'org', YEAR_START, YEAR_END)
    expect(r.supplies).toBeCloseTo(50, 6)
    expect(r.food).toBe(0)
    expect(r.total).toBeCloseTo(50, 6)
  })

  it('skips non-hospitality products (e.g. own wine served in the venue)', async () => {
    const db = makeDb({
      hospitality_waste: [],
      hospitality_service_volumes: [{ product_id: 3, units_sold: 100 }],
      products: [{ id: 3, product_kind: 'product' }],
      hospitality_meal_meta: [],
      product_carbon_footprints: [
        { product_id: 3, aggregated_impacts: { breakdown: { by_scope: { scope3: 9 } } }, created_at: '2026-02-01' },
      ],
    })
    const r = await calculateHospitality(db, 'org', YEAR_START, YEAR_END)
    expect(r.food).toBe(0)
    expect(r.supplies).toBe(0)
    expect(r.volume_rows).toBe(0)
  })

  it('falls back to full climate_change_gwp100 when there is no scope split', async () => {
    const db = makeDb({
      hospitality_waste: [],
      hospitality_service_volumes: [{ product_id: 4, units_sold: 10 }],
      products: [{ id: 4, product_kind: 'hospitality_meal' }],
      hospitality_meal_meta: [{ product_id: 4, covers: 2 }],
      product_carbon_footprints: [
        { product_id: 4, aggregated_impacts: { climate_change_gwp100: 8 }, created_at: '2026-02-01' },
      ],
    })
    const r = await calculateHospitality(db, 'org', YEAR_START, YEAR_END)
    // (8 / 2) * 10 = 40
    expect(r.food).toBeCloseTo(40, 6)
  })

  it('counts waste even when there are no service volumes', async () => {
    const db = makeDb({
      hospitality_waste: [
        { waste_stream: 'food', treatment_method: 'landfill', mass_kg: 100 },
      ],
      hospitality_service_volumes: [],
      products: [],
      hospitality_meal_meta: [],
      product_carbon_footprints: [],
    })
    const r = await calculateHospitality(db, 'org', YEAR_START, YEAR_END)
    expect(r.food).toBe(0)
    expect(r.supplies).toBe(0)
    expect(r.volume_rows).toBe(0)
    expect(r.waste).toBeGreaterThan(0)
    expect(r.total).toBe(r.waste)
  })

  it('applies the prep-waste uplift to the Scope 3 contribution', async () => {
    const db = makeDb({
      hospitality_waste: [],
      hospitality_service_volumes: [{ product_id: 6, units_sold: 100 }],
      products: [{ id: 6, product_kind: 'hospitality_meal' }],
      hospitality_meal_meta: [{ product_id: 6, covers: 4, prep_waste_pct: 10 }],
      product_carbon_footprints: [
        { product_id: 6, aggregated_impacts: { breakdown: { by_scope: { scope3: 12 } } }, created_at: '2026-02-01' },
      ],
    })
    const r = await calculateHospitality(db, 'org', YEAR_START, YEAR_END)
    // 12 * 1.1 / 4 * 100 = 330
    expect(r.food).toBeCloseTo(330, 6)
  })

  it('defaults covers to 1 when no meal meta row exists', async () => {
    const db = makeDb({
      hospitality_waste: [],
      hospitality_service_volumes: [{ product_id: 5, units_sold: 5 }],
      products: [{ id: 5, product_kind: 'hospitality_meal' }],
      hospitality_meal_meta: [],
      product_carbon_footprints: [
        { product_id: 5, aggregated_impacts: { breakdown: { by_scope: { scope3: 6 } } }, created_at: '2026-02-01' },
      ],
    })
    const r = await calculateHospitality(db, 'org', YEAR_START, YEAR_END)
    // (6 / 1) * 5 = 30
    expect(r.food).toBeCloseTo(30, 6)
  })
})
