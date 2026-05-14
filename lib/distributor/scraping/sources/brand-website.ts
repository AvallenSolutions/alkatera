import { fetchPage } from '../http';
import { htmlToText } from '../extractors/html-to-text';
import { extractFieldsFromContent } from '../extractors/llm-extractor';
import { extractPatterns } from '../extractors/pattern-extractor';
import { generateCompanyDescription } from '../extractors/description-generator';
import type { FieldKey } from '../field-definitions';
import type { BrandSnapshot, SourceFinding, SourceRunResult, SourceScraper } from './types';

/**
 * Pull what we can from the brand's own website.
 *
 * Strategy:
 *   1. Fetch the homepage + a wide net of likely paths (about,
 *      sustainability, story, values, etc.). B Corp logos and
 *      certifications almost always live in the footer of the homepage
 *      or on /about — not always behind a sustainability-specific URL.
 *   2. Run pattern extraction per page so each pattern_match finding
 *      can be attributed to the exact URL it came from.
 *   3. Concatenate all page text (capped at ~16k chars) and run a single
 *      Claude Haiku LLM pass over the combined corpus. One LLM call per
 *      brand instead of one per page keeps the bill predictable.
 */
const CRAWL_PATHS = [
  // Homepage is fetched separately, listed here so the dedupe set is
  // complete and we never re-fetch it.
  '/',
  // Sustainability-themed
  '/sustainability',
  '/our-sustainability',
  '/responsibility',
  '/about/sustainability',
  '/impact',
  '/esg',
  '/environment',
  '/our-impact',
  // About / story — where B Corp and similar credentials usually live
  '/about',
  '/about-us',
  '/our-story',
  '/story',
  '/values',
  '/our-values',
  '/mission',
  '/who-we-are',
];

const MAX_CRAWL_PAGES = 6; // homepage + 5 paths max — keeps fetches polite
const COMBINED_TEXT_BUDGET = 16_000;

const TARGET_FIELDS: FieldKey[] = [
  'bcorp_certified',
  'carbon_trust_certified',
  'iso_14001_certified',
  'iso_50001_certified',
  'fairtrade_certified',
  'rainforest_alliance_certified',
  'organic_certified',
  'organic_percentage',
  'carbon_intensity_kgco2e_per_litre',
  'scope_1_tco2e',
  'scope_2_tco2e',
  'scope_3_tco2e',
  'net_zero_target_year',
  'sbt_status',
  'water_usage_litres_per_litre',
  'recycled_packaging_percentage',
  'packaging_primary_material',
  'sustainability_report_url',
  'sustainability_report_year',
  'parent_company',
  'hq_country',
  'founding_year',
  'contact_email',
];

export const brandWebsiteSource: SourceScraper = {
  name: 'Brand Website',
  source_type: 'brand_website',
  async run(brand: BrandSnapshot): Promise<SourceRunResult> {
    if (!brand.website) {
      return { ok: false, skipped: true, reason: 'no_website_on_brand_profile', findings: [] };
    }

    const homepage = normaliseUrl(brand.website);
    if (!homepage) {
      return { ok: false, skipped: true, reason: 'invalid_website_url', findings: [] };
    }

    const findings: SourceFinding[] = [];

    // Homepage is mandatory — if we can't fetch it, treat the source
    // as failed (not skipped) so the user knows something's wrong.
    const home = await fetchPage(homepage);
    if (!home.ok || !home.body) {
      return {
        ok: false,
        reason: home.error ?? `homepage_fetch_failed_${home.status}`,
        findings,
      };
    }

    const pages: Array<{ url: string; text: string }> = [];
    const homeText = htmlToText(home.body);
    if (homeText.trim()) pages.push({ url: home.url, text: homeText });

    // Walk the candidate paths. We collect text from each and keep
    // going until we've gathered MAX_CRAWL_PAGES — including duplicates
    // we silently drop. Skip 404s.
    const seen = new Set<string>([homepage.toLowerCase()]);
    for (const path of CRAWL_PATHS) {
      if (pages.length >= MAX_CRAWL_PAGES) break;
      if (path === '/') continue;
      const url = combine(homepage, path);
      if (!url || seen.has(url.toLowerCase())) continue;
      seen.add(url.toLowerCase());

      const res = await fetchPage(url);
      if (!res.ok || !res.body) continue;
      const text = htmlToText(res.body);
      if (!text.trim()) continue;
      pages.push({ url: res.url, text });
    }

    if (pages.length === 0) {
      return { ok: false, reason: 'no_extractable_page_text', findings };
    }

    // Pattern extraction per page — cheap, attributes findings to the
    // exact URL they came from.
    for (const { url, text } of pages) {
      const patterns = extractPatterns(text);
      for (const [key, value] of Object.entries(patterns.values)) {
        if (value === undefined) continue;
        findings.push({
          field_key: key as FieldKey,
          raw_value: value,
          extraction_method: 'pattern_match',
          source_url: url,
        });
      }
    }

    // Combined LLM pass. Most useful pages come first (homepage), but
    // we label each chunk with its URL so the model can keep them
    // distinct when reasoning about the brand.
    const combined = buildCombinedCorpus(pages, COMBINED_TEXT_BUDGET);
    if (combined.length > 0) {
      const llm = await extractFieldsFromContent({
        content: combined,
        isPlainText: true,
        brandName: brand.name,
        fieldsToExtract: TARGET_FIELDS,
        sourceName: 'Brand Website',
      });
      for (const [key, value] of Object.entries(llm.values)) {
        if (value === undefined || value === null || value === '') continue;
        findings.push({
          field_key: key as FieldKey,
          raw_value: value,
          extraction_method: 'llm_extract',
          source_url: homepage,
        });
      }

      // Generate a prose company description from the same corpus. This
      // is a separate Haiku call because the structured-field prompt
      // and the narrative prompt have different shapes (JSON vs prose),
      // and the description benefits from being able to "see" all the
      // pages at once rather than answering yes/no per field.
      const description = await generateCompanyDescription({
        brandName: brand.name,
        corpus: combined,
      });
      if (description.description) {
        findings.push({
          field_key: 'company_description',
          raw_value: description.description,
          extraction_method: 'llm_extract',
          source_url: homepage,
        });
      }
    }

    return { ok: true, findings };
  },
};

/**
 * Concatenate the per-page texts with URL labels so the LLM can keep
 * them separate. Hard cap at the byte budget so prompt length stays
 * predictable. Pages are added in fetch order (homepage first) — when
 * we hit the budget we truncate the tail rather than dropping early
 * pages, because the homepage is the most signal-dense.
 */
function buildCombinedCorpus(
  pages: Array<{ url: string; text: string }>,
  budget: number,
): string {
  const parts: string[] = [];
  let remaining = budget;
  for (const { url, text } of pages) {
    if (remaining <= 0) break;
    const header = `--- ${url} ---\n`;
    const allowance = remaining - header.length;
    if (allowance <= 100) break;
    const chunk = text.length > allowance ? text.slice(0, allowance) + '…' : text;
    parts.push(header + chunk);
    remaining -= header.length + chunk.length + 2; // +2 for the joining newlines
  }
  return parts.join('\n\n');
}

function normaliseUrl(input: string): string | null {
  let url = input.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('.')) return null;
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname.replace(/\/$/, '')}`;
  } catch {
    return null;
  }
}

function combine(base: string, path: string): string | null {
  try {
    return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
  } catch {
    return null;
  }
}
