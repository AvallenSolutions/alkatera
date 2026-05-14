import { describe, it, expect } from 'vitest';
import { extractDomain } from '@/lib/distributor/integration/brand-matcher';

describe('extractDomain', () => {
  it('extracts the eTLD+1 from a full URL', () => {
    expect(extractDomain('https://www.libertywines.co.uk/')).toBe('libertywines.co.uk');
    expect(extractDomain('https://avallenspirits.com/about')).toBe('avallenspirits.com');
  });

  it('strips a www prefix', () => {
    expect(extractDomain('https://www.libertywines.co.uk')).toBe('libertywines.co.uk');
  });

  it('handles missing protocol', () => {
    expect(extractDomain('libertywines.co.uk')).toBe('libertywines.co.uk');
    expect(extractDomain('www.libertywines.co.uk')).toBe('libertywines.co.uk');
  });

  it('lowercases the result', () => {
    expect(extractDomain('https://LibertyWines.CO.UK/')).toBe('libertywines.co.uk');
  });

  it('returns null on garbage input', () => {
    expect(extractDomain('not a url at all')).toBe(null);
  });
});
