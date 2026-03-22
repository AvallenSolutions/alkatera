import { describe, it, expect } from 'vitest'
import { extractFromDescription, hasExtractedData } from '../description-extractor'
import type { ExtractedData } from '../description-extractor'

describe('extractFromDescription', () => {
  describe('airport IATA codes', () => {
    it('extracts pair from "LHR-CDG" format', () => {
      const result = extractFromDescription('Flight LHR-CDG', null)
      expect(result.airportCodes).toEqual(['LHR', 'CDG'])
    })

    it('extracts pair from "LHR to CDG" format', () => {
      const result = extractFromDescription('Flight LHR to CDG', null)
      expect(result.airportCodes).toEqual(['LHR', 'CDG'])
    })

    it('extracts pair from "LHR/CDG" format', () => {
      const result = extractFromDescription('Flight LHR/CDG', null)
      expect(result.airportCodes).toEqual(['LHR', 'CDG'])
    })

    it('extracts from "LHR to JFK" case-insensitive', () => {
      const result = extractFromDescription('lhr TO jfk', null)
      expect(result.airportCodes).toEqual(['LHR', 'JFK'])
    })

    it('rejects non-IATA codes like "DHL-EXP"', () => {
      const result = extractFromDescription('DHL-EXP delivery', null)
      expect(result.airportCodes).toBeUndefined()
    })

    it('rejects codes not in the known set', () => {
      const result = extractFromDescription('XYZ-ABC flight', null)
      expect(result.airportCodes).toBeUndefined()
    })
  })

  describe('hotel nights', () => {
    it('extracts "3 nights"', () => {
      const result = extractFromDescription('Hotel 3 nights', null)
      expect(result.nightCount).toBe(3)
    })

    it('extracts "1 night" (singular)', () => {
      const result = extractFromDescription('Hotel 1 night stay', null)
      expect(result.nightCount).toBe(1)
    })

    it('extracts "12 nights" (multi-digit)', () => {
      const result = extractFromDescription('Extended stay 12 nights', null)
      expect(result.nightCount).toBe(12)
    })
  })

  describe('freight weights', () => {
    it('extracts "500 kg"', () => {
      const result = extractFromDescription('Shipment 500 kg', null)
      expect(result.weight).toEqual({ value: 500, unit: 'kg' })
    })

    it('extracts "500kg" (no space)', () => {
      const result = extractFromDescription('Shipment 500kg', null)
      expect(result.weight).toEqual({ value: 500, unit: 'kg' })
    })

    it('extracts "2.4 tonnes"', () => {
      const result = extractFromDescription('Freight 2.4 tonnes', null)
      expect(result.weight).toEqual({ value: 2.4, unit: 'tonnes' })
    })

    it('extracts "1.5t" (abbreviated)', () => {
      const result = extractFromDescription('Load 1.5t', null)
      expect(result.weight).toEqual({ value: 1.5, unit: 'tonnes' })
    })

    it('handles comma thousands "4,200 kg"', () => {
      const result = extractFromDescription('Cargo 4,200 kg', null)
      expect(result.weight).toEqual({ value: 4200, unit: 'kg' })
    })
  })

  describe('energy quantities (kWh)', () => {
    it('extracts "4,200 kWh"', () => {
      const result = extractFromDescription('Electricity 4,200 kWh', null)
      expect(result.quantity).toEqual({ value: 4200, unit: 'kWh' })
    })

    it('extracts "4200kWh" (no space)', () => {
      const result = extractFromDescription('Supply 4200kWh', null)
      expect(result.quantity).toEqual({ value: 4200, unit: 'kWh' })
    })

    it('extracts "4200.5 kWh" (decimal without comma)', () => {
      const result = extractFromDescription('Usage 4200.5 kWh', null)
      expect(result.quantity).toEqual({ value: 4200.5, unit: 'kWh' })
    })

    it('extracts "4,200.5 kWh" (comma thousands + decimal)', () => {
      const result = extractFromDescription('Usage 4,200.5 kWh', null)
      expect(result.quantity).toEqual({ value: 4200.5, unit: 'kWh' })
    })
  })

  describe('fuel quantities (litres)', () => {
    it('extracts "500 litres"', () => {
      const result = extractFromDescription('Diesel 500 litres', null)
      expect(result.quantity).toEqual({ value: 500, unit: 'litres' })
    })

    it('extracts "500L"', () => {
      const result = extractFromDescription('Fuel 500L', null)
      expect(result.quantity).toEqual({ value: 500, unit: 'litres' })
    })

    it('extracts "1,200 liters" (American spelling)', () => {
      const result = extractFromDescription('Petrol 1,200 liters', null)
      expect(result.quantity).toEqual({ value: 1200, unit: 'litres' })
    })

    it('kWh takes precedence over litres when both present', () => {
      const result = extractFromDescription('4200kWh of electricity, 500 litres', null)
      expect(result.quantity!.unit).toBe('kWh')
    })
  })

  describe('water volumes', () => {
    it('extracts "120 m3"', () => {
      const result = extractFromDescription('Water usage 120 m3', null)
      expect(result.waterVolume).toEqual({ value: 120, unit: 'm3' })
    })

    it('extracts "120 m3" (numeric 3)', () => {
      const result = extractFromDescription('Water supply 120 m3 used', null)
      expect(result.waterVolume).toEqual({ value: 120, unit: 'm3' })
    })

    it('extracts "120 m\u00b3" (unicode superscript)', () => {
      const result = extractFromDescription('Water 120 m\u00b3', null)
      expect(result.waterVolume).toEqual({ value: 120, unit: 'm3' })
    })

    it('extracts "120 cubic metres"', () => {
      const result = extractFromDescription('Water supply 120 cubic metres', null)
      expect(result.waterVolume).toEqual({ value: 120, unit: 'm3' })
    })
  })

  describe('edge cases', () => {
    it('returns empty object for null description', () => {
      const result = extractFromDescription(null, null)
      expect(result).toEqual({})
    })

    it('returns empty object for empty string', () => {
      const result = extractFromDescription('', null)
      expect(result).toEqual({})
    })

    it('combines description and contactName for matching', () => {
      // Airport code in description, night count in contact name
      const result = extractFromDescription('LHR-CDG', '3 nights at hotel')
      expect(result.airportCodes).toEqual(['LHR', 'CDG'])
      expect(result.nightCount).toBe(3)
    })

    it('returns empty object for description with no patterns', () => {
      const result = extractFromDescription('General office supplies', 'Staples UK')
      expect(hasExtractedData(result)).toBe(false)
    })
  })
})

describe('hasExtractedData', () => {
  it('returns true when airportCodes is present', () => {
    expect(hasExtractedData({ airportCodes: ['LHR', 'CDG'] })).toBe(true)
  })

  it('returns true when nightCount is present', () => {
    expect(hasExtractedData({ nightCount: 3 })).toBe(true)
  })

  it('returns true when weight is present', () => {
    expect(hasExtractedData({ weight: { value: 500, unit: 'kg' } })).toBe(true)
  })

  it('returns true when quantity is present', () => {
    expect(hasExtractedData({ quantity: { value: 4200, unit: 'kWh' } })).toBe(true)
  })

  it('returns true when waterVolume is present', () => {
    expect(hasExtractedData({ waterVolume: { value: 120, unit: 'm3' } })).toBe(true)
  })

  it('returns false for empty ExtractedData object', () => {
    expect(hasExtractedData({})).toBe(false)
  })
})
