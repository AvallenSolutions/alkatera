import { fetchPage } from '../http';
import { htmlToText } from '../extractors/html-to-text';
import { extractFieldsFromContent } from '../extractors/llm-extractor';
import { extractPatterns } from '../extractors/pattern-extractor';
import { generateCompanyDescription } from '../extractors/description-generator';
import { extractProductsFromPage } from '../extractors/product-extractor';
import type { FieldKey } from '../field-definitions';
import type {
  BrandSnapshot,
  CrawledProduct,
  SourceFinding,
  SourceRunResult,
  SourceScraper,
} from './types';

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

// Product / shop / range paths. Crawled separately from the corpus
// pages so we can run a focused product extractor on each one and avoid
// burning the LLM corpus budget on long product-card markup.
const PRODUCT_PATHS = [
  '/products',
  '/our-products',
  '/all-products',
  '/shop',
  '/store',
  '/range',
  '/our-range',
  '/the-range',
  '/our-spirits',
  '/spirits',
  '/our-gin',
  '/our-rum',
  '/our-whisky',
  '/our-vodka',
  '/our-wines',
  '/our-beers',
  '/collection',
  '/buy',
];

const MAX_CRAWL_PAGES = 6; // homepage + 5 corpus paths
const MAX_PRODUCT_PAGES = 6; // bounded so a sprawling Shopify catalogue can't blow the budget
const COMBINED_TEXT_BUDGET = 16_000;
const PRODUCT_TEXT_BUDGET_PER_PAGE = 18_000;

// Words that suggest a PDF link is a sustainability / EPD / LCA report.
// Case-insensitive, applied to the anchor text + the URL itself.
const SUSTAINABILITY_PDF_KEYWORDS = [
  'epd',
  'environmental product declaration',
  'lca',
  'life cycle assessment',
  'life-cycle assessment',
  'sustainability report',
  'sustainability-report',
  'esg report',
  'esg-report',
  'impact report',
  'impact-report',
  'carbon report',
  'carbon-footprint',
  'b corp impact',
];

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
    const products: CrawledProduct[] = [];
    const pdfCandidates = new Map<string, { url: string; anchorText: string }>();

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
    collectPdfLinks(home.body, home.url, pdfCandidates);

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
      collectPdfLinks(res.body, res.url, pdfCandidates);
    }

    // Product-page crawl. Each candidate path gets a fetch + a focused
    // product-extractor LLM call. We dedupe by normalised product name
    // (case-insensitive) within this run so the same product on two
    // pages doesn't get persisted twice.
    const seenProductKeys = new Set<string>();
    let productPagesFetched = 0;
    for (const path of PRODUCT_PATHS) {
      if (productPagesFetched >= MAX_PRODUCT_PAGES) break;
      const url = combine(homepage, path);
      if (!url || seen.has(url.toLowerCase())) continue;
      seen.add(url.toLowerCase());
      const res = await fetchPage(url);
      if (!res.ok || !res.body) continue;
      productPagesFetched += 1;

      collectPdfLinks(res.body, res.url, pdfCandidates);
      const text = htmlToText(res.body);
      if (!text.trim()) continue;
      const extracted = await extractProductsFromPage({
        text: text.slice(0, PRODUCT_TEXT_BUDGET_PER_PAGE),
        brandName: brand.name,
        sourceUrl: res.url,
      });
      for (const p of extracted.products) {
        const key = p.name.toLowerCase();
        if (seenProductKeys.has(key)) continue;
        seenProductKeys.add(key);
        products.push(p);
      }
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

    // Promote the best-looking sustainability PDF to a finding. We
    // can't enumerate "all PDFs" via the field-key model, but we can
    // surface the most signal-dense one (the one whose anchor text or
    // URL contains EPD / LCA / sustainability-report-style keywords).
    // The admin sees the link in the brand-detail Data tab and can
    // upload it through the existing brand-upload flow for full
    // extraction.
    const bestPdf = pickBestSustainabilityPdf(Array.from(pdfCandidates.values()));
    if (bestPdf) {
      findings.push({
        field_key: 'sustainability_report_url',
        raw_value: bestPdf.url,
        extraction_method: 'pattern_match',
        source_url: bestPdf.url,
      });
    }

    return { ok: true, findings, products };
  },
};

/**
 * Scan rendered HTML for anchor tags pointing at PDFs. Build a map
 * keyed by the absolute URL so the same PDF linked from multiple pages
 * collapses to a single candidate. Anchor text is preserved so the
 * keyword-classifier downstream can prefer EPD / sustainability-report
 * candidates over generic datasheets.
 */
function collectPdfLinks(
  html: string,
  baseUrl: string,
  out: Map<string, { url: string; anchorText: string }>,
): void {
  const anchorRegex = /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html))) {
    const rawHref = match[1] ?? match[2] ?? match[3] ?? '';
    if (!rawHref) continue;
    if (!/\.pdf(\?|#|$)/i.test(rawHref)) continue;
    const resolved = combine(baseUrl, rawHref);
    if (!resolved) continue;
    const key = resolved.toLowerCase();
    if (out.has(key)) continue;
    const anchorText = stripTags(match[4] ?? '').replace(/\s+/g, ' ').trim();
    out.set(key, { url: resolved, anchorText });
  }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

/**
 * Pick the PDF candidate most likely to be a sustainability / EPD / LCA
 * document. Scores each candidate by keyword hits in the anchor text +
 * URL; returns the highest-scoring candidate above a small threshold.
 * Returns null when nothing looks plausible — we'd rather record no
 * finding than a generic terms-and-conditions PDF.
 */
function pickBestSustainabilityPdf(
  candidates: Array<{ url: string; anchorText: string }>,
): { url: string; anchorText: string } | null {
  let best: { url: string; anchorText: string; score: number } | null = null;
  for (const c of candidates) {
    const haystack = `${c.anchorText} ${c.url}`.toLowerCase();
    let score = 0;
    for (const keyword of SUSTAINABILITY_PDF_KEYWORDS) {
      if (haystack.includes(keyword)) score += keyword.length;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { ...c, score };
    }
  }
  return best ? { url: best.url, anchorText: best.anchorText } : null;
}

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
