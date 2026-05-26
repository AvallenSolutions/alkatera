import Anthropic from '@anthropic-ai/sdk';
import type {
  CrawledDocument,
  CrawledDocumentKind,
  CrawledProduct,
} from '@/lib/distributor/scraping/sources';

const MODEL = 'claude-sonnet-4-6';
// Sonnet supports much higher output; we kept this conservative
// initially but every iteration adds another structured section
// (credentials, products, documents, awards, notable_facts, brand
// metadata) and 6000 tokens was visibly being hit — Claude's response
// silently dropped the credentials block on at least one Two Drifters
// run. 12000 leaves comfortable headroom.
const MAX_TOKENS = 12000;
const WEB_SEARCH_MAX_USES = 10;

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export interface ExistingProductRef {
  id: string;
  name: string;
}

export interface DeepEnrichArgs {
  brandName: string;
  website: string | null;
  country?: string | null;
  category?: string | null;
  /** What we already know about this brand on alka**tera**. Shown to the
   *  model so it can fill gaps rather than re-collecting the same facts. */
  existingBrand: {
    description?: string | null;
    founding_year?: number | null;
    parent_company?: string | null;
  };
  /** Products already on file for this brand. Claude maps any new findings
   *  to these where they refer to the same SKU, so we never insert a
   *  duplicate row. */
  existingProducts: ExistingProductRef[];
}

export interface EnrichedBrandFields {
  description?: string | null;
  category?: string | null;
  country_of_origin?: string | null;
  founding_year?: number | null;
  parent_company?: string | null;
  website?: string | null;
}

export interface EnrichedCredential {
  /** FieldKey value or one of the new credential keys. */
  field_key: string;
  value: string | number | boolean | null;
  /** Public URL the value was sourced from. */
  source_url: string | null;
}

export interface EnrichedProduct extends CrawledProduct {
  /** Set when Claude maps this finding to an existing product_directory
   *  row. The endpoint skips creating a new row in that case. */
  matches_existing_id: string | null;
}

export type AwardMedalTier =
  | 'gold'
  | 'silver'
  | 'bronze'
  | 'platinum'
  | 'best_in_class'
  | 'master'
  | 'double_gold'
  | 'finalist'
  | 'winner'
  | 'other';

export interface EnrichedAward {
  awarding_body: string;
  award_name: string;
  medal_tier: AwardMedalTier | null;
  year: number | null;
  source_url: string | null;
  notes: string | null;
  /** id of an existing product the award applies to, or null for
   *  brand-level awards. The endpoint validates against the brand's
   *  product list before persisting. */
  matches_product_id: string | null;
}

export interface DeepEnrichResult {
  brand: EnrichedBrandFields;
  credentials: EnrichedCredential[];
  products: EnrichedProduct[];
  documents: CrawledDocument[];
  awards: EnrichedAward[];
  /** Short narrative facts ("Carbon negative since 2019", "First B Corp
   *  distillery in Devon"). Brand-level. */
  notable_facts: string[];
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
const VALID_MEDALS = new Set<AwardMedalTier>([
  'gold',
  'silver',
  'bronze',
  'platinum',
  'best_in_class',
  'master',
  'double_gold',
  'finalist',
  'winner',
  'other',
]);

/**
 * Comprehensive single-brand enrichment using Claude with the
 * web_search tool. The prompt names authoritative sources for each
 * credential class (B Corp directory, Soil Association / USDA / OFG
 * for organic, Fairtrade / Rainforest Alliance / Carbon Trust, IWCA,
 * Porto Protocol, Ethical Consumer, Companies House, the brand's own
 * sustainability page) so the model knows where to look rather than
 * spraying the open web.
 *
 * Returns:
 *   - brand: free-form fields that go onto brand_directory directly
 *     (coalesce(new, existing) — alka**tera** values win where set,
 *     enrichment fills gaps)
 *   - credentials: typed findings written into scraped_brand_data
 *     with source_name='admin_deep_enrich' and high confidence
 *   - products: includes a matches_existing_id pointer when the
 *     finding refers to a product we already have on file, so the
 *     caller skips creating a dupe row
 *   - documents: PDFs the caller feeds into the existing pdf-ingester
 */
export async function deepEnrichBrand(args: DeepEnrichArgs): Promise<DeepEnrichResult> {
  const client = getClient();
  if (!client) {
    return EMPTY_RESULT({ error: 'ANTHROPIC_API_KEY not configured' });
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
    return EMPTY_RESULT({ error: `anthropic_error: ${message}` });
  }

  const parsed = extractJson(text);
  if (!parsed) {
    return EMPTY_RESULT({ error: 'model_returned_invalid_json' });
  }

  const fallbackSource = args.website ?? args.brandName;
  return {
    brand: sanitiseBrand(parsed.brand),
    credentials: sanitiseCredentials(parsed.credentials),
    products: sanitiseProducts(parsed.products, fallbackSource, args.existingProducts),
    documents: sanitiseDocuments(parsed.documents, fallbackSource),
    awards: sanitiseAwards(parsed.awards, args.existingProducts),
    notable_facts: sanitiseNotableFacts(parsed.notable_facts),
    summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
  };
}

function EMPTY_RESULT(extra: { error?: string }): DeepEnrichResult {
  return {
    brand: {},
    credentials: [],
    products: [],
    documents: [],
    awards: [],
    notable_facts: [],
    ...extra,
  };
}

function buildPrompt(args: DeepEnrichArgs): string {
  const ctx: string[] = [`Brand name: ${args.brandName}.`];
  if (args.website) ctx.push(`Website: ${args.website}.`);
  if (args.country) ctx.push(`Country: ${args.country}.`);
  if (args.category) ctx.push(`Category: ${args.category}.`);

  const known: string[] = [];
  if (args.existingBrand.description) known.push(`- We already have a description on file.`);
  if (args.existingBrand.founding_year) known.push(`- Founded: ${args.existingBrand.founding_year}.`);
  if (args.existingBrand.parent_company) known.push(`- Parent company: ${args.existingBrand.parent_company}.`);

  const products = args.existingProducts.length > 0
    ? args.existingProducts.map((p) => `  - id "${p.id}": ${p.name}`).join('\n')
    : '  (none — we have no products on file yet)';

  return `You are completing alka**tera**'s sustainability profile for the drinks brand below. Use the web_search tool extensively. Cite a URL for every fact you return.

${ctx.join('\n')}

What we already know:
${known.length > 0 ? known.join('\n') : '  - Almost nothing — please fill the gaps.'}

Products already on file for this brand:
${products}

Sources to consult (don't limit yourself to these, but always check the relevant ones for each credential):
  - The brand's own website (about / sustainability / impact pages)
  - bcorporation.net find-a-b-corp directory (for B Corp status + year)
  - Soil Association soilassociation.org and ofgorganic.org (UK organic certifiers)
  - USDA Organic Integrity Database (US organic)
  - fairtrade.org.uk (Fairtrade)
  - rainforest-alliance.org find-certified
  - carbontrust.com certifications
  - wineriesforclimateaction.org (IWCA — wineries only)
  - portoprotocol.com signatory list (Porto Protocol — wineries only)
  - ethicalconsumer.org, ethicalsuperstore.com, ethicalshop.co.uk (ethical-shopping ratings)
  - sciencebasedtargets.org companies-taking-action (SBT status)
  - find-and-update.company-information.service.gov.uk (UK Companies House — founding year, parent company, registration number)
  - LinkedIn / official press releases for parent-company / acquisition details
  - The brand's published sustainability / impact / ESG / EPD / LCA PDFs

Output ONE JSON object and NOTHING else (no markdown, no commentary):

{
  "summary": "1-2 sentence note on what you searched and the highest-value things you found.",
  "brand": {
    "description": "2-3 sentence overview leading with the sustainability story. British English. No em dashes. null if you can't write a good one.",
    "category": "spirits | wine | beer | non_alc | other",
    "country_of_origin": "ISO-2 code (e.g. GB, FR) or full country name",
    "founding_year": 2018,
    "parent_company": "owning group, or null if independent",
    "website": "https://… canonical brand website, or null if it's the same as the one above"
  },
  "credentials": [
    { "field_key": "bcorp_certified",                "value": true,    "source_url": "https://www.bcorporation.net/..." },
    { "field_key": "organic_certified",              "value": false,   "source_url": null },
    { "field_key": "fairtrade_certified",            "value": false,   "source_url": null },
    { "field_key": "rainforest_alliance_certified",  "value": false,   "source_url": null },
    { "field_key": "carbon_trust_certified",         "value": false,   "source_url": null },
    { "field_key": "iso_14001_certified",            "value": false,   "source_url": null },
    { "field_key": "iso_50001_certified",            "value": false,   "source_url": null },
    { "field_key": "iwca_member",                    "value": false,   "source_url": null },
    { "field_key": "porto_protocol_signatory",       "value": false,   "source_url": null },
    { "field_key": "sbt_status",                     "value": "committed", "source_url": "https://sciencebasedtargets.org/..." },
    { "field_key": "net_zero_target_year",           "value": 2030,    "source_url": "..." },
    { "field_key": "carbon_intensity_kgco2e_per_litre", "value": 1.2,  "source_url": "..." },
    { "field_key": "scope_1_tco2e",                  "value": 42,      "source_url": "..." },
    { "field_key": "scope_2_tco2e",                  "value": 17,      "source_url": "..." },
    { "field_key": "scope_3_tco2e",                  "value": 320,     "source_url": "..." },
    { "field_key": "water_usage_litres_per_litre",   "value": 3.4,     "source_url": "..." },
    { "field_key": "recycled_packaging_percentage",  "value": 100,     "source_url": "..." },
    { "field_key": "packaging_primary_material",     "value": "glass", "source_url": "..." },
    { "field_key": "sustainability_report_url",      "value": "https://…", "source_url": "..." },
    { "field_key": "sustainability_report_year",     "value": 2024,    "source_url": "..." },
    { "field_key": "contact_email",                  "value": "sustainability@...", "source_url": "..." },
    { "field_key": "company_registration_number",    "value": "12345678", "source_url": "..." }
  ],
  "products": [
    {
      "name": "Lightly Spiced Rum 70cl",
      "category": "spirits",
      "abv": 40.0,
      "container_size_ml": 700,
      "container_format": "bottle",
      "matches_existing_id": "uuid-of-the-row-this-refers-to-or-null"
    }
  ],
  "documents": [
    { "url": "https://…/lightly-spiced-rum-epd.pdf", "title": "Two Drifters Lightly Spiced Rum EPD", "kind": "epd" }
  ],
  "awards": [
    {
      "awarding_body": "International Wine & Spirit Competition",
      "award_name": "Gold — Spiced Rum",
      "medal_tier": "gold",
      "year": 2024,
      "source_url": "https://www.iwsc.net/...",
      "notes": "Optional 1-line context",
      "matches_product_id": "uuid-of-the-product-this-award-belongs-to-or-null"
    }
  ],
  "notable_facts": [
    "Carbon negative since 2019",
    "First B Corp rum distillery in the UK",
    "All bottles use 100% British glass"
  ]
}

Award sources to search: IWSC (iwsc.net), International Spirits Challenge (internationalspiritschallenge.com), San Francisco World Spirits Competition (sfwsc.com), World Whisky Awards, World Gin Awards, World Wine Awards, Decanter (decanter.com), Wine Spectator, Wine Enthusiast, World Beer Awards, Beverage Testing Institute, The Drinks Business awards, The Spirits Business awards. Cite a URL for every award.

Notable facts guidance: short, verifiable, sustainability- or provenance-relevant. Skip marketing puffery ("the best gin in the world"). Good examples: "Carbon negative since 2019", "First B Corp distillery in Devon", "100% British glass packaging", "Partnered with Cool Earth for rainforest protection". 1-6 facts. Skip the section if you can't find any.

Hard rules:
- "credentials" is mandatory in the response. You MUST include every certification you mention in the summary as a credential row (with field_key + value + source_url). The credentials array IS the source of truth for the certifications panel — if you write "B Corp certified" in the summary but omit it from credentials, the platform records no certification.
- Include a credential row for any certification you verified (positive OR negative). The credentials section is how this brand earns its score; do not skip it.
- Every credential must have a source_url EXCEPT a clean negative (value=false with no URL means "I checked and could not find evidence of certification"); only include the negative if you actually looked.
- For booleans, "value" must be true or false (JSON), not strings.
- For "sbt_status", value must be one of 'committed', 'targets_set', 'none'.
- For numeric fields, value must be a number, not a string. No units, no commas.
- "container_size_ml": 70cl = 700, 1L = 1000.
- Products: "matches_existing_id" must be one of the ids listed above (when the finding refers to the same product) or null (when it's genuinely new). When in doubt about size variants, prefer to MATCH rather than CREATE — operations can split later if needed.
- Documents: include URLs you can verify lead to a PDF. The direct .pdf URL is best, but cloud-share links to PDFs (Dropbox, Google Drive, OneDrive) are also accepted — paste the sharing URL verbatim, the platform handles the redirect to the file bytes. Do NOT include landing pages that merely link to PDFs; chase the actual PDF URL.
- Awards: every award must cite an authoritative source URL. Skip rumour. "matches_product_id" must be one of the existing-product ids above (when the award is for that specific SKU) or null (brand-level award). When unsure, prefer null.
- Notable facts: short single-line strings. Verifiable. No em dashes.
- British English.`;
}

function extractJson(text: string): {
  summary?: unknown;
  brand?: unknown;
  credentials?: unknown;
  products?: unknown;
  documents?: unknown;
  awards?: unknown;
  notable_facts?: unknown;
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

function sanitiseBrand(input: unknown): EnrichedBrandFields {
  if (!input || typeof input !== 'object') return {};
  const b = input as Record<string, unknown>;
  const out: EnrichedBrandFields = {};
  const desc = str(b.description);
  if (desc) out.description = desc;
  const cat = str(b.category);
  if (cat && VALID_CATEGORY.has(cat)) out.category = cat;
  const country = str(b.country_of_origin);
  if (country) out.country_of_origin = country;
  const founding = num(b.founding_year);
  if (founding && founding >= 1500 && founding <= new Date().getFullYear() + 1) {
    out.founding_year = Math.round(founding);
  }
  const parent = str(b.parent_company);
  if (parent) out.parent_company = parent;
  const website = str(b.website);
  if (website && /^https?:\/\//i.test(website)) out.website = website;
  return out;
}

const KNOWN_CREDENTIAL_KEYS = new Set([
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
  'water_stress_region',
  'water_recycled_percentage',
  'recycled_packaging_percentage',
  'packaging_primary_material',
  'sustainability_report_url',
  'sustainability_report_year',
  'iwca_member',
  'porto_protocol_signatory',
  'company_registration_number',
  'contact_email',
]);

function sanitiseCredentials(input: unknown): EnrichedCredential[] {
  if (!Array.isArray(input)) return [];
  const out: EnrichedCredential[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const fieldKey = str(r.field_key);
    if (!fieldKey || !KNOWN_CREDENTIAL_KEYS.has(fieldKey)) continue;
    if (seen.has(fieldKey)) continue;
    seen.add(fieldKey);
    const value = sanitiseCredentialValue(fieldKey, r.value);
    if (value === undefined) continue;
    const sourceUrl = str(r.source_url);
    out.push({
      field_key: fieldKey,
      value,
      source_url: sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : null,
    });
  }
  return out;
}

function sanitiseCredentialValue(key: string, raw: unknown): string | number | boolean | null | undefined {
  const isBoolean =
    key.endsWith('_certified') ||
    key === 'iwca_member' ||
    key === 'porto_protocol_signatory' ||
    key === 'water_stress_region';
  if (isBoolean) {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') {
      if (raw === 1) return true;
      if (raw === 0) return false;
    }
    if (typeof raw === 'string') {
      const v = raw.trim().toLowerCase();
      if (v === 'true' || v === 'yes' || v === '1') return true;
      if (v === 'false' || v === 'no' || v === '0') return false;
    }
    return undefined;
  }
  if (key === 'sbt_status') {
    const v = str(raw)?.toLowerCase();
    if (v === 'committed' || v === 'targets_set' || v === 'none') return v;
    return undefined;
  }
  if (key === 'sustainability_report_url') {
    const v = str(raw);
    if (v && /^https?:\/\//i.test(v)) return v;
    return undefined;
  }
  if (
    key === 'organic_percentage' ||
    key === 'carbon_intensity_kgco2e_per_litre' ||
    key === 'scope_1_tco2e' ||
    key === 'scope_2_tco2e' ||
    key === 'scope_3_tco2e' ||
    key === 'net_zero_target_year' ||
    key === 'water_usage_litres_per_litre' ||
    key === 'water_recycled_percentage' ||
    key === 'recycled_packaging_percentage' ||
    key === 'sustainability_report_year'
  ) {
    const n = num(raw);
    if (n !== null && Number.isFinite(n)) return n;
    return undefined;
  }
  // string-ish: contact_email, company_registration_number,
  // packaging_primary_material.
  const v = str(raw);
  return v ?? undefined;
}

function sanitiseProducts(
  input: unknown,
  fallbackSourceUrl: string,
  existingProducts: ExistingProductRef[],
): EnrichedProduct[] {
  if (!Array.isArray(input)) return [];
  const validExistingIds = new Set(existingProducts.map((p) => p.id));
  const out: EnrichedProduct[] = [];
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
    const matchesIdRaw = str(r.matches_existing_id);
    const matchesId = matchesIdRaw && validExistingIds.has(matchesIdRaw) ? matchesIdRaw : null;
    out.push({
      name,
      category: cat && VALID_CATEGORY.has(cat) ? cat : null,
      abv: num(r.abv),
      container_size_ml: num(r.container_size_ml),
      container_format: fmt && VALID_FORMAT.has(fmt) ? fmt : null,
      source_url: fallbackSourceUrl,
      matches_existing_id: matchesId,
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

function sanitiseAwards(input: unknown, existingProducts: ExistingProductRef[]): EnrichedAward[] {
  if (!Array.isArray(input)) return [];
  const validProductIds = new Set(existingProducts.map((p) => p.id));
  const out: EnrichedAward[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const awardingBody = str(r.awarding_body);
    const awardName = str(r.award_name);
    if (!awardingBody || !awardName) continue;
    const year = num(r.year);
    const productIdRaw = str(r.matches_product_id);
    const productId = productIdRaw && validProductIds.has(productIdRaw) ? productIdRaw : null;
    const key = `${productId ?? ''}|${awardingBody.toLowerCase()}|${awardName.toLowerCase()}|${year ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const medalRaw = str(r.medal_tier)?.toLowerCase();
    const medal = medalRaw && VALID_MEDALS.has(medalRaw as AwardMedalTier)
      ? (medalRaw as AwardMedalTier)
      : null;
    const sourceUrl = str(r.source_url);
    out.push({
      awarding_body: awardingBody,
      award_name: awardName,
      medal_tier: medal,
      year: year && year > 1900 && year < 2100 ? Math.round(year) : null,
      source_url: sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : null,
      notes: str(r.notes),
      matches_product_id: productId,
    });
  }
  return out;
}

function sanitiseNotableFacts(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const tokenSets: Set<string>[] = [];
  for (const raw of input) {
    const v = str(raw);
    if (!v) continue;
    const trimmed = v.replace(/\s+/g, ' ').trim();
    if (!trimmed || trimmed.length > 200) continue;
    const tokens = tokenisefact(trimmed);
    if (tokens.size === 0) continue;
    if (tokenSets.some((existing) => factsAreSimilar(existing, tokens))) continue;
    tokenSets.push(tokens);
    out.push(trimmed);
    if (out.length >= 4) break;
  }
  return out;
}

/** Same dedup logic but compared against a *pre-existing* set of facts
 *  (e.g. brand_directory.notable_facts already in the DB) so the caller
 *  can drop incoming items that are near-dupes of stored ones. */
export function dedupeAgainstExisting(incoming: string[], existing: string[]): string[] {
  const existingTokens = existing.map(tokenisefact);
  const out: string[] = [];
  const acceptedTokens: Set<string>[] = [];
  for (const fact of incoming) {
    const tokens = tokenisefact(fact);
    if (tokens.size === 0) continue;
    if (existingTokens.some((t) => factsAreSimilar(t, tokens))) continue;
    if (acceptedTokens.some((t) => factsAreSimilar(t, tokens))) continue;
    acceptedTokens.push(tokens);
    out.push(fact);
  }
  return out;
}

const STOP_WORDS = new Set([
  'a','an','the','of','with','and','or','for','in','on','at','by','to','is','was','has','have',
  'that','this','its','it','itss','more','than','as','from','our','their','they','our','we',
  'us','be','been','being','are','were','one','first','via','using','use','uses','also','any',
  'all','some','very','only','even','just','well','these','those','through','across','about',
  'made','make','makes','since','over','under','between','into','onto','out','up','down','off',
]);

/** Tokenise a fact for token-Jaccard similarity comparison. Lowercase,
 *  strip non-alphanumerics, drop stop-words and very short tokens, then
 *  collapse to a set. "B Corp certified with score 89.8" and
 *  "B Corp certified, score 89.8 vs median 50.9" share enough core
 *  tokens (bcorp, corp, certified, score, 898) to hit Jaccard ≥ 0.45.
 *  Numbers stay as tokens — the 89.8 anchor catches B-Impact-score
 *  variants. */
function tokenisefact(fact: string): Set<string> {
  const tokens = fact
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

/** Anchor concepts: distinctive terms that, when present in both facts,
 *  mark them as restatements of the same underlying claim. Two flavours:
 *
 *  - `required`: every listed token must appear on both sides. Used
 *    for multi-word concepts where individual words are too generic
 *    (e.g. "carbon" + "negative" — either alone is common).
 *  - `any`: at least one token from the group must appear on both
 *    sides. Used for distinctive single-word concepts and synonyms.
 *
 *  Used in addition to Jaccard similarity. Catches different prose
 *  forms ("Certified B Corp with score 89.8" vs "B Corp in Jan 2022")
 *  that Jaccard would miss because the supporting prose differs.
 */
const FACT_ANCHORS: Array<{ id: string; required?: string[]; any?: string[] }> = [
  // B Corp variants — "bcorp" / "corp" / "corporation" are all
  // distinctive enough to anchor when shared between two facts.
  { id: 'bcorp', any: ['bcorp', 'corp', 'corporation'] },
  // Climeworks + Carbfix — both proper nouns, very unique.
  { id: 'climeworks_carbfix', any: ['climeworks', 'carbfix'] },
  // EPD acronym is unique on its own.
  { id: 'epd', any: ['epd'] },
  // "Carbon negative" requires BOTH words — "carbon" alone is common
  // (carbon intensity, carbon trust), as is "negative".
  { id: 'carbon_negative', required: ['carbon', 'negative'] },
];

function sharesAnchor(a: Set<string>, b: Set<string>): boolean {
  for (const anchor of FACT_ANCHORS) {
    const matches = (s: Set<string>) => {
      if (anchor.required && !anchor.required.every((t) => s.has(t))) return false;
      if (anchor.any && !anchor.any.some((t) => s.has(t))) return false;
      return true;
    };
    if (matches(a) && matches(b)) return true;
  }
  return false;
}

/** Combined similarity test: Jaccard >= 0.30 OR they share a named
 *  anchor concept. The anchor list catches "B Corp" / "EPD" / "Carbon
 *  negative" variants that diverge in supporting prose but mean the
 *  same thing. Jaccard catches everything else. */
function factsAreSimilar(a: Set<string>, b: Set<string>): boolean {
  return jaccardSimilarity(a, b) >= 0.3 || sharesAnchor(a, b);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const t of Array.from(a)) if (b.has(t)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
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
    const n = parseFloat(v.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
