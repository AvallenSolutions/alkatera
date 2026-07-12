import { describe, it, expect } from 'vitest'
import { computeEventFootprint, DIESEL_FACTOR } from '@/lib/hospitality/event-service'
import { getGridFactor } from '@/lib/grid-emission-factors'
import { TRAVEL_FACTORS } from '@/lib/hospitality/travel-estimator'

describe('computeEventFootprint', () => {
  it('sums attendee travel, temporary power and catering', () => {
    const grid = getGridFactor('GB', 'uk').factor
    const fp = computeEventFootprint({
      attendee_count: 100,
      avg_distance_km: 20,
      travel_split: { car: 50, train: 50 },
      generator_litres: 40,
      temp_electricity_kwh: 200,
      catering_co2e: 500,
      country: 'GB',
    })
    const travel = 50 * 40 * TRAVEL_FACTORS.car + 50 * 40 * TRAVEL_FACTORS.train
    const power = 40 * DIESEL_FACTOR + 200 * grid
    expect(fp.travel.total_kg).toBeCloseTo(travel, 4)
    expect(fp.temp_power_co2e).toBeCloseTo(power, 4)
    expect(fp.catering_co2e).toBe(500)
    expect(fp.total_co2e).toBeCloseTo(travel + power + 500, 4)
    expect(fp.per_attendee_co2e).toBeCloseTo((travel + power + 500) / 100, 4)
  })

  it('returns null per-attendee when there are no attendees', () => {
    const fp = computeEventFootprint({ attendee_count: 0, catering_co2e: 100 })
    expect(fp.per_attendee_co2e).toBeNull()
    expect(fp.total_co2e).toBe(100)
  })
})
