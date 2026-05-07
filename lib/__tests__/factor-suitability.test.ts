import { describe, it, expect } from 'vitest';
import { getMatchSuitability } from '../factor-suitability';
import type { SearchResult } from '@/components/lca/InlineIngredientSearch';

const baseResult = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  id: 'test',
  name: 'Test factor',
  category: 'ingredient',
  ...overrides,
});

describe('getMatchSuitability — whatItCovers', () => {
  it('uses translated boundary for cradle-to-gate', () => {
    const r = baseResult({
      source_type: 'ecoinvent_live',
      metadata: { system_boundary: 'cradle-to-gate' },
    });
    const out = getMatchSuitability(r);
    expect(out.whatItCovers).toContain('Cradle-to-Gate');
  });

  it('mentions verified supplier data for primary source', () => {
    const r = baseResult({ source_type: 'primary' });
    const out = getMatchSuitability(r);
    expect(out.whatItCovers.toLowerCase()).toContain('verified');
  });

  it('appends drinks_relevance when present', () => {
    const r = baseResult({
      source_type: 'global_library',
      metadata: { drinks_relevance: 'Beer, IPA, pale ale' },
    });
    const out = getMatchSuitability(r);
    expect(out.whatItCovers).toContain('Beer');
  });
});

describe('getMatchSuitability — goodMatchIf / lookElsewhereIf', () => {
  it('flags global average appropriately', () => {
    const r = baseResult({
      source_type: 'ecoinvent_live',
      location: '{GLO}',
      metadata: { geographic_scope: 'GLO' },
    });
    const out = getMatchSuitability(r);
    expect(out.goodMatchIf.some((b) => /no regional/i.test(b))).toBe(true);
    expect(out.lookElsewhereIf.some((b) => /regional/i.test(b))).toBe(true);
  });

  it('flags organic vs conventional from name', () => {
    const organic = baseResult({ name: 'Organic barley grain {FR}' });
    const out1 = getMatchSuitability(organic);
    expect(out1.goodMatchIf.some((b) => /organic/i.test(b))).toBe(true);
    expect(out1.lookElsewhereIf.some((b) => /conventional/i.test(b))).toBe(true);

    const conventional = baseResult({ name: 'Barley grain, conventional, at farm' });
    const out2 = getMatchSuitability(conventional);
    expect(out2.goodMatchIf.some((b) => /conventional/i.test(b))).toBe(true);
    expect(out2.lookElsewhereIf.some((b) => /organic/i.test(b))).toBe(true);
  });

  it('flags primary supplier match conditions', () => {
    const r = baseResult({ source_type: 'primary', supplier_name: 'Acme Hops' });
    const out = getMatchSuitability(r);
    expect(out.goodMatchIf.some((b) => /supplier/i.test(b))).toBe(true);
    expect(out.lookElsewhereIf.some((b) => /supplier/i.test(b))).toBe(true);
  });

  it('flags packaging recycled content', () => {
    const r = baseResult({
      source_type: 'ecoinvent_live',
      recycled_content_pct: 50,
    });
    const out = getMatchSuitability(r, { materialType: 'packaging' });
    expect(out.goodMatchIf.some((b) => /recycled/i.test(b))).toBe(true);
    expect(out.lookElsewhereIf.some((b) => /virgin/i.test(b))).toBe(true);
  });

  it('flags very old temporal coverage', () => {
    const r = baseResult({
      source_type: 'ecoinvent_live',
      metadata: { temporal_coverage: '2008' },
    });
    const out = getMatchSuitability(r);
    expect(out.lookElsewhereIf.some((b) => /old/i.test(b))).toBe(true);
  });

  it('caps each list at four bullets', () => {
    const r = baseResult({
      source_type: 'primary',
      name: 'Organic barley grain',
      location: '{GLO}',
      recycled_content_pct: 30,
      metadata: { temporal_coverage: '2005', geographic_scope: 'GLO' },
    });
    const out = getMatchSuitability(r, { materialType: 'packaging' });
    expect(out.goodMatchIf.length).toBeLessThanOrEqual(4);
    expect(out.lookElsewhereIf.length).toBeLessThanOrEqual(4);
  });
});
