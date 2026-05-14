import { describe, it, expect } from 'vitest';
import {
  normalizeBrandName,
  suggestColumnMapping,
  buildOrgSlug,
} from '@/lib/distributor/brand-normalizer';

describe('normalizeBrandName', () => {
  it('lowercases and trims', () => {
    expect(normalizeBrandName('  Château Margaux  ')).toBe('chateau margaux');
  });

  it('strips diacritics so accent variants collapse', () => {
    expect(normalizeBrandName('Château Margaux')).toBe(normalizeBrandName('Chateau Margaux'));
  });

  it('removes common legal suffixes', () => {
    expect(normalizeBrandName('Château Margaux SAS')).toBe('chateau margaux');
    expect(normalizeBrandName('Acme Distillery Ltd')).toBe('acme distillery');
    expect(normalizeBrandName('Beam Suntory Inc')).toBe('beam suntory');
  });

  it('treats apostrophe variants as identical', () => {
    expect(normalizeBrandName("D'Aristi")).toBe(normalizeBrandName('D’Aristi'));
    expect(normalizeBrandName("D'Aristi")).toBe(normalizeBrandName('DAristi'));
  });

  it('collapses whitespace and stray punctuation', () => {
    expect(normalizeBrandName('Hennessy  &  Co.')).toBe('hennessy');
  });
});

describe('suggestColumnMapping', () => {
  it('matches known aliases case-insensitively', () => {
    const result = suggestColumnMapping(['Brand Name', 'Product', 'SKU Code', 'Category']);
    expect(result.brand_name).toBe('Brand Name');
    expect(result.product_name).toBe('Product');
    expect(result.sku_code).toBe('SKU Code');
    expect(result.category).toBe('Category');
  });

  it('returns undefined for unknown headers', () => {
    const result = suggestColumnMapping(['Foo', 'Bar', 'Baz']);
    expect(result.brand_name).toBeUndefined();
    expect(result.product_name).toBeUndefined();
  });

  it('matches alias variants like producer or winery', () => {
    expect(suggestColumnMapping(['Producer', 'Description']).brand_name).toBe('Producer');
    expect(suggestColumnMapping(['Winery', 'Wine Name']).brand_name).toBe('Winery');
    expect(suggestColumnMapping(['Distillery', 'Product Name']).brand_name).toBe('Distillery');
  });

  it('preserves the original header casing in the suggestion', () => {
    const result = suggestColumnMapping(['BRAND', 'Item Description']);
    expect(result.brand_name).toBe('BRAND');
    expect(result.product_name).toBe('Item Description');
  });
});

describe('buildOrgSlug', () => {
  it('produces a clean hyphenated lowercase slug', () => {
    expect(buildOrgSlug('Liberty Wines')).toBe('liberty-wines');
    expect(buildOrgSlug('Pol Roger & Co.')).toBe('pol-roger-co');
    expect(buildOrgSlug('  Some Distributor  ')).toBe('some-distributor');
  });

  it('falls back to "distributor" when name has no alphanumerics', () => {
    expect(buildOrgSlug('!!!')).toBe('distributor');
  });

  it('handles diacritics', () => {
    expect(buildOrgSlug('Château Margaux')).toBe('chateau-margaux');
  });
});
