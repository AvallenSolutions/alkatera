import { describe, it, expect } from 'vitest'
import { estimateTravel, TRAVEL_FACTORS } from '@/lib/hospitality/travel-estimator'

describe('estimateTravel', () => {
  it('computes round-trip carbon per mode and per attendee', () => {
    const r = estimateTravel({ attendees: 100, avg_distance_km: 20, split: { car: 50, train: 50 } })
    // car: 50 attendees × 40 km round trip × factor; train: 50 × 40 × factor
    const expected = 50 * 40 * TRAVEL_FACTORS.car + 50 * 40 * TRAVEL_FACTORS.train
    expect(r.total_kg).toBeCloseTo(expected, 4)
    expect(r.per_attendee_kg).toBeCloseTo(expected / 100, 4)
    expect(r.split_incomplete).toBe(false)
  })

  it('flags an incomplete modal split', () => {
    const r = estimateTravel({ attendees: 100, avg_distance_km: 10, split: { car: 60 } })
    expect(r.split_incomplete).toBe(true)
  })

  it('treats walking and cycling as zero carbon', () => {
    const r = estimateTravel({ attendees: 50, avg_distance_km: 5, split: { walk: 50, cycle: 50 } })
    expect(r.total_kg).toBe(0)
  })
})
