import { describe, expect, it } from 'vitest';
import { selectConservativeProxy } from '../auto-proxy';

describe('selectConservativeProxy', () => {
  it('takes the top raw search result even though it failed the confidence gate', () => {
    const proxy = selectConservativeProxy(
      [{ id: 'staging-1', name: 'sugar, refined', source_type: 'ecoinvent_live', co2_factor: 1.2, source: 'ecoinvent' }],
      'ingredient',
    );
    expect(proxy.matched_source_name).toBe('sugar, refined');
    expect(proxy.ef_source_type).toBe('proxy');
    expect(proxy.proxy_reason).toBe('closest_search_result');
    expect(proxy.carbon_intensity).toBe(1.2);
    expect(proxy.ef_uncertainty_percent).toBeGreaterThanOrEqual(45);
    expect(proxy.ef_data_quality_grade).toBe('LOW');
  });

  it('falls back to a conservative per-category default when the search returns nothing', () => {
    const ingredientFallback = selectConservativeProxy([], 'ingredient');
    expect(ingredientFallback.proxy_reason).toBe('category_fallback');
    expect(ingredientFallback.ef_source_type).toBe('proxy');
    expect(ingredientFallback.carbon_intensity).toBeGreaterThan(0);

    const packagingFallback = selectConservativeProxy([], 'packaging');
    expect(packagingFallback.proxy_reason).toBe('category_fallback');
    expect(packagingFallback.matched_source_name).not.toBe(ingredientFallback.matched_source_name);
  });

  it('never returns a match with zero or negative carbon intensity for the fallback path', () => {
    const proxy = selectConservativeProxy([{ name: undefined }], 'packaging');
    expect(proxy.proxy_reason).toBe('category_fallback');
    expect(proxy.carbon_intensity).toBeGreaterThan(0);
  });
});
