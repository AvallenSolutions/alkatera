import { describe, it, expect } from 'vitest'
import { outcodeFromPostcode } from '../region'

describe('outcodeFromPostcode', () => {
  it('extracts the outward code from a spaced postcode', () => {
    expect(outcodeFromPostcode('SW1A 1AA')).toBe('SW1A')
    expect(outcodeFromPostcode('EH1 1BB')).toBe('EH1')
    expect(outcodeFromPostcode('CF10 1EP')).toBe('CF10')
    expect(outcodeFromPostcode('M1 1AE')).toBe('M1')
  })
  it('handles postcodes with no space', () => {
    expect(outcodeFromPostcode('SW1A1AA')).toBe('SW1A')
    expect(outcodeFromPostcode('M11AE')).toBe('M1')
  })
  it('is case- and whitespace-insensitive', () => {
    expect(outcodeFromPostcode('  sw1a 1aa ')).toBe('SW1A')
  })
  it('returns null for empty or non-UK-looking input', () => {
    expect(outcodeFromPostcode('')).toBeNull()
    expect(outcodeFromPostcode(null)).toBeNull()
    expect(outcodeFromPostcode(undefined)).toBeNull()
    expect(outcodeFromPostcode('12345')).toBeNull() // US zip
    expect(outcodeFromPostcode('hello world')).toBeNull()
  })
})
