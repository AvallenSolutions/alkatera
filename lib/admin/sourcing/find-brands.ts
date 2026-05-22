import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8000;
const WEB_SEARCH_MAX_USES = 8;

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export interface SourcingFilters {
  /** spirits | wine | beer | non_alc | other */
  category?: string | null;
  /** Country name or ISO-2. */
  country?: string | null;
  /** e.g. ["B Corp", "organic", "carbon neutral"] */
  certifications?: string[];
  /** Free-text refinement, e.g. "small-batch gin", "natural wine". */
  keywords?: string | null;
  /** Manual brand-name search — when set, find this specific brand. */
  query?: string | null;
  /** Max brands to return (capped). */
  limit?: number;
}

export interface SourcedBrand {
  name: string;
  website?: string | null;
  category?: string | null;
  country_of_origin?: string | null;
  founding_year?: number | null;
  parent_company?: string | null;
  description?: string | null;
  aliases?: string | null;
}

export interface SourcedProduct {
  brand_name: string;
  product_name: string;
  gtin?: string | null;
  category?: string | null;
  abv?: number | null;
  container_size_ml?: number | null;
  container_format?: string | null;
}

export interface FindBrandsResult {
  brands: SourcedBrand[];
  products: SourcedProduct[];
  /** Short note from the model on what it searched / found. */
  summary?: string;
  error?: string;
}

const MAX_LIMIT = 25;

/**
 * Use Claude with the web_search server tool to find real drinks
 * brands matching the filters (or a specific brand for a manual
 * query), and return them structured in the directory schema. The
 * caller ingests these as `pending` so they pass through the admin
 * review queue before going live.
 */
export async function findBrands(filters: SourcingFilters): Promise<FindBrandsResult> {
  const client = getClient();
  if (!client) {
    return { brands: [], products: [], error: 'ANTHROPIC_API_KEY not configured' };
  }

  const limit = Math.min(MAX_LIMIT, Math.max(1, filters.limit ?? 12));
  const prompt = buildPrompt(filters, limit);

  let combinedText = '';
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
      if (block.type === 'text') combinedText += block.text + '\n';
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { brands: [], products: [], error: `anthropic_error: ${message}` };
  }

  const parsed = extractJson(combinedText);
  if (!parsed) {
    return { brands: [], products: [], error: 'model_returned_invalid_json' };
  }

  const brands = sanitiseBrands(parsed.brands);
  const products = sanitiseProducts(parsed.products, brands);
  return {
    brands,
    products,
    summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
  };
}

function buildPrompt(filters: SourcingFilters, limit: number): string {
  const criteria: string[] = [];
  if (filters.query) {
    criteria.push(`Find this specific drinks brand (and close matches): "${filters.query}".`);
  }
  if (filters.category) criteria.push(`Category: ${filters.category}.`);
  if (filters.country) criteria.push(`Country of origin: ${filters.country}.`);
  if (filters.certifications && filters.certifications.length > 0) {
    criteria.push(`Should hold or credibly claim: ${filters.certifications.join(', ')}.`);
  }
  if (filters.keywords) criteria.push(`Focus: ${filters.keywords}.`);
  const criteriaBlock = criteria.length > 0 ? criteria.join('\n') : 'Any notable drinks brands.';

  return `You are sourcing real drinks brands for a sustainability directory. Use web search to find brands that genuinely exist and match the criteria. Prioritise brands with a real website and a verifiable sustainability angle (certifications, carbon, packaging, sourcing).

Criteria:
${criteriaBlock}

Return up to ${limit} brands.

After researching, output ONE JSON object and NOTHING else (no markdown, no commentary) with this exact shape:

{
  "summary": "one sentence on what you searched and found",
  "brands": [
    {
      "name": "Brand display name",
      "website": "https://… or null",
      "category": "spirits | wine | beer | non_alc | other",
      "country_of_origin": "ISO-2 code or country name, or null",
      "founding_year": 1863,
      "parent_company": "owning group or null",
      "description": "1-2 sentences, lead with the sustainability story. British English. No em dashes.",
      "aliases": "semicolon-separated alternates, or null"
    }
  ],
  "products": [
    {
      "brand_name": "must exactly match a name in brands[]",
      "product_name": "include size where it varies",
      "gtin": "barcode digits or null",
      "category": "spirits | wine | beer | non_alc | other",
      "abv": 41.2,
      "container_size_ml": 700,
      "container_format": "bottle | can | keg | bag_in_box | other"
    }
  ]
}

Rules:
- Real brands only. If you cannot verify a brand exists from a source, leave it out.
- Leave a field null rather than guessing. Never invent a GTIN or a website.
- "category" must be exactly one of: spirits, wine, beer, non_alc, other.
- Products are optional; include a few flagship products per brand where you can find them.
- British English in descriptions. Never use em dashes.`;
}

function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const VALID_CATEGORY = new Set(['spirits', 'wine', 'beer', 'non_alc', 'other']);
const VALID_FORMAT = new Set(['bottle', 'can', 'keg', 'bag_in_box', 'other']);

function sanitiseBrands(input: unknown): SourcedBrand[] {
  if (!Array.isArray(input)) return [];
  const out: SourcedBrand[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const name = str(r.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      website: str(r.website),
      category: VALID_CATEGORY.has(str(r.category) ?? '') ? str(r.category) : null,
      country_of_origin: str(r.country_of_origin),
      founding_year: num(r.founding_year),
      parent_company: str(r.parent_company),
      description: str(r.description),
      aliases: str(r.aliases),
    });
  }
  return out;
}

function sanitiseProducts(input: unknown, brands: SourcedBrand[]): SourcedProduct[] {
  if (!Array.isArray(input)) return [];
  const brandNames = new Set(brands.map((b) => b.name.toLowerCase()));
  const out: SourcedProduct[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const brandName = str(r.brand_name);
    const productName = str(r.product_name);
    if (!brandName || !productName) continue;
    // Only keep products whose brand we're also ingesting.
    if (!brandNames.has(brandName.toLowerCase())) continue;
    out.push({
      brand_name: brandName,
      product_name: productName,
      gtin: str(r.gtin),
      category: VALID_CATEGORY.has(str(r.category) ?? '') ? str(r.category) : null,
      abv: num(r.abv),
      container_size_ml: num(r.container_size_ml),
      container_format: VALID_FORMAT.has(str(r.container_format) ?? '')
        ? str(r.container_format)
        : null,
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
