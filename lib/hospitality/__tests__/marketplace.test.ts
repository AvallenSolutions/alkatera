import { describe, it, expect } from 'vitest'
import { listMarketplaceProducers } from '@/lib/hospitality/marketplace'

function makeDb(tables: Record<string, any[]>) {
  function builder(table: string) {
    const rows = tables[table] ?? []
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      filter: () => chain,
      order: () => chain,
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null }),
      then: (resolve: any) => Promise.resolve({ data: rows }).then(resolve),
    }
    return chain
  }
  return { from: builder } as any
}

describe('listMarketplaceProducers', () => {
  it('summarises opt-in producers, ranks by verified count, and excludes the caller', async () => {
    const db = makeDb({
      organizations: [
        { id: 'o1', name: 'Everleaf', country: 'GB', report_defaults: { marketplace_listed: true } },
        { id: 'o2', name: 'Avallen', country: 'FR', report_defaults: { marketplace_listed: true } },
      ],
      products: [
        { id: 1, organization_id: 'o1', product_category: 'Wine' },
        { id: 2, organization_id: 'o1', product_category: 'Spirits' },
        { id: 3, organization_id: 'o2', product_category: 'Spirits' },
      ],
      product_carbon_footprints: [
        { product_id: 1, organization_id: 'o1', status: 'completed', aggregated_impacts: { climate_change_gwp100: 1.2 } },
      ],
    })
    const r = await listMarketplaceProducers(db, { excludeOrgId: 'self' })
    if (!r.ok) throw new Error(r.error)
    expect(r.data).toHaveLength(2)
    // Everleaf has a verified product → ranked first.
    expect(r.data[0].name).toBe('Everleaf')
    expect(r.data[0].product_count).toBe(2)
    expect(r.data[0].categories).toEqual(['Spirits', 'Wine'])
    expect(r.data[0].verified_count).toBe(1)
    expect(r.data[0].avg_carbon).toBeCloseTo(1.2, 6)
    expect(r.data[1].verified_count).toBe(0)
    expect(r.data[1].avg_carbon).toBeNull()
  })
})
