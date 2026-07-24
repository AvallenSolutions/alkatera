import { describe, it, expect } from 'vitest';
import {
  WORKS_WITH_MODULES,
  MODULE_FEATURE,
  MODULE_HREF,
  MODULE_LABEL,
  isWorksWithModule,
  parseWorksWith,
  tierOpensModules,
} from '../works-with';
import { FEATURE_MIN_TIER, BETA_FEATURES, isBetaFeature } from '../feature-catalog';

describe('parseWorksWith', () => {
  it('reads a clean array', () => {
    expect(parseWorksWith(['viticulture', 'hospitality'])).toEqual([
      'viticulture',
      'hospitality',
    ]);
  });

  it('returns the canonical order, not the order given', () => {
    expect(parseWorksWith(['hospitality', 'viticulture'])).toEqual([
      'viticulture',
      'hospitality',
    ]);
  });

  it('de-duplicates', () => {
    expect(parseWorksWith(['orchards', 'orchards'])).toEqual(['orchards']);
  });

  it('parses a JSON string, because jsonb can arrive either way', () => {
    expect(parseWorksWith('["arable_fields"]')).toEqual(['arable_fields']);
  });

  it('never throws on junk — a bad row must not break a render', () => {
    for (const junk of [
      null,
      undefined,
      '',
      'not json',
      '{}',
      42,
      {},
      { viticulture: true },
      ['nope', 5, null, { a: 1 }],
      [['viticulture']],
    ]) {
      expect(parseWorksWith(junk)).toEqual([]);
    }
  });

  it('keeps the known keys and drops the unknown ones from a mixed array', () => {
    expect(parseWorksWith(['viticulture', 'nope', 7, 'hospitality'])).toEqual([
      'viticulture',
      'hospitality',
    ]);
  });
});

describe('isWorksWithModule', () => {
  it('accepts every module and rejects everything else', () => {
    for (const m of WORKS_WITH_MODULES) expect(isWorksWithModule(m)).toBe(true);
    // The retired beta codes must not sneak back in as module keys.
    for (const other of ['viticulture_beta', 'hospitality_beta', '', null, 1, {}]) {
      expect(isWorksWithModule(other)).toBe(false);
    }
  });
});

describe('tierOpensModules', () => {
  it('opens on canopy only', () => {
    expect(tierOpensModules('canopy')).toBe(true);
    for (const tier of ['seed', 'blossom', '', null, undefined, 'CANOPY']) {
      expect(tierOpensModules(tier)).toBe(false);
    }
  });
});

describe('the module registry lines up with the feature catalog', () => {
  it('every module is a canopy feature, and none of them is a beta', () => {
    for (const m of WORKS_WITH_MODULES) {
      expect(FEATURE_MIN_TIER[MODULE_FEATURE[m]]).toBe('canopy');
      expect(isBetaFeature(MODULE_FEATURE[m])).toBe(false);
      expect(BETA_FEATURES).not.toContain(MODULE_FEATURE[m]);
    }
  });

  it('every module has a label and a destination', () => {
    for (const m of WORKS_WITH_MODULES) {
      expect(MODULE_LABEL[m]).toBeTruthy();
      expect(MODULE_HREF[m]).toMatch(/^\/[a-z-]+\/$/);
    }
  });
});
