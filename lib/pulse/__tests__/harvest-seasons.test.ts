/**
 * Tests for the harvest-season crop matcher. Keeps the curated alias list
 * honest -- a typo in the registry will surface here before the widget
 * silently shows the wrong crops.
 */

import { describe, expect, it } from 'vitest';
import { flipHemisphere, HARVEST_SEASONS, relevantCrops } from '../harvest-seasons';

describe('relevantCrops', () => {
  it('returns nothing when corpus is empty', () => {
    expect(relevantCrops([])).toEqual([]);
    expect(relevantCrops(['', '   '])).toEqual([]);
  });

  it('matches grape from a wine product name', () => {
    const r = relevantCrops(['Reserva Cabernet Sauvignon 2022']);
    expect(r.map(c => c.key)).toContain('grape');
  });

  it('matches multiple distinct crops', () => {
    const r = relevantCrops([
      'Single malt whisky 12yr',
      'Bottling line hops dry-extract',
      'Premium gin Mediterranean botanicals',
    ]);
    const keys = r.map(c => c.key);
    expect(keys).toEqual(expect.arrayContaining(['barley', 'hops', 'juniper']));
  });

  it('is case-insensitive', () => {
    const r = relevantCrops(['BOURBON cask 53gal']);
    expect(r.map(c => c.key)).toContain('corn');
  });

  it('honours the limit', () => {
    const r = relevantCrops(
      ['gin', 'whisky', 'rum', 'tequila', 'wine', 'cider', 'beer'],
      3,
    );
    expect(r).toHaveLength(3);
  });
});

describe('flipHemisphere', () => {
  it('shifts January to July', () => {
    expect(flipHemisphere(1)).toBe(7);
  });
  it('shifts September to March', () => {
    expect(flipHemisphere(9)).toBe(3);
  });
  it('round-trips', () => {
    for (let m = 1; m <= 12; m += 1) {
      expect(flipHemisphere(flipHemisphere(m))).toBe(m);
    }
  });
});

describe('HARVEST_SEASONS registry', () => {
  it('every crop has at least one alias', () => {
    for (const c of HARVEST_SEASONS) {
      expect(c.aliases.length).toBeGreaterThan(0);
    }
  });
  it('peakMonths is a subset of windowMonths', () => {
    for (const c of HARVEST_SEASONS) {
      for (const p of c.peakMonths) {
        expect(c.windowMonths).toContain(p);
      }
    }
  });
});
