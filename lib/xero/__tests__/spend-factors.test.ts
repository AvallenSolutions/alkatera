import { describe, it, expect } from 'vitest'
import {
  SPEND_EMISSION_FACTORS,
  getSpendFactor,
  getUncertainty,
  calculateSpendBasedEmissions,
} from '../spend-factors'

describe('SPEND_EMISSION_FACTORS', () => {
  const expectedCategories = [
    'grid_electricity', 'natural_gas', 'diesel_stationary', 'diesel_mobile',
    'petrol_mobile', 'lpg', 'air_travel', 'rail_travel', 'accommodation',
    'road_freight', 'sea_freight', 'air_freight', 'courier', 'packaging',
    'raw_materials', 'water', 'waste', 'other',
  ]

  it('contains all expected categories', () => {
    for (const cat of expectedCategories) {
      expect(SPEND_EMISSION_FACTORS[cat]).toBeDefined()
    }
  })

  it('each entry has factor, source, and uncertainty properties', () => {
    for (const [key, entry] of Object.entries(SPEND_EMISSION_FACTORS)) {
      expect(entry).toHaveProperty('factor')
      expect(entry).toHaveProperty('source')
      expect(entry).toHaveProperty('uncertainty')
      expect(typeof entry.factor).toBe('number')
      expect(typeof entry.source).toBe('string')
      expect(typeof entry.uncertainty).toBe('number')
    }
  })

  it('all factors are positive numbers', () => {
    for (const entry of Object.values(SPEND_EMISSION_FACTORS)) {
      expect(entry.factor).toBeGreaterThan(0)
    }
  })

  it('all uncertainties are between 0 and 1', () => {
    for (const entry of Object.values(SPEND_EMISSION_FACTORS)) {
      expect(entry.uncertainty).toBeGreaterThanOrEqual(0)
      expect(entry.uncertainty).toBeLessThanOrEqual(1)
    }
  })
})

describe('getSpendFactor', () => {
  it('returns correct factor for grid_electricity', () => {
    expect(getSpendFactor('grid_electricity')).toBe(0.49)
  })

  it('returns correct factor for air_travel', () => {
    expect(getSpendFactor('air_travel')).toBe(1.36)
  })

  it('returns correct factor for rail_travel', () => {
    expect(getSpendFactor('rail_travel')).toBe(0.28)
  })

  it('returns fallback factor (0.33) for unknown category', () => {
    expect(getSpendFactor('unknown_category')).toBe(0.33)
  })

  it('returns fallback factor for empty string', () => {
    expect(getSpendFactor('')).toBe(0.33)
  })
})

describe('getUncertainty', () => {
  it('returns correct uncertainty for known category', () => {
    expect(getUncertainty('grid_electricity')).toBe(0.6)
  })

  it('returns correct uncertainty for air_travel', () => {
    expect(getUncertainty('air_travel')).toBe(0.9)
  })

  it('returns 0.5 for unknown category', () => {
    expect(getUncertainty('unknown_category')).toBe(0.5)
  })
})

describe('calculateSpendBasedEmissions', () => {
  it('returns amount * factor for known category', () => {
    // grid_electricity: factor = 0.49
    expect(calculateSpendBasedEmissions(100, 'grid_electricity')).toBeCloseTo(49, 2)
  })

  it('uses absolute value of negative amounts (credits)', () => {
    expect(calculateSpendBasedEmissions(-100, 'grid_electricity')).toBeCloseTo(49, 2)
  })

  it('returns 0 for zero amount', () => {
    expect(calculateSpendBasedEmissions(0, 'grid_electricity')).toBe(0)
  })

  it('uses fallback factor for unknown category', () => {
    // other: factor = 0.33
    expect(calculateSpendBasedEmissions(100, 'made_up_category')).toBeCloseTo(33, 2)
  })
})
