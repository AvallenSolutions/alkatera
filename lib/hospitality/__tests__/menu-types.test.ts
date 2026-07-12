import { describe, it, expect } from 'vitest'
import { summariseMenu, type MenuItemView } from '@/lib/hospitality/menu-types'

function item(id: string, perServing: number | null): MenuItemView {
  return {
    id,
    product_id: Number(id),
    product_name: `Item ${id}`,
    item_kind: 'meal',
    serves: 1,
    internal_consumption: false,
    sort_order: 0,
    impact: perServing == null
      ? null
      : {
          total_co2e: perServing,
          per_cover_co2e: perServing,
          per_cover_water: 0,
          per_cover_land: 0,
          per_cover_cooking_co2e: 0,
          per_cover_display_co2e: perServing,
        },
  }
}

describe('summariseMenu', () => {
  it('averages over priced items only and totals a one-of-everything footprint', () => {
    const agg = summariseMenu([item('1', 2), item('2', 4), item('3', null)])
    expect(agg.item_count).toBe(3)
    expect(agg.priced_count).toBe(2)
    expect(agg.total_co2e).toBeCloseTo(6, 6)
    expect(agg.avg_co2e).toBeCloseTo(3, 6) // (2 + 4) / 2, the null item is excluded
  })

  it('reports a zero average when nothing is priced', () => {
    const agg = summariseMenu([item('1', null)])
    expect(agg.item_count).toBe(1)
    expect(agg.priced_count).toBe(0)
    expect(agg.avg_co2e).toBe(0)
  })
})
