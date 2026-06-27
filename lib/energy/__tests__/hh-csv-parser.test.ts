import { describe, it, expect } from 'vitest'
import { parseHalfHourlyCsv, parseDateCell, parseDateTimeCell } from '../hh-csv-parser'

describe('parseDateCell', () => {
  it('reads ISO and UK day-first dates', () => {
    expect(parseDateCell('2026-05-01')).toBe('2026-05-01')
    expect(parseDateCell('2026/05/01')).toBe('2026-05-01')
    expect(parseDateCell('01/05/2026')).toBe('2026-05-01') // UK DD/MM/YYYY
    expect(parseDateCell('1-5-2026')).toBe('2026-05-01')
  })
  it('returns null for junk', () => {
    expect(parseDateCell('')).toBeNull()
    expect(parseDateCell('not a date')).toBeNull()
  })
})

describe('parseDateTimeCell', () => {
  it('parses "<date> <time>" to an ISO half hour', () => {
    expect(parseDateTimeCell('2026-05-01 00:30')).toBe('2026-05-01T00:30Z')
    expect(parseDateTimeCell('01/05/2026 13:00')).toBe('2026-05-01T13:00Z')
    expect(parseDateTimeCell('2026-05-01T23:30:00Z')).toBe('2026-05-01T23:30Z')
  })
})

describe('parseHalfHourlyCsv — long format', () => {
  const csv = [
    'Timestamp,Consumption (kWh)',
    '2026-05-01 00:00,12.5',
    '2026-05-01 00:30,11.2',
    '2026-05-01 01:00,10.8',
  ].join('\n')

  it('parses timestamp + kWh rows', () => {
    const r = parseHalfHourlyCsv(csv)
    expect(r.format).toBe('long')
    expect(r.readings).toHaveLength(3)
    expect(r.readings[0]).toEqual({ recordedAt: '2026-05-01T00:00Z', kwh: 12.5 })
    expect(r.readings[2]).toEqual({ recordedAt: '2026-05-01T01:00Z', kwh: 10.8 })
    expect(r.errors).toHaveLength(0)
  })

  it('skips blank/garbled kWh cells without aborting', () => {
    const r = parseHalfHourlyCsv('Timestamp,kWh\n2026-05-01 00:00,5\n2026-05-01 00:30,\n2026-05-01 01:00,x')
    expect(r.readings).toHaveLength(1)
  })
})

describe('parseHalfHourlyCsv — wide format', () => {
  // Date + 48 half-hour columns.
  const times: string[] = []
  for (let h = 0; h < 24; h++) for (const m of ['00', '30']) times.push(`${String(h).padStart(2, '0')}:${m}`)
  const header = ['Date', ...times].join(',')
  const day1 = ['01/05/2026', ...times.map((_, i) => String(1 + (i % 5)))].join(',')
  const csv = [header, day1].join('\n')

  it('expands 48 columns into 48 readings', () => {
    const r = parseHalfHourlyCsv(csv)
    expect(r.format).toBe('wide')
    expect(r.readings).toHaveLength(48)
    expect(r.readings[0]).toEqual({ recordedAt: '2026-05-01T00:00Z', kwh: 1 })
    expect(r.readings[1].recordedAt).toBe('2026-05-01T00:30Z')
    expect(r.readings[47].recordedAt).toBe('2026-05-01T23:30Z')
  })
})

describe('parseHalfHourlyCsv — failure', () => {
  it('reports unknown layout rather than mis-parsing', () => {
    const r = parseHalfHourlyCsv('Apples,Oranges\n1,2\n3,4')
    expect(r.format).toBe('unknown')
    expect(r.readings).toHaveLength(0)
    expect(r.errors[0]).toMatch(/could not detect/i)
  })
})
