import { describe, it, expect } from 'vitest';
import { cleanFactorDisplayName } from '../factor-display-name';

describe('cleanFactorDisplayName', () => {
  it('strips "Copied from Ecoinvent U" suffix', () => {
    expect(
      cleanFactorDisplayName(
        'Barley grain {GLO}| market for | Cut-off, S - Copied from Ecoinvent U',
      ),
    ).toBe('Barley grain {GLO}| market for | Cut-off, S');
  });

  it('strips "Adapted from Ecoinvent U" suffix', () => {
    expect(
      cleanFactorDisplayName(
        'Barley grain {FR}| barley production | Cut-off, U - Adapted from Ecoinvent U',
      ),
    ).toBe('Barley grain {FR}| barley production | Cut-off, U');
  });

  it('strips "Adapted from WFLDB" suffix', () => {
    expect(
      cleanFactorDisplayName('Barley grain, non-irrigated, at farm {DE} - Adapted from WFLDB'),
    ).toBe('Barley grain, non-irrigated, at farm {DE}');
  });

  it('strips "Copied from Ecoinvent S" suffix', () => {
    expect(
      cleanFactorDisplayName('Hops production {RER} - Copied from Ecoinvent S'),
    ).toBe('Hops production {RER}');
  });

  it('handles trailing dot', () => {
    expect(
      cleanFactorDisplayName('Wheat grain {FR} - Adapted from Ecoinvent.'),
    ).toBe('Wheat grain {FR}');
  });

  it('leaves names without provenance suffix unchanged', () => {
    expect(cleanFactorDisplayName('Hops, T-90 pellets')).toBe('Hops, T-90 pellets');
    expect(cleanFactorDisplayName('Malted Barley')).toBe('Malted Barley');
  });

  it('is idempotent', () => {
    const dirty = 'Barley grain {GLO}| market for | Cut-off, S - Copied from Ecoinvent U';
    expect(cleanFactorDisplayName(cleanFactorDisplayName(dirty))).toBe(
      cleanFactorDisplayName(dirty),
    );
  });

  it('handles null and undefined safely', () => {
    expect(cleanFactorDisplayName(null)).toBe('');
    expect(cleanFactorDisplayName(undefined)).toBe('');
    expect(cleanFactorDisplayName('')).toBe('');
  });

  it('does not strip "Cut-off, U" mid-string (only trailing provenance)', () => {
    // The "U" at the end of "Cut-off, U" must survive when there's no provenance after it
    expect(cleanFactorDisplayName('Barley {FR} | Cut-off, U')).toBe('Barley {FR} | Cut-off, U');
  });
});
