import Anthropic from '@anthropic-ai/sdk';
import type { CrawledDocument, CrawledDocumentKind, CrawledProduct } from '@/lib/distributor/scraping/sources';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4000;
const WEB_SEARCH_MAX_USES = 6;

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export interface DeepEnrichArgs {
  brandName: string;
  website: string | null;
  country?: string | null;
  category?: string | null;
}

export interface DeepEnrichResult {
  products: CrawledProduct[];
  documents: CrawledDocument[];
  /** Short note from the model on what it searched / found. */
  summary?: string;
  error?: string;
}

const VALID_CATEGORY = new Set(['spirits', 'wine', 'beer', 'non_alc', 'other']);
const VALID_FORMAT = new Set(['bottle', 'can', 'keg', 'bag_in_box', 'other']);
const VALID_KINDS = new Set<CrawledDocumentKind>([
  'epd',
  'lca',
  'sustainability_report',
  'datasheet',
  'other',
]);

/**
 * Single-brand deep enrichment using Claude with the web_search tool.
 * Returns the brand's product list + any sustainability documents found
 * across the web (not just on their own site). Used as a fallback when
 * the brand-website crawler misses products (JS-heavy sites, Shopify
 * catalogues hidden behind app routing) or when sustainability docs
 * are hosted on third-party platforms (B Corp directory, certifier
 * sites, sustainability databases).
 *
 * Same persistence layer as the crawler: products go through the
 * product matcher; documents go through the PDF ingester (any URL
 * ending in .pdf is downloaded + queued for the document processor).
 */
export async function deepEnrichBrand(args: DeepEnrichArgs): Promise<DeepEnrichResult> {
  const client = getClient();
  if (!client) {
    return { products: [], documents: [], error: 'ANTHROPIC_API_KEY not configured' };
  }

  const prompt = buildPrompt(args);

  let text = '';
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: WEB_SEARCH_MAX_USES,
        } as unknown as Anthropic.Tool,
      ],
      messages: [{ role: 'user', content: prompt }],
    });
    for (const block of response.content) {
      if (block.type === 'text') text += block.text + '\n';
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { products: [], documents: [], error: `anthropic_error: ${message}` };
  }

  const parsed = extractJson(text);
  if (!parsed) {
    return { products: [], documents: [], error: 'model_returned_invalid_json' };
  }

  const products = sanitiseProducts(parsed.products, args.website ?? args.brandName);
  const documents = sanitiseDocuments(parsed.documents, args.website ?? args.brandName);
  return {
    products,
    documents,
    summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
  };
}

function buildPrompt(args: DeepEnrichArgs): string {
  const contextLines: string[] = [`Brand name: ${args.brandName}.`];
  if (args.website) contextLines.push(`Website: ${args.website}.`);
  if (args.country) contextLines.push(`Country: ${args.country}.`);
  if (args.category) contextLines.push(`Category: ${args.category}.`);

  return `You are researching the drinks brand below. Use web search to find:
  1. Every product this brand makes (with size variants where they exist).
  2. Any sustainability documents they have published — EPDs (Environmental Product Declarations), LCAs, sustainability reports, impact reports, ESG reports, carbon-footprint statements, B Corp impact reports.

${contextLines.join('\n')}

After researching, output ONE JSON object and NOTHING else (no markdown, no commentary) with this exact shape:

{
  "summary": "one sentence describing what you searched and found",
  "products": [
    {
      "name": "Product name as the brand uses it (e.g. 'Lightly Spiced Rum 70cl')",
      "category": "spirits | wine | beer | non_alc | other",
      "abv": 41.2,
      "container_size_ml": 700,
      "container_format": "bottle | can | keg | bag_in_box | other"
    }
  ],
  "documents": [
    {
      "url": "https://… absolute URL of the actual PDF or page",
      "title": "Two Drifters EPD - Lightly Spiced Rum",
      "kind": "epd | lca | sustainability_report | datasheet | other"
    }
  ]
}

Rules:
- Real products only — confirmed via search.
- Documents: only include URLs you actually verified via search. Never invent URLs.
- If a document URL is to a landing page that links to a PDF, prefer the PDF URL when you can find it.
- "category" must be exactly one of the allowed values.
- "container_size_ml" is a number (70cl = 700, 1L = 1000).
- "abv" is a percent (e.g. 41.2, not 0.412).
- Leave a field null rather than guessing. Don't invent GTINs.
- British English in any prose. No em dashes.`;
}

function extractJson(text: string): {
  summary?: unknown;
  products?: unknown;
  documents?: unknown;
} | null {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function sanitiseProducts(input: unknown, fallbackSourceUrl: string): CrawledProduct[] {
  if (!Array.isArray(input)) return [];
  const out: CrawledProduct[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const name = str(r.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const cat = str(r.category);
    const fmt = str(r.container_format);
    out.push({
      name,
      category: cat && VALID_CATEGORY.has(cat) ? cat : null,
      abv: num(r.abv),
      container_size_ml: num(r.container_size_ml),
      container_format: fmt && VALID_FORMAT.has(fmt) ? fmt : null,
      source_url: fallbackSourceUrl,
    });
  }
  return out;
}

function sanitiseDocuments(input: unknown, fallbackSourceUrl: string): CrawledDocument[] {
  if (!Array.isArray(input)) return [];
  const out: CrawledDocument[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const url = str(r.url);
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const kindRaw = str(r.kind) ?? 'other';
    const kind = VALID_KINDS.has(kindRaw as CrawledDocumentKind)
      ? (kindRaw as CrawledDocumentKind)
      : 'other';
    out.push({
      url,
      anchor_text: str(r.title) ?? url,
      kind,
      source_url: fallbackSourceUrl,
    });
  }
  return out;
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || t.toLowerCase() === 'null') return null;
  return t;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
