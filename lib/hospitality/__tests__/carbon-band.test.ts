import { describe, it, expect } from 'vitest'
import { carbonBand, bandLegend, formatFootprint, BAND_THRESHOLDS } from '@/lib/hospitality/carbon-band'

describe('carbonBand', () => {
  it('bands at the low/medium boundaries (inclusive of the upper bound)', () => {
    expect(carbonBand(0.5)!.band).toBe('low')
    expect(carbonBand(BAND_THRESHOLDS.low)!.band).toBe('low') // 1.0 → low
    expect(carbonBand(1.01)!.band).toBe('medium')
    expect(carbonBand(BAND_THRESHOLDS.medium)!.band).toBe('medium') // 3.0 → medium
    expect(carbonBand(3.01)!.band).toBe('high')
    expect(carbonBand(5)!.band).toBe('high')
  })

  it('returns null for missing or non-finite input', () => {
    expect(carbonBand(null)).toBeNull()
    expect(carbonBand(undefined)).toBeNull()
    expect(carbonBand(Number.NaN)).toBeNull()
  })

  it('honours org-configured thresholds', () => {
    const custom = { low: 0.4, medium: 2 }
    expect(carbonBand(0.4, custom)!.band).toBe('low')
    expect(carbonBand(0.5, custom)!.band).toBe('medium') // above default-low 1.0, but the custom low is 0.4
    expect(carbonBand(2.5, custom)!.band).toBe('high')
  })
})

describe('parseBandThresholds', () => {
  it('accepts a valid override and rejects malformed ones', async () => {
    const { parseBandThresholds, BAND_THRESHOLDS } = await import('@/lib/hospitality/carbon-band')
    expect(parseBandThresholds({ low: 0.5, medium: 2 })).toEqual({ low: 0.5, medium: 2 })
    expect(parseBandThresholds({ low: 3, medium: 1 })).toEqual(BAND_THRESHOLDS) // medium must exceed low
    expect(parseBandThresholds({ low: 0 })).toEqual(BAND_THRESHOLDS)
    expect(parseBandThresholds(null)).toEqual(BAND_THRESHOLDS)
    expect(parseBandThresholds('nope')).toEqual(BAND_THRESHOLDS)
  })
})

describe('bandLegend', () => {
  it('derives legend rows and upper bounds from the thresholds', () => {
    const legend = bandLegend()
    expect(legend.map((e) => e.band)).toEqual(['low', 'medium', 'high'])
    expect(legend[0].max).toBe(BAND_THRESHOLDS.low)
    expect(legend[1].max).toBe(BAND_THRESHOLDS.medium)
    expect(legend[2].max).toBeNull()
  })

  it('honours custom thresholds so the legend can never drift from the bands', () => {
    const legend = bandLegend({ low: 0.4, medium: 2 })
    expect(legend[0].max).toBe(0.4)
    expect(legend[1].max).toBe(2)
  })
})

describe('formatFootprint', () => {
  it('shows grams below 1 kg and kilograms at or above 1 kg', () => {
    expect(formatFootprint(0.42)).toBe('420 g CO₂e')
    expect(formatFootprint(2.5)).toContain('kg CO₂e')
    expect(formatFootprint(null)).toBe('—')
  })
})
