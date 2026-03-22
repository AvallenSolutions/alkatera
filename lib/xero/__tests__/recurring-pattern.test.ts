import { describe, it, expect } from 'vitest'
import { calculateProRatedValues } from '../recurring-pattern'
import type { RecurringGroup } from '../recurring-pattern'

function makeGroup(monthKey: string, spend: number): RecurringGroup {
  return {
    monthKey,
    monthLabel: `${monthKey} label`,
    spend,
    transactionCount: 1,
    transactionIds: [`tx-${monthKey}`],
    proRatedQuantity: 0,
  }
}

describe('calculateProRatedValues', () => {
  it('pro-rates proportionally when target spend is double base', () => {
    const groups = [makeGroup('2026-02', 200)]
    const result = calculateProRatedValues(100, 100, groups)
    expect(result[0].proRatedQuantity).toBeCloseTo(200, 2)
  })

  it('pro-rates to half when target spend is half of base', () => {
    const groups = [makeGroup('2026-02', 50)]
    const result = calculateProRatedValues(100, 100, groups)
    expect(result[0].proRatedQuantity).toBeCloseTo(50, 2)
  })

  it('returns unchanged groups when baseSpend <= 0', () => {
    const groups = [makeGroup('2026-02', 200)]
    const result = calculateProRatedValues(100, 0, groups)
    expect(result[0].proRatedQuantity).toBe(0) // unchanged
  })

  it('returns unchanged groups when baseSpend is negative', () => {
    const groups = [makeGroup('2026-02', 200)]
    const result = calculateProRatedValues(100, -50, groups)
    expect(result[0].proRatedQuantity).toBe(0)
  })

  it('equal spend returns same quantity as base', () => {
    const groups = [makeGroup('2026-02', 100)]
    const result = calculateProRatedValues(500, 100, groups)
    expect(result[0].proRatedQuantity).toBeCloseTo(500, 2)
  })

  it('rounds to 2 decimal places', () => {
    const groups = [makeGroup('2026-02', 33)]
    const result = calculateProRatedValues(100, 100, groups)
    expect(result[0].proRatedQuantity).toBe(33) // 33/100 * 100 = 33.00
  })

  it('multiple groups pro-rated independently', () => {
    const groups = [
      makeGroup('2026-02', 200),
      makeGroup('2026-03', 150),
      makeGroup('2026-04', 50),
    ]
    const result = calculateProRatedValues(100, 100, groups)
    expect(result[0].proRatedQuantity).toBeCloseTo(200, 2)
    expect(result[1].proRatedQuantity).toBeCloseTo(150, 2)
    expect(result[2].proRatedQuantity).toBeCloseTo(50, 2)
  })

  it('zero base quantity returns 0 for all groups', () => {
    const groups = [makeGroup('2026-02', 200)]
    const result = calculateProRatedValues(0, 100, groups)
    expect(result[0].proRatedQuantity).toBe(0)
  })
})
