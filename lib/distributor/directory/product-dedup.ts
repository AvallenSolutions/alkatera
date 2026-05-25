import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  findProductMatch,
  resolveOrCreateProductEntry,
  type ProductMatchInput,
  type ProductMatchResult,
} from './product-matcher';
import { normalizeProductName } from '../brand-normalizer';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 400;
const LLM_CHECK_THRESHOLD_PRODUCTS = 100; // Skip LLM if a brand has more products than this — would balloon prompts.

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export interface SmartMatchInput extends ProductMatchInput {
  /** Used to strip the brand prefix from candidate + existing names
   *  before the LLM verification step ("Two Drifters White Rum" vs
   *  "Pure White Rum" both reduce to recognisably similar candidates). */
  brandName?: string | null;
  /** Optional context the LLM uses to disambiguate same-name variants. */
  abv?: number | null;
  containerSizeMl?: number | null;
  containerFormat?: string | null;
}

export interface SmartMatchOptions {
  discoveredByDistributorOrgId?: string | null;
  discoveredVia?: 'sku_upload' | 'alkatera_signup' | 'manual' | 'phase1_backfill';
  /** Disable the LLM verification step (e.g. for batch ingest paths
   *  that prefer to fail fast and let admin sweep handle dedup later). */
  skipLlm?: boolean;
}

export interface SmartProductMatchResult extends ProductMatchResult {
  /** True when the LLM verification step mapped this candidate onto an
   *  existing product the standard matcher missed. */
  llmDeduped?: boolean;
}

interface ExistingProductRow {
  id: string;
  name: string;
  gtin: string | null;
  category: string | null;
}

/**
 * In-process cache of "existing products for brand X" so a single
 * batch (e.g. a brand-agent run persisting 6 products from a crawl)
 * fetches the list once instead of six times. Per-request — exported
 * helper to clear when needed (tests).
 */
const brandProductsCache = new Map<string, Promise<ExistingProductRow[]>>();

export function clearProductDedupCache(): void {
  brandProductsCache.clear();
}

async function loadExistingProducts(
  supabase: SupabaseClient,
  brandDirectoryId: string,
): Promise<ExistingProductRow[]> {
  const cached = brandProductsCache.get(brandDirectoryId);
  if (cached) return cached;
  const promise = (async () => {
    const { data } = await supabase
      .from('product_directory')
      .select('id, name, gtin, category')
      .eq('brand_directory_id', brandDirectoryId)
      .order('name');
    return ((data ?? []) as ExistingProductRow[]);
  })();
  brandProductsCache.set(brandDirectoryId, promise);
  return promise;
}

/**
 * Resolve a product to a product_directory entry, with three layers of
 * dedup:
 *
 *   1. The standard matcher (GTIN exact → name exact/alias/fuzzy ≥0.85).
 *      Catches the easy cases without any LLM cost.
 *   2. LLM verification: when the standard matcher misses but the
 *      brand already has products on file, ask Claude Haiku whether
 *      the candidate refers to one of them. Cheap (~$0.0001/call)
 *      and accurate for the cases where names diverge structurally
 *      ("Pure White Rum 70cl" vs "Two Drifters White Rum 70cl").
 *   3. Insert as new.
 *
 * Use this wrapper in every product-ingest path. The plain
 * resolveOrCreateProductEntry is still available for tests + flows
 * that need to skip the LLM step on purpose.
 */
export async function resolveOrCreateProductEntrySmart(
  supabase: SupabaseClient,
  input: SmartMatchInput,
  options: SmartMatchOptions = {},
): Promise<SmartProductMatchResult> {
  // Pass 1: standard matcher.
  const standard = await findProductMatch(supabase, {
    brandDirectoryId: input.brandDirectoryId,
    displayName: input.displayName,
    gtin: input.gtin,
  });
  if (standard) {
    return {
      productDirectoryId: standard.productDirectoryId,
      canonicalName: standard.canonicalName,
      similarity: standard.similarity,
      matchVia: standard.matchVia,
      created: false,
    };
  }

  // Pass 2: LLM verification.
  if (!options.skipLlm) {
    const existing = await loadExistingProducts(supabase, input.brandDirectoryId);
    if (existing.length > 0 && existing.length <= LLM_CHECK_THRESHOLD_PRODUCTS) {
      const llmMatch = await llmCheckProductMatch({
        candidate: {
          name: input.displayName,
          abv: input.abv ?? null,
          container_size_ml: input.containerSizeMl ?? null,
          container_format: input.containerFormat ?? null,
        },
        brandName: input.brandName ?? '',
        existing,
      });
      if (llmMatch && llmMatch.matches_existing_id) {
        const matched = existing.find((p) => p.id === llmMatch.matches_existing_id);
        if (matched) {
          return {
            productDirectoryId: matched.id,
            canonicalName: matched.name,
            similarity: llmMatch.confidence,
            matchVia: 'fuzzy',
            created: false,
            llmDeduped: true,
          };
        }
      }
    }
  }

  // Pass 3: insert as new (delegates to the standard helper so the
  // normalised_name + discovered_via stamps stay consistent).
  const created = await resolveOrCreateProductEntry(supabase, {
    brandDirectoryId: input.brandDirectoryId,
    displayName: input.displayName,
    gtin: input.gtin,
    category: input.category,
    discoveredByDistributorOrgId: options.discoveredByDistributorOrgId,
    discoveredVia: options.discoveredVia,
  });

  // Invalidate the brand's cache so subsequent calls within this run
  // see the just-inserted product.
  brandProductsCache.delete(input.brandDirectoryId);

  return created;
}

interface LlmCheckArgs {
  candidate: {
    name: string;
    abv: number | null;
    container_size_ml: number | null;
    container_format: string | null;
  };
  brandName: string;
  existing: ExistingProductRow[];
}

interface LlmCheckResult {
  matches_existing_id: string | null;
  confidence: number;
  reason?: string;
}

async function llmCheckProductMatch(args: LlmCheckArgs): Promise<LlmCheckResult | null> {
  const client = getClient();
  if (!client) return null;

  const candidateNorm = normalizeProductName(args.candidate.name);
  // Pre-filter: if the candidate's normalised name (after the existing
  // normaliser) is identical to any existing product's normalised
  // name, the standard matcher would already have caught it — skip
  // the LLM. Otherwise we keep the LLM list small by truncating to
  // the top-30 candidates (ordered by shared-tokens count as a cheap
  // pre-rank), so the prompt doesn't bloat on big brands.
  const sharedTokenRank = (existing: ExistingProductRow): number => {
    const a = new Set(candidateNorm.split(/\s+/));
    const b = normalizeProductName(existing.name).split(/\s+/);
    let hits = 0;
    for (const token of b) {
      if (a.has(token)) hits += 1;
    }
    return hits;
  };
  const ranked = args.existing
    .map((e) => ({ row: e, score: sharedTokenRank(e) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map((r) => r.row);
  if (ranked.length === 0) return null;

  const candidateLine = formatLine({
    name: args.candidate.name,
    abv: args.candidate.abv,
    size: args.candidate.container_size_ml,
    format: args.candidate.container_format,
  });
  const existingLines = ranked
    .map((e) => `  - id "${e.id}": ${e.name}${e.gtin ? ` (GTIN ${e.gtin})` : ''}`)
    .join('\n');

  const prompt = `You are checking whether a new product candidate is the same SKU as one we already have on file for the brand "${args.brandName || '(unknown brand)'}". Same SKU = same product, same size. Different size of the same liquid is a DIFFERENT SKU. Different blend, edition or flavour is a DIFFERENT SKU.

Candidate:
${candidateLine}

Products already on file for this brand:
${existingLines}

Return ONE JSON object and NOTHING else:

{
  "matches_existing_id": "uuid-of-the-existing-row-this-refers-to-or-null",
  "confidence": 0.95,
  "reason": "Short note. e.g. 'Brand prefix differs but the variant + size are the same.'"
}

Rules:
- Use the id verbatim from the list above. Null if the candidate is genuinely new.
- Be conservative: when in doubt, return null. Creating a separate row is recoverable; merging accidentally is not.
- Differences in brand prefix ("Two Drifters White Rum" vs "White Rum") DO NOT prevent a match.
- Differences in size (70cl vs 1L) DO prevent a match.
- "confidence" 0..1 — only return >=0.8 when you're confident.`;

  let text = '';
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });
    for (const block of response.content) {
      if (block.type === 'text') text += block.text + '\n';
    }
  } catch {
    return null;
  }

  const parsed = extractJson(text);
  if (!parsed) return null;
  const id = typeof parsed.matches_existing_id === 'string' ? parsed.matches_existing_id.trim() : null;
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
  if (!id || id.toLowerCase() === 'null') return { matches_existing_id: null, confidence };
  // Only act if confidence is high.
  if (confidence < 0.8) return { matches_existing_id: null, confidence };
  return { matches_existing_id: id, confidence, reason: typeof parsed.reason === 'string' ? parsed.reason : undefined };
}

function formatLine(input: {
  name: string;
  abv: number | null;
  size: number | null;
  format: string | null;
}): string {
  const parts: string[] = [input.name];
  if (input.size != null) parts.push(`${input.size}ml`);
  if (input.abv != null) parts.push(`${input.abv}% ABV`);
  if (input.format) parts.push(input.format);
  return parts.join(' · ');
}

function extractJson(text: string): {
  matches_existing_id?: unknown;
  confidence?: unknown;
  reason?: unknown;
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
