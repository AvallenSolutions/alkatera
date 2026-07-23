import { describe, expect, it } from 'vitest';
import { hemisphereForCountry, seasonForDate } from '../season';

describe('seasonForDate', () => {
  it('maps the northern year: Mar-May spring, Jun-Aug summer, Sep-Nov autumn, Dec-Feb winter', () => {
    expect(seasonForDate(new Date('2026-03-15'))).toBe('spring');
    expect(seasonForDate(new Date('2026-05-31'))).toBe('spring');
    expect(seasonForDate(new Date('2026-07-12'))).toBe('summer');
    expect(seasonForDate(new Date('2026-09-01'))).toBe('autumn');
    expect(seasonForDate(new Date('2026-11-30'))).toBe('autumn');
    expect(seasonForDate(new Date('2026-12-25'))).toBe('winter');
    expect(seasonForDate(new Date('2026-02-10'))).toBe('winter');
  });

  it('flips the year in the south: December is summer, July is winter', () => {
    expect(seasonForDate(new Date('2026-12-25'), 'south')).toBe('summer');
    expect(seasonForDate(new Date('2026-07-12'), 'south')).toBe('winter');
    expect(seasonForDate(new Date('2026-04-10'), 'south')).toBe('autumn');
    expect(seasonForDate(new Date('2026-10-10'), 'south')).toBe('spring');
  });
});

describe('hemisphereForCountry', () => {
  it('defaults north for missing, blank or northern countries', () => {
    expect(hemisphereForCountry(null)).toBe('north');
    expect(hemisphereForCountry(undefined)).toBe('north');
    expect(hemisphereForCountry('  ')).toBe('north');
    expect(hemisphereForCountry('United Kingdom')).toBe('north');
    expect(hemisphereForCountry('France')).toBe('north');
    expect(hemisphereForCountry('United States')).toBe('north');
  });

  it('recognises southern countries however they are written', () => {
    expect(hemisphereForCountry('Australia')).toBe('south');
    expect(hemisphereForCountry('AUSTRALIA')).toBe('south');
    expect(hemisphereForCountry('New Zealand')).toBe('south');
    expect(hemisphereForCountry('South Africa')).toBe('south');
    expect(hemisphereForCountry('Republic of South Africa')).toBe('south');
    expect(hemisphereForCountry('Chile')).toBe('south');
    expect(hemisphereForCountry('Argentina')).toBe('south');
  });

  it('accepts short codes', () => {
    expect(hemisphereForCountry('AU')).toBe('south');
    expect(hemisphereForCountry('nz')).toBe('south');
    expect(hemisphereForCountry('GB')).toBe('north');
  });

  it('does not trip on northern names containing directions', () => {
    expect(hemisphereForCountry('South Korea')).toBe('north');
    expect(hemisphereForCountry('Southampton, UK')).toBe('north');
  });
});
