import { describe, it, expect } from 'vitest';
import { eolRegionForCountry, REGION_LABELS } from '../end-of-life-factors';

/**
 * The end-of-life region used to be hardcoded to 'eu' for every product on the
 * platform, so a UK distillery was given EU recycling rates unless somebody
 * noticed the select and changed it. This maps the organisation's own country
 * onto the three regional profiles the factor tables actually carry.
 *
 * 'eu' is both a real answer and the fallback, so these assert the specific
 * countries that must NOT fall through to it.
 */
describe('eolRegionForCountry', () => {
  it('sends the UK to its own profile', () => {
    expect(eolRegionForCountry('GB')).toBe('uk');
    // Some rows carry the colloquial code rather than the ISO one.
    expect(eolRegionForCountry('UK')).toBe('uk');
  });

  it('sends the US to its own profile', () => {
    expect(eolRegionForCountry('US')).toBe('us');
  });

  it('is case and whitespace insensitive', () => {
    expect(eolRegionForCountry('gb')).toBe('uk');
    expect(eolRegionForCountry('  us  ')).toBe('us');
  });

  it('maps EU and EEA members to the EU profile', () => {
    for (const code of ['FR', 'DE', 'IE', 'ES', 'PL', 'NO', 'IS', 'CH']) {
      expect(eolRegionForCountry(code)).toBe('eu');
    }
  });

  it('falls back to the EU profile for anything unrecognised', () => {
    // Unchanged behaviour for the cases the old hardcoded default covered.
    expect(eolRegionForCountry(null)).toBe('eu');
    expect(eolRegionForCountry(undefined)).toBe('eu');
    expect(eolRegionForCountry('')).toBe('eu');
    expect(eolRegionForCountry('AU')).toBe('eu');
    expect(eolRegionForCountry('JP')).toBe('eu');
    // Older organisation rows hold a full country name, not a code.
    expect(eolRegionForCountry('United Kingdom')).toBe('eu');
  });

  it('only ever returns a region the factor tables know', () => {
    for (const code of ['GB', 'US', 'FR', 'AU', null]) {
      expect(REGION_LABELS[eolRegionForCountry(code)]).toBeDefined();
    }
  });
});
