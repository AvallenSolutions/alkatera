import { fetchPage } from '../http';
import { extractFieldsFromContent } from '../extractors/llm-extractor';
import { extractPatterns } from '../extractors/pattern-extractor';
import type { FieldKey } from '../field-definitions';
import type { BrandSnapshot, SourceFinding, SourceRunResult, SourceScraper } from './types';

/**
 * Use Wikipedia's free REST summary endpoint to fetch a brand's article.
 * Wikipedia is excellent for corporate facts — parent company, HQ
 * country, founding year — and occasionally mentions sustainability
 * certifications. We use the summary endpoint (not the full HTML page)
 * to keep payloads small and consistent.
 */
const WIKI_SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

const TARGET_FIELDS: FieldKey[] = [
  'parent_company',
  'hq_country',
  'founding_year',
  'bcorp_certified',
  'fairtrade_certified',
  'organic_certified',
  'company_registration_number',
];

export const wikipediaSource: SourceScraper = {
  name: 'Wikipedia',
  source_type: 'other',
  async run(brand: BrandSnapshot): Promise<SourceRunResult> {
    const slug = slugForWiki(brand.name);
    const url = `${WIKI_SUMMARY}${encodeURIComponent(slug)}`;
    const res = await fetchPage(url);
    if (!res.ok || !res.body) {
      return {
        ok: false,
        skipped: res.status === 404,
        reason: res.error ?? `wikipedia_status_${res.status}`,
        findings: [],
      };
    }

    let summary: { extract?: string; description?: string; type?: string } | null = null;
    try {
      summary = JSON.parse(res.body);
    } catch {
      return { ok: false, reason: 'wikipedia_invalid_json', findings: [] };
    }
    if (!summary || summary.type === 'disambiguation') {
      return { ok: false, skipped: true, reason: 'wikipedia_disambiguation', findings: [] };
    }
    const text = [summary.description ?? '', summary.extract ?? ''].filter(Boolean).join('\n');
    if (!text.trim()) {
      return { ok: false, skipped: true, reason: 'wikipedia_no_extract', findings: [] };
    }

    const findings: SourceFinding[] = [];

    const patterns = extractPatterns(text);
    for (const [key, value] of Object.entries(patterns.values)) {
      if (value === undefined) continue;
      findings.push({
        field_key: key as FieldKey,
        raw_value: value,
        extraction_method: 'pattern_match',
        source_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`,
      });
    }

    const llm = await extractFieldsFromContent({
      content: text,
      isPlainText: true,
      brandName: brand.name,
      fieldsToExtract: TARGET_FIELDS,
      sourceName: 'Wikipedia',
    });
    for (const [key, value] of Object.entries(llm.values)) {
      if (value === undefined || value === null || value === '') continue;
      findings.push({
        field_key: key as FieldKey,
        raw_value: value,
        extraction_method: 'llm_extract',
        source_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`,
      });
    }

    return { ok: true, findings };
  },
};

function slugForWiki(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '_')
    // Keep a-zA-Z0-9 plus underscore, hyphen, and basic punctuation
    // Wikipedia accepts most things via URL encoding so we don't over-filter.
    .replace(/[^A-Za-z0-9_\-&]/g, '');
}
