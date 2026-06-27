import { describe, it, expect } from 'vitest'
import { deriveMonthlyEntries, readingsSpan, fuelToUtility } from '../derive-utility'

const readings = [
  { recordedAt: '2026-05-01T00:00Z', kwh: 10 },
  { recordedAt: '2026-05-31T23:30Z', kwh: 5 },
  { recordedAt: '2026-06-01T00:00Z', kwh: 8 },
  { recordedAt: '2026-06-15T12:00Z', kwh: 2 },
]

describe('fuelToUtility', () => {
  it('maps fuels to utility_type + scope', () => {
    expect(fuelToUtility('electricity')).toEqual({ utilityType: 'electricity_grid', scope: 'Scope 2' })
    expect(fuelToUtility('gas')).toEqual({ utilityType: 'natural_gas', scope: 'Scope 1' })
  })
})

describe('readingsSpan', () => {
  it('returns the inclusive date span', () => {
    expect(readingsSpan(readings)).toEqual({ from: '2026-05-01', to: '2026-06-15' })
  })
  it('null for empty', () => {
    expect(readingsSpan([])).toBeNull()
  })
})

describe('deriveMonthlyEntries', () => {
  it('rolls half-hours up to one row per calendar month', () => {
    const rows = deriveMonthlyEntries(readings, 'electricity')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      utility_type: 'electricity_grid',
      quantity: 15, // May: 10 + 5
      unit: 'kWh',
      reporting_period_start: '2026-05-01',
      reporting_period_end: '2026-05-31',
      calculated_scope: 'Scope 2',
      data_source: 'smart_meter',
      meter_type: 'half_hourly',
    })
    expect(rows[1]).toMatchObject({ quantity: 10, reporting_period_start: '2026-06-01', reporting_period_end: '2026-06-15' })
  })

  it('tags gas as natural_gas / Scope 1', () => {
    const rows = deriveMonthlyEntries(readings, 'gas')
    expect(rows[0].utility_type).toBe('natural_gas')
    expect(rows[0].calculated_scope).toBe('Scope 1')
  })
})
