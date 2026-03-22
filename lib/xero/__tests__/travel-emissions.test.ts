import { describe, it, expect } from 'vitest'

// Mock the browser client import (not used by pure functions but imported at top level)
vi.mock('@/lib/supabase/browser-client', () => ({
  getSupabaseBrowserClient: vi.fn(),
}))

import { vi } from 'vitest'
import {
  detectTravelClass,
  calculateFlightCO2e,
  calculateRailCO2e,
  calculateHotelCO2e,
  getHotelFactor,
  findFlightFactor,
  findRailFactor,
  HOTEL_EMISSION_FACTORS,
} from '../travel-emissions'
import type { EmissionFactor, TravelClass, CabinClass, CountryRegion, HotelType } from '../travel-emissions'

// Helper to create a mock EmissionFactor
function mockFactor(value: number, travelClass: string, cabinClass?: string): EmissionFactor {
  return {
    factor_id: 'ef-001',
    name: `${travelClass} ${cabinClass || ''}`.trim(),
    value,
    unit: 'kg CO2e per passenger.km',
    travel_class: travelClass,
    cabin_class: cabinClass,
  }
}

describe('detectTravelClass', () => {
  it('returns "Domestic" for distance < 500 km', () => {
    expect(detectTravelClass(300)).toBe('Domestic')
  })

  it('returns "Short-haul" for distance 500-3700 km', () => {
    expect(detectTravelClass(1500)).toBe('Short-haul')
  })

  it('returns "Long-haul" for distance > 3700 km', () => {
    expect(detectTravelClass(5000)).toBe('Long-haul')
  })

  it('boundary: 499 km = Domestic', () => {
    expect(detectTravelClass(499)).toBe('Domestic')
  })

  it('boundary: 500 km = Short-haul', () => {
    expect(detectTravelClass(500)).toBe('Short-haul')
  })

  it('boundary: 3700 km = Short-haul', () => {
    expect(detectTravelClass(3700)).toBe('Short-haul')
  })

  it('boundary: 3701 km = Long-haul', () => {
    expect(detectTravelClass(3701)).toBe('Long-haul')
  })
})

describe('calculateFlightCO2e', () => {
  const factor = mockFactor(0.15, 'Short-haul', 'Economy')

  it('calculates one-way: factor * distance * passengers', () => {
    const result = calculateFlightCO2e(factor, 1000, 1, false)
    expect(result).toBeCloseTo(150, 2) // 0.15 * 1000 * 1
  })

  it('return trip doubles distance', () => {
    const result = calculateFlightCO2e(factor, 1000, 1, true)
    expect(result).toBeCloseTo(300, 2) // 0.15 * 2000 * 1
  })

  it('multiple passengers multiplies correctly', () => {
    const result = calculateFlightCO2e(factor, 1000, 3, false)
    expect(result).toBeCloseTo(450, 2) // 0.15 * 1000 * 3
  })

  it('zero distance returns 0', () => {
    const result = calculateFlightCO2e(factor, 0, 1, false)
    expect(result).toBe(0)
  })
})

describe('calculateRailCO2e', () => {
  const factor = mockFactor(0.04, 'National')

  it('calculates one-way: factor * distance * passengers', () => {
    const result = calculateRailCO2e(factor, 500, 1, false)
    expect(result).toBeCloseTo(20, 2) // 0.04 * 500 * 1
  })

  it('return trip doubles distance', () => {
    const result = calculateRailCO2e(factor, 500, 1, true)
    expect(result).toBeCloseTo(40, 2) // 0.04 * 1000 * 1
  })
})

describe('findFlightFactor', () => {
  const factors: EmissionFactor[] = [
    mockFactor(0.255, 'Domestic', 'Economy'),
    mockFactor(0.15, 'Short-haul', 'Economy'),
    mockFactor(0.22, 'Short-haul', 'Business'),
    mockFactor(0.10, 'Long-haul', 'Economy'),
    mockFactor(0.30, 'Long-haul', 'Business'),
    mockFactor(0.43, 'Long-haul', 'First'),
  ]

  it('finds matching factor by travelClass and cabinClass', () => {
    const result = findFlightFactor(factors, 'Short-haul', 'Economy')
    expect(result).toBeDefined()
    expect(result!.value).toBe(0.15)
  })

  it('finds Long-haul First class factor', () => {
    const result = findFlightFactor(factors, 'Long-haul', 'First')
    expect(result).toBeDefined()
    expect(result!.value).toBe(0.43)
  })

  it('returns undefined when no match', () => {
    const result = findFlightFactor(factors, 'Domestic', 'First')
    expect(result).toBeUndefined()
  })
})

describe('findRailFactor', () => {
  const factors: EmissionFactor[] = [
    mockFactor(0.04, 'National'),
    mockFactor(0.005, 'International'),
  ]

  it('finds matching factor by travelClass', () => {
    const result = findRailFactor(factors, 'National')
    expect(result).toBeDefined()
    expect(result!.value).toBe(0.04)
  })

  it('defaults to "National" when no travelClass provided', () => {
    const result = findRailFactor(factors)
    expect(result).toBeDefined()
    expect(result!.value).toBe(0.04)
  })
})

describe('calculateHotelCO2e', () => {
  it('calculates UK budget: nights * factor', () => {
    const result = calculateHotelCO2e(3, 'uk', 'budget')
    expect(result).toBeCloseTo(3 * 14.2, 2)
  })

  it('calculates Europe mid-range', () => {
    const result = calculateHotelCO2e(2, 'europe', 'mid_range')
    expect(result).toBeCloseTo(2 * 24.0, 2)
  })

  it('calculates North America luxury', () => {
    const result = calculateHotelCO2e(1, 'north_america', 'luxury')
    expect(result).toBeCloseTo(51.2, 2)
  })

  it('defaults to average when no hotelType specified', () => {
    const result = calculateHotelCO2e(1, 'uk')
    expect(result).toBeCloseTo(20.3, 2)
  })

  it('falls back to UK average for invalid region/type', () => {
    const result = calculateHotelCO2e(1, 'invalid' as CountryRegion, 'budget')
    expect(result).toBeCloseTo(HOTEL_EMISSION_FACTORS.uk.average, 2)
  })

  it('zero nights returns 0', () => {
    const result = calculateHotelCO2e(0, 'uk', 'budget')
    expect(result).toBe(0)
  })
})

describe('getHotelFactor', () => {
  it('returns correct factor for known region/type', () => {
    expect(getHotelFactor('uk', 'budget')).toBe(14.2)
    expect(getHotelFactor('europe', 'luxury')).toBe(38.4)
  })

  it('defaults to average when no type specified', () => {
    expect(getHotelFactor('uk')).toBe(20.3)
  })

  it('falls back to UK average for unknown combination', () => {
    expect(getHotelFactor('invalid' as CountryRegion, 'budget')).toBe(20.3)
  })
})
