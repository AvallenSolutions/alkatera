import { describe, it, expect } from 'vitest'
import { computeBenchmarking, benchmarkingCsv } from '@/lib/hospitality/benchmarking'
import { getGridFactor } from '@/lib/grid-emission-factors'
import { NATURAL_GAS_FACTOR } from '@/lib/hospitality/room-allocation'

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

const YEAR = 2026
const P = { reporting_period_start: '2026-01-01', reporting_period_end: '2026-12-31' }

describe('computeBenchmarking', () => {
  it('computes per-occupied-room-night energy, water and carbon', async () => {
    const db = makeDb({
      hospitality_venues: [{ facility_id: 'f1', country: 'GB' }],
      utility_data_entries: [
        { utility_type: 'electricity_grid', quantity: 12000, unit: 'kWh', ...P },
        { utility_type: 'natural_gas', quantity: 6000, unit: 'kWh', ...P },
      ],
      facility_activity_entries: [{ quantity: 500, unit: 'm3', ...P }],
      products: [{ id: 1 }],
      hospitality_service_volumes: [{ units_sold: 1000, period_start: '2026-01-01', period_end: '2026-12-31' }],
    })
    const b = await computeBenchmarking(db, 'org', YEAR)
    const grid = getGridFactor('GB', 'uk').factor
    expect(b.room_nights).toBeCloseTo(1000, 4)
    expect(b.energy_kwh).toBeCloseTo(18000, 4)
    expect(b.water_litres).toBeCloseTo(500000, 4)
    expect(b.energy_kwh_per_night).toBeCloseTo(18, 4)
    expect(b.water_litres_per_night).toBeCloseTo(500, 4)
    const energyCarbon = 12000 * grid + 6000 * NATURAL_GAS_FACTOR
    expect(b.energy_co2e).toBeCloseTo(energyCarbon, 3)
    expect(b.co2e_per_night).toBeCloseTo(energyCarbon / 1000, 4)
  })

  it('nulls per-night intensities when no room-nights are recorded', async () => {
    const db = makeDb({ hospitality_venues: [], products: [], hospitality_service_volumes: [] })
    const b = await computeBenchmarking(db, 'org', YEAR)
    expect(b.co2e_per_night).toBeNull()
    expect(benchmarkingCsv(b)).toContain('occupied_room_nights')
  })
})
