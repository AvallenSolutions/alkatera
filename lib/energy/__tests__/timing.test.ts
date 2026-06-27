import { describe, it, expect } from 'vitest'
import { buildTimingInsight, findCleanestWindow, findDirtiestWindow, type IntensityPoint } from '../timing'

/** A day where 02:00-04:00 is cleanest (30g) and 17:00-19:00 dirtiest (320g). */
function syntheticDay(): IntensityPoint[] {
  const pts: IntensityPoint[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      let g = 150
      if (h >= 2 && h < 4) g = 30
      else if (h >= 17 && h < 19) g = 320
      pts.push({ recordedAt: `2026-05-01T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}Z`, gPerKwh: g })
    }
  }
  return pts
}

describe('window finders', () => {
  const day = syntheticDay()
  it('finds the cleanest 2h window overnight', () => {
    const w = findCleanestWindow(day, 2)!
    expect(w.label).toBe('02:00–04:00')
    expect(w.avgG).toBe(30)
  })
  it('finds the dirtiest 2h window in the evening', () => {
    const w = findDirtiestWindow(day, 2)!
    expect(w.label).toBe('17:00–19:00')
    expect(w.avgG).toBe(320)
  })
  it('returns null when there are too few points', () => {
    expect(findCleanestWindow([{ recordedAt: '2026-05-01T00:00Z', gPerKwh: 100 }], 2)).toBeNull()
  })
})

describe('buildTimingInsight', () => {
  it('computes spread, per-kWh saving and a recommendation', () => {
    const insight = buildTimingInsight(syntheticDay(), { windowHours: 2 })
    expect(insight.spreadG).toBe(290) // 320 - 30
    expect(insight.savingKgPerKwh).toBeCloseTo(0.29, 5)
    expect(insight.recommendation).toMatch(/02:00–04:00/)
    expect(insight.recommendation).toMatch(/17:00–19:00/)
  })

  it('quantifies a shiftable load when provided', () => {
    const insight = buildTimingInsight(syntheticDay(), { windowHours: 2, shiftableKwh: 500 })
    // 500 kWh * 0.29 kg/kWh = 145 kg
    expect(insight.recommendation).toMatch(/145 kg CO2e/)
    expect(insight.recommendation).toMatch(/500 kWh/)
  })

  it('makes no recommendation on a flat day', () => {
    const flat: IntensityPoint[] = Array.from({ length: 48 }, (_, i) => ({
      recordedAt: `2026-05-01T${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}Z`,
      gPerKwh: 200,
    }))
    expect(buildTimingInsight(flat).recommendation).toBeNull()
  })
})
