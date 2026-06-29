import 'server-only';
import { fetchPage } from '@/lib/distributor/scraping/http';
import { runJsonPrompt } from '@/lib/ai/gemini';

/**
 * Focused, FAST brand enrichment for an outbound footprint report.
 *
 * This deliberately does NOT use `deepEnrichBrand` (the heavy directory engine:
 * ~30 credentials, awards, documents, a 12k-token output and extensive grounded
 * web search). That call routinely runs 60-90s+ and tripped the serverless
 * idle/total timeouts when wired into the report flow.
 *
 * Instead we read the brand's OWN website (homepage + its product/shop pages)
 * with the existing browser-UA fetcher, then extract only the three things the
 * estimator needs — category, country, and product sizes — with a single fast,
 * NON-grounded `flash` JSON call. Typical end-to-end: a few seconds, with a hard
 * 60s ceiling on the model call. Reads the real site, so it actually finds the
 * specific category and the real SKU sizes.
 */

export interface ReportProduct {
  name: string;
  containerSizeMl: number | null;
}

export interface ReportEnrichment {
  /** A specific drinks category as written on the site (e.g. "Calvados"). */
  category: string | null;
  countryOfOrigin: string | null;
  products: ReportProduct[];
  /** How many pages were read (0 = no website text was available). */
  pagesRead: number;
  error?: string;
}

const MAX_PRODUCT_PAGES = 2;
const MAX_TEXT_CHARS = 40_000;
const MAX_PRODUCTS = 24;

const PRODUCT_HINT = /shop|product|range|collection|\bbuy\b|store|bottle|our[-\s]?(?:spirits|drinks|range|products)/i;
const EXCLUDE_HINT = /cart|basket|checkout|account|login|sign[-\s]?in|privacy|terms|cookie|contact|blog|news|journal|wholesale|policy|faq|careers|press/i;

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Same-host product/shop page URLs linked from the homepage HTML. */
export function findProductLinks(html: string, baseUrl: string): string[] {
  let baseHost: string;
  try {
    baseHost = new URL(baseUrl).host;
  } catch {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const text = htmlToText(m[2]);
    let abs: URL;
    try {
      abs = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue;
    if (abs.host !== baseHost) continue;
    const probe = `${abs.pathname} ${text}`;
    if (!PRODUCT_HINT.test(probe) || EXCLUDE_HINT.test(probe)) continue;
    const key = abs.origin + abs.pathname;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(abs.toString());
    if (out.length >= 8) break; // gather a few, fetch only the top MAX_PRODUCT_PAGES
  }
  return out;
}

/** Fetch the homepage + a couple of product pages and return their visible text. */
async function gatherSiteText(website: string): Promise<{ text: string; pagesRead: number }> {
  const home = await fetchPage(website);
  if (!home.ok || !home.body) return { text: '', pagesRead: 0 };

  const parts: string[] = [`HOMEPAGE (${website}):\n${htmlToText(home.body)}`];
  let pagesRead = 1;

  const links = findProductLinks(home.body, website).slice(0, MAX_PRODUCT_PAGES);
  const pages = await Promise.all(links.map((l) => fetchPage(l)));
  for (const p of pages) {
    if (p.ok && p.body) {
      parts.push(`PAGE (${p.url}):\n${htmlToText(p.body)}`);
      pagesRead += 1;
    }
  }

  return { text: parts.join('\n\n').slice(0, MAX_TEXT_CHARS), pagesRead };
}

function buildPrompt(brandName: string, website: string | null, siteText: string): string {
  const source = siteText
    ? `Below is text scraped from the brand's own website. Base your answer on it.\n\nWEBSITE TEXT:\n${siteText}`
    : `You have no website text. Answer only from what you reliably know about this specific brand; if you are unsure, return nulls and an empty products array rather than guessing.`;

  return `You are extracting facts about a drinks brand to build a carbon-footprint estimate.

Brand: ${brandName}
${website ? `Website: ${website}` : ''}

${source}

Return ONLY a JSON object of this exact shape:
{
  "category": "the most specific accurate drinks category as the brand describes it, e.g. Calvados, London Dry Gin, Single Malt Whisky, Spiced Rum, Lager, Red Wine, Cider, Vodka, Tequila. null if genuinely unclear.",
  "country_of_origin": "country where the drink is produced — full name or ISO-2 code (e.g. France or FR). null if unclear.",
  "products": [
    { "name": "full product name as sold, e.g. Avallen Calvados", "container_size_ml": 700 }
  ]
}

Rules:
- container_size_ml in millilitres: 70cl = 700, 75cl = 750, 50cl = 500, 1L = 1000, 4.5L = 4500, 5cl miniature = 50. Use null only if no size is stated anywhere.
- List EVERY distinct product and size variant you can find. A 700ml and a 4.5L of the same drink are TWO separate entries.
- Only real drinks this brand sells. Exclude gift cards, glassware, merchandise, subscriptions, bundles of mixed brands.
- British English. Output JSON only — no markdown, no commentary.`;
}

export function sanitise(parsed: Record<string, unknown>, pagesRead: number): ReportEnrichment {
  const category =
    typeof parsed.category === 'string' && parsed.category.trim() && parsed.category.trim().toLowerCase() !== 'null'
      ? parsed.category.trim()
      : null;
  const countryOfOrigin =
    typeof parsed.country_of_origin === 'string' &&
    parsed.country_of_origin.trim() &&
    parsed.country_of_origin.trim().toLowerCase() !== 'null'
      ? parsed.country_of_origin.trim()
      : null;

  const products: ReportProduct[] = [];
  const seen = new Set<string>();
  if (Array.isArray(parsed.products)) {
    for (const raw of parsed.products) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const name = typeof r.name === 'string' ? r.name.trim() : '';
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      let size: number | null = null;
      if (typeof r.container_size_ml === 'number' && Number.isFinite(r.container_size_ml) && r.container_size_ml > 0) {
        size = Math.round(r.container_size_ml);
      }
      products.push({ name, containerSizeMl: size });
      if (products.length >= MAX_PRODUCTS) break;
    }
  }

  return { category, countryOfOrigin, products, pagesRead };
}

/**
 * Enrich a brand for its outbound report. Reads the website (when given) and
 * extracts category + country + product sizes with one fast flash call.
 */
export async function enrichBrandForReport(
  brandName: string,
  website: string | null,
): Promise<ReportEnrichment> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { category: null, countryOfOrigin: null, products: [], pagesRead: 0, error: 'GEMINI_API_KEY not configured' };
  }

  let siteText = '';
  let pagesRead = 0;
  if (website) {
    try {
      const gathered = await gatherSiteText(website);
      siteText = gathered.text;
      pagesRead = gathered.pagesRead;
    } catch {
      // Fetch failed (DNS, WAF, timeout); fall through to a name-only attempt.
    }
  }

  const prompt = buildPrompt(brandName, website, siteText);
  const parsed = await runJsonPrompt<Record<string, unknown>>({
    apiKey,
    prompt,
    maxTokens: 2000,
    op: 'outreach_report_enrich',
  });

  if (!parsed) {
    return { category: null, countryOfOrigin: null, products: [], pagesRead, error: 'model_returned_invalid_json' };
  }
  return sanitise(parsed, pagesRead);
}
