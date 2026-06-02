import Anthropic from '@anthropic-ai/sdk';
import type { CrawledProduct } from '../sources/types';
import { logClaudeUsage } from '@/lib/ai/usage-log';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1500;

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export interface ExtractProductsArgs {
  /** Plain-text content from a brand's product-listing or product-detail page. */
  text: string;
  /** Brand name to anchor the extraction (so we don't extract third-party listings). */
  brandName: string;
  /** URL the text came from — passed through onto each returned product. */
  sourceUrl: string;
}

export interface ExtractProductsResult {
  products: CrawledProduct[];
  error?: string;
}

const VALID_CATEGORY = new Set(['spirits', 'wine', 'beer', 'non_alc', 'other']);
const VALID_FORMAT = new Set(['bottle', 'can', 'keg', 'bag_in_box', 'other']);

/**
 * Given a chunk of text from a brand's product / shop / range page,
 * extract the products listed on it. One Claude Haiku call per page —
 * cheap, structured output, brand-anchored so it ignores third-party
 * SKUs the page might link out to.
 *
 * Returns an empty list (not an error) when the page has no products —
 * sustainability / about pages should produce no false positives.
 */
export async function extractProductsFromPage(
  args: ExtractProductsArgs,
): Promise<ExtractProductsResult> {
  const client = getClient();
  if (!client) {
    return { products: [], error: 'ANTHROPIC_API_KEY not configured' };
  }
  const text = args.text.trim();
  if (!text) return { products: [] };

  const prompt = `You are reading text from a webpage on the brand "${args.brandName}". Return the products THIS brand makes that are listed on this page. Skip anything that's not a product of this specific brand (recipes, news posts, retailer listings of OTHER brands, gift sets that just contain the brand's products without being a product themselves).

Page text (truncated):
${text.slice(0, 14000)}

Return ONE JSON object and NOTHING else (no markdown, no commentary):

{
  "products": [
    {
      "name": "Product name as it appears, including size if it varies (e.g. 'Lightly Spiced Rum 70cl')",
      "category": "spirits | wine | beer | non_alc | other",
      "abv": 41.2,
      "container_size_ml": 700,
      "container_format": "bottle | can | keg | bag_in_box | other"
    }
  ]
}

Rules:
- Leave a field null rather than guessing.
- "category" must be exactly one of the allowed values.
- "container_size_ml" is a number, not a string. 70cl = 700ml. 1L = 1000ml.
- "abv" is a number in percent (e.g. 41.2, not 0.412).
- Return [] if no products of this brand appear.
- Do NOT invent prices, SKUs, or GTINs.`;

  let text_out = '';
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });
    logClaudeUsage('product_extract', MODEL, response);
    for (const block of response.content) {
      if (block.type === 'text') text_out += block.text + '\n';
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { products: [], error: `anthropic_error: ${message}` };
  }

  const parsed = extractJson(text_out);
  if (!parsed) return { products: [], error: 'model_returned_invalid_json' };

  const products = sanitise(parsed.products, args.sourceUrl);
  return { products };
}

function extractJson(text: string): { products?: unknown } | null {
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

function sanitise(input: unknown, sourceUrl: string): CrawledProduct[] {
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
      source_url: sourceUrl,
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
