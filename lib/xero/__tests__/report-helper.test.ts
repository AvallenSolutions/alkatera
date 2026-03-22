import { describe, it, expect } from 'vitest'
import { deriveReportingYear } from '../report-helper'

describe('deriveReportingYear', () => {
  it('returns year from valid dateStr', () => {
    expect(deriveReportingYear('2025-06-15')).toBe(2025)
  })

  it('returns year from ISO date string', () => {
    expect(deriveReportingYear('2024-12-31T23:59:59Z')).toBe(2024)
  })

  it('falls back to most recent transaction date when dateStr is null', () => {
    const result = deriveReportingYear(null, ['2024-03-01', '2025-07-15', '2024-11-30'])
    expect(result).toBe(2025)
  })

  it('sorts transaction dates descending and uses the latest', () => {
    const result = deriveReportingYear(undefined, ['2023-01-01', '2026-06-01', '2025-12-31'])
    expect(result).toBe(2026)
  })

  it('ignores invalid dates in transactionDates array', () => {
    const result = deriveReportingYear(null, ['invalid', '2025-03-15', 'not-a-date'])
    expect(result).toBe(2025)
  })

  it('returns current year when both inputs are null/undefined', () => {
    const result = deriveReportingYear(null, undefined)
    expect(result).toBe(new Date().getFullYear())
  })

  it('returns current year when transactionDates is empty array', () => {
    const result = deriveReportingYear(null, [])
    expect(result).toBe(new Date().getFullYear())
  })

  it('invalid dateStr falls through to transactionDates', () => {
    const result = deriveReportingYear('not-a-date', ['2025-06-01'])
    expect(result).toBe(2025)
  })
})
