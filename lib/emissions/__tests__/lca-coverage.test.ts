import { describe, it, expect } from 'vitest'
import { getLcaCoveredIngredientIds } from '../lca-coverage'

type Row = Record<string, unknown>
type BuilderState = {
  table: string
  filters: Array<{ op: string; col: string; val: unknown }>
}

function makeMock(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const state: BuilderState = { table, filters: [] }
      const query: Record<string, unknown> = {}
      const run = () => {
        let rows = tables[state.table] ?? []
        for (const f of state.filters) {
          if (f.op === 'eq') rows = rows.filter((r) => r[f.col] === f.val)
          else if (f.op === 'in') rows = rows.filter((r) => (f.val as unknown[]).includes(r[f.col]))
          else if (f.op === 'not_null') rows = rows.filter((r) => r[f.col] !== null && r[f.col] !== undefined)
        }
        return Promise.resolve({ data: rows, error: null })
      }
      query.select = () => query
      query.eq = (col: string, val: unknown) => {
        state.filters.push({ op: 'eq', col, val })
        return query
      }
      query.in = (col: string, val: unknown[]) => {
        state.filters.push({ op: 'in', col, val })
        return query
      }
      query.not = (col: string, _op: string, _val: unknown) => {
        state.filters.push({ op: 'not_null', col, val: null })
        return query
      }
      query.then = (resolve: (v: unknown) => unknown) => run().then(resolve)
      return query
    },
  }
}

describe('getLcaCoveredIngredientIds', () => {
  it('returns empty set when org has no completed LCAs', async () => {
    const supabase = makeMock({
      product_carbon_footprints: [
        { organization_id: 'org-1', status: 'draft', product_id: 101 },
      ],
      product_materials: [
        { product_id: 101, material_id: 'ing-a', material_type: 'ingredient' },
      ],
    })
    const out = await getLcaCoveredIngredientIds(supabase as never, 'org-1')
    expect(out.size).toBe(0)
  })

  it('returns ingredient ids only from completed LCAs', async () => {
    const supabase = makeMock({
      product_carbon_footprints: [
        { organization_id: 'org-1', status: 'completed', product_id: 101 },
        { organization_id: 'org-1', status: 'draft', product_id: 102 },
        { organization_id: 'org-2', status: 'completed', product_id: 201 },
      ],
      product_materials: [
        { product_id: 101, material_id: 'ing-bottle', material_type: 'ingredient' },
        { product_id: 101, material_id: 'ing-cork', material_type: 'ingredient' },
        { product_id: 102, material_id: 'ing-label', material_type: 'ingredient' },
      ],
    })
    const out = await getLcaCoveredIngredientIds(supabase as never, 'org-1')
    expect(Array.from(out).sort()).toEqual(['ing-bottle', 'ing-cork'])
  })

  it('skips packaging/other material types', async () => {
    const supabase = makeMock({
      product_carbon_footprints: [
        { organization_id: 'org-1', status: 'completed', product_id: 101 },
      ],
      product_materials: [
        { product_id: 101, material_id: 'ing-bottle', material_type: 'ingredient' },
        { product_id: 101, material_id: 'pkg-box', material_type: 'packaging' },
      ],
    })
    const out = await getLcaCoveredIngredientIds(supabase as never, 'org-1')
    expect(Array.from(out)).toEqual(['ing-bottle'])
  })

  it('filters out null material_ids', async () => {
    const supabase = makeMock({
      product_carbon_footprints: [
        { organization_id: 'org-1', status: 'completed', product_id: 101 },
      ],
      product_materials: [
        { product_id: 101, material_id: 'ing-a', material_type: 'ingredient' },
        { product_id: 101, material_id: null, material_type: 'ingredient' },
      ],
    })
    const out = await getLcaCoveredIngredientIds(supabase as never, 'org-1')
    expect(out.size).toBe(1)
    expect(out.has('ing-a')).toBe(true)
  })
})
