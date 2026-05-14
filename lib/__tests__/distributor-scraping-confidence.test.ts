import { describe, it, expect } from 'vitest';
import { scoreConfidence } from '@/lib/distributor/scraping/confidence-scorer';

describe('scoreConfidence', () => {
  it('ranks certification-db DOM parses highest', () => {
    expect(scoreConfidence('certification_db', 'dom_parse')).toBe(0.95);
    expect(scoreConfidence('certification_db', 'api')).toBe(0.98);
  });

  it('penalises LLM extraction on a brand website vs the same data from a directory', () => {
    expect(scoreConfidence('brand_website', 'llm_extract')).toBeLessThan(
      scoreConfidence('certification_db', 'llm_extract'),
    );
  });

  it('returns a pessimistic fallback for unknown combinations', () => {
    // @ts-expect-error — intentionally passing an invalid combo
    expect(scoreConfidence('mystery', 'mystery')).toBe(0.5);
  });

  it('always returns a value between 0 and 1', () => {
    const sources = ['certification_db', 'brand_website', 'regulatory_body', 'company_registry', 'other'] as const;
    const methods = ['dom_parse', 'llm_extract', 'pattern_match', 'api'] as const;
    for (const s of sources) {
      for (const m of methods) {
        const v = scoreConfidence(s, m);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});
