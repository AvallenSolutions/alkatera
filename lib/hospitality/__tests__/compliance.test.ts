import { describe, it, expect } from 'vitest'
import { computeCompliance, complianceCsv } from '@/lib/hospitality/compliance'

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
      then: (resolve: any) => Promise.resolve({ data: rows }).then(resolve),
    }
    return chain
  }
  return { from: builder } as any
}

describe('computeCompliance', () => {
  it('assembles the AGEC food-waste export from the waste log', async () => {
    const db = makeDb({
      hospitality_waste: [
        { waste_stream: 'food', treatment_method: 'composting', mass_kg: 300 },
        { waste_stream: 'food', treatment_method: 'landfill', mass_kg: 100 },
        { waste_stream: 'dry', treatment_method: 'recycling', mass_kg: 50 },
      ],
    })
    const e = await computeCompliance(db, 'org', 2026, 'agec')
    expect(e.framework).toBe('agec')
    const food = e.rows.find((r) => r.metric === 'Total food waste')
    expect(food?.value).toBe(400)
    const diverted = e.rows.find((r) => r.metric === 'Waste diverted from disposal')
    expect(diverted?.value).toBe(350) // composting 300 + recycling 50
    const csv = complianceCsv(e)
    expect(csv.split('\n')[0]).toBe('framework,year,metric,value,unit')
    expect(csv).toContain('agec,2026,Total food waste,400,kg')
  })
})
