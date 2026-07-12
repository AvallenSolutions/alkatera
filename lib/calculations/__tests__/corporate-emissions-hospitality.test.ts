import { describe, it, expect } from 'vitest'
import { calculateScope3 } from '@/lib/calculations/corporate-emissions'

/**
 * Proxy-based Supabase stub: any query-builder method returns the same chain, and
 * awaiting the chain resolves to `{ data: rows }` for the table it was opened on.
 * This lets calculateScope3 run end-to-end while every category except the ones we
 * populate sees empty data and contributes 0.
 */
function makeDb(tables: Record<string, any[]>) {
  function chainFor(rows: any[]) {
    const terminal: any = {
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (res: any, rej: any) => Promise.resolve({ data: rows, error: null }).then(res, rej),
    }
    const proxy: any = new Proxy(terminal, {
      get(t, prop) {
        if (prop in t) return (t as any)[prop]
        return () => proxy
      },
    })
    return proxy
  }
  return { from: (table: string) => chainFor(tables[table] ?? []) } as any
}

const YEAR = 2026
const YEAR_START = '2026-01-01'
const YEAR_END = '2026-12-31'

describe('calculateScope3 hospitality integration', () => {
  it('excludes hospitality products from the product-LCA rollup (production-log path)', async () => {
    const db = makeDb({
      production_logs: [{ product_id: 1, units_produced: 100 }],
      products: [{ id: 1, product_kind: 'hospitality_meal' }],
      product_carbon_footprints: [
        {
          product_id: 1,
          aggregated_impacts: { breakdown: { by_scope: { scope3: 9 } } },
          status: 'completed',
          updated_at: '2026-02-01',
          created_at: '2026-02-01',
        },
      ],
    })
    const breakdown = await calculateScope3(db, 'org', YEAR, YEAR_START, YEAR_END, {
      includeHospitality: false,
    })
    // Product 1 is hospitality → counted via calculateHospitality, never in products.
    expect(breakdown.products).toBe(0)
  })

  it('adds the hospitality figure to the total only when included', async () => {
    const tables = {
      production_logs: [] as any[],
      products: [{ id: 1, product_kind: 'hospitality_meal' }],
      hospitality_service_volumes: [{ product_id: 1, units_sold: 100 }],
      hospitality_meal_meta: [{ product_id: 1, covers: 4 }],
      hospitality_waste: [] as any[],
      product_carbon_footprints: [
        {
          product_id: 1,
          aggregated_impacts: { breakdown: { by_scope: { scope3: 12 } } },
          status: 'completed',
          updated_at: '2026-02-01',
          created_at: '2026-02-01',
        },
      ],
    }

    const included = await calculateScope3(makeDb(tables), 'org', YEAR, YEAR_START, YEAR_END, {
      includeHospitality: true,
    })
    // (12 / 4) * 100 = 300
    expect(included.hospitality).toBeCloseTo(300, 6)
    expect(included.hospitality_food).toBeCloseTo(300, 6)
    expect(included.total).toBeCloseTo(300, 6)

    const excluded = await calculateScope3(makeDb(tables), 'org', YEAR, YEAR_START, YEAR_END, {
      includeHospitality: false,
    })
    expect(excluded.hospitality).toBe(0)
    expect(excluded.total).toBe(0)
  })
})
