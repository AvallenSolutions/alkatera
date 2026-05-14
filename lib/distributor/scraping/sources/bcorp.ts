import { fetchPage } from '../http';
import { extractFieldsFromContent } from '../extractors/llm-extractor';
import type { BrandSnapshot, SourceRunResult, SourceScraper } from './types';

/**
 * B Corp Directory. Best-effort: their directory at bcorporation.net is
 * a JavaScript-rendered SPA so a raw fetch often returns an empty shell.
 * We try anyway — when it does return useful HTML (their server-rendered
 * cache, or alt regional pages) it's high-signal. If we get an empty
 * shell back, we skip cleanly without an error.
 *
 * Phase 3 work: replace this with a server-side scraping API
 * (Apify / Tavily / Brave Search) for reliable coverage.
 */
const SEARCH_URL = 'https://www.bcorporation.net/en-us/find-a-b-corp/?search=';

export const bcorpSource: SourceScraper = {
  name: 'B Corp Directory',
  source_type: 'certification_db',
  async run(brand: BrandSnapshot): Promise<SourceRunResult> {
    const url = `${SEARCH_URL}${encodeURIComponent(brand.name)}`;
    const res = await fetchPage(url);
    if (!res.ok || !res.body) {
      return {
        ok: false,
        skipped: true,
        reason: res.error ?? `bcorp_status_${res.status}`,
        findings: [],
      };
    }

    // Heuristic: the SPA shell has very little body text. If the page
    // we got doesn't even mention the brand by name, skip — we'd just be
    // wasting an LLM call.
    if (!res.body.toLowerCase().includes(brand.name.toLowerCase().split(' ')[0])) {
      return { ok: false, skipped: true, reason: 'bcorp_no_brand_mention', findings: [] };
    }

    const llm = await extractFieldsFromContent({
      content: res.body,
      brandName: brand.name,
      fieldsToExtract: ['bcorp_certified'],
      sourceName: 'B Corp Directory',
    });

    const findings = Object.entries(llm.values)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => ({
        field_key: key as never,
        raw_value: value,
        extraction_method: 'llm_extract' as const,
        source_url: res.url,
      }));

    return { ok: true, findings };
  },
};
