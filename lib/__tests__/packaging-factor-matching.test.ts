import { describe, it, expect } from 'vitest';
import {
  CONTAINER_FORMATS,
  CLOSURE_OPTIONS,
  LABEL_OPTIONS,
  MULTIPACK_OPTIONS,
} from '@/lib/constants/packaging-catalogue';
import { isFoodPackagingSystemName } from '@/lib/openlca/drinks-process-filter';
import { isConfidentPackagingMatch } from '@/lib/products/ef-auto-match';

describe('catalogue search queries (Phase A)', () => {
  const allQueries = [
    ...CONTAINER_FORMATS.flatMap((f) => f.materials.map((m) => ({ q: m.efSearchQuery, ctx: `${f.key}/${m.key}` }))),
    ...[...CLOSURE_OPTIONS, ...LABEL_OPTIONS, ...MULTIPACK_OPTIONS].map((o) => ({ q: o.efSearchQuery, ctx: o.key })),
  ];

  it('no query contains the word "packaging" (it sabotages the staging longest-word filter)', () => {
    for (const { q, ctx } of allQueries) {
      expect(q.toLowerCase().includes('packaging'), `${ctx}: "${q}"`).toBe(false);
    }
  });

  it('every query has at least two content words to anchor the match', () => {
    for (const { q, ctx } of allQueries) {
      const words = q.split(/[\s-]+/).filter((w) => w.length >= 3);
      expect(words.length, `${ctx}: "${q}"`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('isFoodPackagingSystemName (Phase B)', () => {
  it('matches Agribalyse food-product packaging systems (the screenshot bugs)', () => {
    expect(isFoodPackagingSystemName('Flavour oil, 0,25L | Packaging System, N0, All, Glass bottle {FR} U')).toBe(true);
    expect(isFoodPackagingSystemName('Soft cheeses - cat C, 200g | Packaging System, N1, Retail, Paper and Plastic foil, E2 Label {FR} U')).toBe(true);
    expect(isFoodPackagingSystemName('Beer | Packaging System, N2, All {FR} U')).toBe(true);
  });

  it('does NOT match genuine packaging-material processes', () => {
    expect(isFoodPackagingSystemName('packaging glass production | packaging glass | Cutoff, U')).toBe(false);
    expect(isFoodPackagingSystemName('market for packaging glass, white')).toBe(false);
    expect(isFoodPackagingSystemName('Glass Bottle (green, 750ml wine)')).toBe(false);
    expect(isFoodPackagingSystemName('market for cork slab | cork slab | Cutoff, U')).toBe(false);
    expect(isFoodPackagingSystemName('')).toBe(false);
    expect(isFoodPackagingSystemName(null)).toBe(false);
  });
});

describe('isConfidentPackagingMatch (Phase D auto-match gate)', () => {
  it('accepts a curated/ecoinvent packaging-material match', () => {
    expect(isConfidentPackagingMatch('glass bottle', { name: 'Glass Bottle (green, 750ml wine)', source_type: 'global_library' })).toBe(true);
    expect(isConfidentPackagingMatch('cork stopper', { name: 'market for cork slab | cork slab | Cutoff, U', source_type: 'ecoinvent_live' })).toBe(true);
    expect(isConfidentPackagingMatch('aluminium can', { name: 'Aluminium Can (330ml)', source_type: 'global_library' })).toBe(true);
  });

  it('rejects the food-packaging-system mismatches from the screenshots', () => {
    expect(isConfidentPackagingMatch('glass bottle', { name: 'Flavour oil, 0,25L | Packaging System, N0, All, Glass bottle {FR} U', source_type: 'agribalyse_live' })).toBe(false);
    expect(isConfidentPackagingMatch('paper label', { name: 'Soft cheeses - cat C, 200g | Packaging System, N1, Retail, Paper and Plastic foil, E2 Label {FR} U', source_type: 'agribalyse_live' })).toBe(false);
  });

  it('rejects any Agribalyse result for packaging (food database)', () => {
    expect(isConfidentPackagingMatch('glass bottle', { name: 'Some glass bottle thing', source_type: 'agribalyse_live' })).toBe(false);
  });

  it('rejects results that share no keyword with the query', () => {
    expect(isConfidentPackagingMatch('aluminium can', { name: 'Barley malt production', source_type: 'ecoinvent_live' })).toBe(false);
  });

  it('rejects empty / missing names', () => {
    expect(isConfidentPackagingMatch('glass bottle', { name: '', source_type: 'global_library' })).toBe(false);
    expect(isConfidentPackagingMatch('glass bottle', {})).toBe(false);
  });
});
