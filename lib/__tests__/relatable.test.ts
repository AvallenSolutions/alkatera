import { describe, it, expect } from 'vitest'
import {
  relatable,
  roundForDisplay,
  formatCount,
  __testing,
  type MetricKind,
} from '../relatable'

const KINDS: MetricKind[] = ['co2e', 'water', 'waste', 'energy', 'land']

describe('relatable selector', () => {
  it('returns an empty array for zero, negative, or non-finite input', () => {
    for (const kind of KINDS) {
      expect(relatable(kind, 0)).toEqual([])
      expect(relatable(kind, -5)).toEqual([])
      expect(relatable(kind, NaN)).toEqual([])
      expect(relatable(kind, Infinity)).toEqual([])
    }
  })

  it('returns at most max comparisons (default 3)', () => {
    for (const kind of KINDS) {
      expect(relatable(kind, 1_000).length).toBeLessThanOrEqual(3)
      expect(relatable(kind, 1_000, { max: 5 }).length).toBeLessThanOrEqual(5)
      expect(relatable(kind, 1_000, { max: 1 }).length).toBeLessThanOrEqual(1)
    }
  })

  it('returns at least one comparison across a range of realistic magnitudes', () => {
    const magnitudes: Record<MetricKind, number[]> = {
      co2e: [5, 50, 500, 5_000, 50_000],
      water: [1, 50, 500, 5_000, 50_000],
      waste: [50, 500, 5_000, 50_000, 500_000],
      energy: [10, 500, 5_000, 50_000, 500_000],
      land: [0.5, 5, 50, 500, 5_000],
    }
    for (const kind of KINDS) {
      for (const value of magnitudes[kind]) {
        const result = relatable(kind, value)
        expect(result.length, `kind=${kind} value=${value}`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('never picks a comparison whose count rounds below 1 or above 1 billion', () => {
    const probes = [0.1, 1, 1_000, 1_000_000, 1_000_000_000_000]
    for (const kind of KINDS) {
      for (const value of probes) {
        for (const c of relatable(kind, value)) {
          expect(c.rawCount, `kind=${kind} value=${value}`).toBeGreaterThanOrEqual(1)
          expect(c.rawCount, `kind=${kind} value=${value}`).toBeLessThan(1_000_000_000)
        }
      }
    }
  })

  it('picks small-scale anchors for small inputs and large-scale anchors for large inputs', () => {
    const smallCO2 = relatable('co2e', 5)
    const largeCO2 = relatable('co2e', 100_000)
    const smallLabels = smallCO2.map((c) => c.label).join(' ')
    const largeLabels = largeCO2.map((c) => c.label).join(' ')

    expect(smallLabels.toLowerCase()).toMatch(/balloon|laundry|km/)
    expect(largeLabels.toLowerCase()).toMatch(/flight|household|home/)
  })

  it('never includes tree-based CO₂ framing', () => {
    const probes = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000]
    for (const value of probes) {
      const result = relatable('co2e', value)
      const joined = JSON.stringify(result).toLowerCase()
      expect(joined).not.toMatch(/\btree\b|\bforest\b|\bsapling\b/)
    }
  })

  it('never includes drinks-industry production framing (self-referential to alkatera users)', () => {
    const probes = [0.5, 5, 50, 500, 5_000, 50_000, 500_000]
    for (const value of probes) {
      const result = relatable('co2e', value)
      const joined = JSON.stringify(result).toLowerCase()
      expect(joined).not.toMatch(/pint of beer|pints of beer|bottle of wine|bottles of wine|beer produced|wine produced/)
    }
  })

  it('uses the singular label when the rounded count is exactly 1', () => {
    // 0.6 kg CO₂ ÷ 0.6 kg per laundry load = 1.0 load
    const result = relatable('co2e', 0.6)
    const laundry = result.find((c) => c.label.includes('laundry'))
    if (laundry) {
      expect(laundry.count).toBe(1)
      expect(laundry.label).toBe('load of laundry')
    }
  })

  it('uses the plural label when the rounded count is more than 1', () => {
    const result = relatable('co2e', 60)
    const laundry = result.find((c) => c.label.includes('laundry'))
    if (laundry) {
      expect(laundry.count).toBeGreaterThan(1)
      expect(laundry.label).toBe('loads of laundry')
    }
  })

  it('cites a source on every comparison', () => {
    const result = relatable('co2e', 5_000)
    for (const c of result) {
      expect(c.source.length).toBeGreaterThan(10)
    }
  })

  it('CO₂e registry contains universal life-experience anchors', () => {
    const labels = __testing.REGISTRY.co2e.map((e) => e.label.toLowerCase())
    expect(labels.some((l) => l.includes('km'))).toBe(true)
    expect(labels.some((l) => l.includes('flight'))).toBe(true)
    expect(labels.some((l) => l.includes('laundry'))).toBe(true)
  })

  it('CO₂e registry contains no tree-based comparisons', () => {
    const joined = JSON.stringify(__testing.REGISTRY.co2e).toLowerCase()
    expect(joined).not.toMatch(/\btree\b|\bforest\b|\bsapling\b|\bsequester/)
  })

  it('CO₂e registry contains no drinks-industry production anchors', () => {
    const joined = JSON.stringify(__testing.REGISTRY.co2e).toLowerCase()
    expect(joined).not.toMatch(/beer produced|wine produced|pint of beer|pints of beer|bottle of wine|bottles of wine/)
  })
})

describe('roundForDisplay', () => {
  it('keeps small fractional values with one decimal', () => {
    expect(roundForDisplay(3.5)).toBe(3.5)
    expect(roundForDisplay(1.234)).toBe(1.2)
    expect(roundForDisplay(9.87)).toBe(9.9)
  })

  it('rounds 10–99 to an integer', () => {
    expect(roundForDisplay(47)).toBe(47)
    expect(roundForDisplay(47.6)).toBe(48)
    expect(roundForDisplay(99.4)).toBe(99)
  })

  it('rounds to two significant figures above 100', () => {
    expect(roundForDisplay(44_532)).toBe(45_000)
    expect(roundForDisplay(44_320)).toBe(44_000)
    expect(roundForDisplay(1_234)).toBe(1_200)
    expect(roundForDisplay(987)).toBe(990)
    expect(roundForDisplay(1_249_999)).toBe(1_200_000)
  })

  it('returns 0 for non-finite input', () => {
    expect(roundForDisplay(NaN)).toBe(0)
    expect(roundForDisplay(Infinity)).toBe(0)
  })
})

describe('formatCount', () => {
  it('uses UK thousand separators below a million', () => {
    expect(formatCount(1_234)).toBe('1,234')
    expect(formatCount(44_500)).toBe('44,500')
  })

  it('abbreviates millions', () => {
    expect(formatCount(1_200_000)).toBe('1.2 million')
    expect(formatCount(50_000_000)).toBe('50 million')
  })

  it('keeps a decimal on small fractional values', () => {
    expect(formatCount(3.5)).toBe('3.5')
  })

  it('handles zero and negative defensively', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(-1)).toBe('0')
  })
})
