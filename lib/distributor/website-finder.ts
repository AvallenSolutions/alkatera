import { runGroundedSearch } from '@/lib/ai/gemini';
import { mapWithConcurrency } from './concurrent-map';

export interface BrandWebsiteInput {
  id: string;
  name: string;
  country_of_origin?: string | null;
}

// Each grounded-search call (Google Search tool) reliably takes 40-60s, so
// wall-clock is dominated by how many *waves* of calls we run, not the work
// itself. Bigger batches = fewer (billed) requests AND fewer waves; higher
// concurrency collapses those waves. 245 brands at 24/batch = ~11 batches, all
// in flight at once with CONCURRENCY 12 — one wave (~1 min) instead of two.
// Retries (see findBatch) make the higher concurrency safe against rate limits.
const BATCH_SIZE = 24;
const BATCH_CONCURRENCY = 12;
// Each grounded call only needs a small JSON array back; cap output low so a
// chatty response can't stretch a call (and to keep output-token cost down).
const GROUNDED_MAX_TOKENS = 2048;
const MAX_ATTEMPTS = 3;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Turn a model-returned URL into a canonical https:// origin, or null if it
 * doesn't look like a real website. Mirrors the brand route's normaliser.
 */
function normaliseWebsite(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || /^null$/i.test(trimmed)) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes('.')) return null;
    return `${url.protocol}//${url.hostname}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return null;
  }
}

const PROMPT_HEAD = `You are finding the OFFICIAL website for drinks brands sold by a UK distributor.
For each brand below, search the web and return its official brand/producer website — the brand's own site, NOT a retailer, marketplace, wholesaler, Wikipedia, Amazon, or social media page. If you cannot confidently identify the official site, return null for that brand.

Return ONLY a JSON array (no markdown, no prose), one element per input line in order:
[{"index": <1-based number>, "website": "https://…" | null}]

Brands:`;

interface BatchResult {
  websites: Array<string | null>;
  /** A grounded-search call or parse failure, surfaced (not swallowed) so the
   *  caller can report WHY zero websites came back. */
  error?: string;
  /** First ~400 chars of the raw model response — the single most useful
   *  diagnostic when the model returns prose instead of the JSON array. */
  rawSample?: string;
}

async function findBatch(
  apiKey: string,
  brands: BrandWebsiteInput[],
): Promise<BatchResult> {
  const lines = brands
    .map((b, i) => `${i + 1}. ${b.name}${b.country_of_origin ? ` (${b.country_of_origin})` : ''}`)
    .join('\n');
  const prompt = `${PROMPT_HEAD}\n${lines}`;
  // Retry transient grounded-search failures (rate limits, timeouts) with a
  // short backoff so a single hiccup doesn't silently drop a whole batch of
  // brands to "no website" — which matters more now that we run more calls
  // concurrently.
  let text: string | null = null;
  let lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      text = await runGroundedSearch({ apiKey, prompt, maxTokens: GROUNDED_MAX_TOKENS });
      break;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[website-finder] grounded search attempt ${attempt}/${MAX_ATTEMPTS} failed:`, lastError);
      if (attempt < MAX_ATTEMPTS) await delay(attempt * 1500);
    }
  }
  if (text === null) {
    return { websites: brands.map(() => null), error: `grounded_search_error: ${lastError}` };
  }
  const rawSample = text.trim().slice(0, 400);
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  // Grounded responses sometimes wrap the array in prose; grab the array.
  const match = cleaned.match(/\[[\s\S]*\]/);
  let parsed: unknown;
  try {
    parsed = JSON.parse(match ? match[0] : cleaned);
  } catch {
    console.error('[website-finder] model returned unparseable JSON. Sample:', rawSample);
    return {
      websites: brands.map(() => null),
      error: 'model_returned_invalid_json',
      rawSample,
    };
  }
  const out: Array<string | null> = brands.map(() => null);
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const idx = typeof rec.index === 'number' ? rec.index - 1 : -1;
      if (idx >= 0 && idx < brands.length) out[idx] = normaliseWebsite(rec.website);
    }
  }
  return { websites: out, rawSample };
}

/**
 * Find official websites for brands that don't have one, using Gemini with
 * Google Search grounding. Batched + bounded-parallel. Best-effort: returns a
 * map of brand id → website (only entries we found); missing/uncertain brands
 * are simply absent. If the API key is missing, returns an empty map.
 */
export interface WebsiteFindResult {
  /** brand id → discovered website (only brands we actually found). */
  found: Map<string, string>;
  /** How many brands we attempted to look up. */
  attempted: number;
  /** Distinct failure reasons across batches (empty when everything worked). */
  errors: string[];
  /** Up to a few raw model-response samples — invaluable for diagnosing a run
   *  that finds nothing because the model isn't returning the expected JSON. */
  samples: string[];
  /** True when the GEMINI_API_KEY env var was missing at call time. */
  missingApiKey: boolean;
}

export async function findBrandWebsites(
  brands: BrandWebsiteInput[],
  opts?: {
    onProgress?: (done: number, total: number, found: number) => Promise<void> | void;
  },
): Promise<WebsiteFindResult> {
  const found = new Map<string, string>();
  const errors = new Set<string>();
  const samples: string[] = [];
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[website-finder] GEMINI_API_KEY is not set — cannot find websites.');
    return { found, attempted: brands.length, errors: ['missing_api_key'], samples, missingApiKey: true };
  }
  if (brands.length === 0) {
    return { found, attempted: 0, errors: [], samples, missingApiKey: false };
  }

  const batches: BrandWebsiteInput[][] = [];
  for (let i = 0; i < brands.length; i += BATCH_SIZE) {
    batches.push(brands.slice(i, i + BATCH_SIZE));
  }

  let done = 0;
  await mapWithConcurrency(batches, BATCH_CONCURRENCY, async (batch) => {
    const result = await findBatch(apiKey, batch);
    batch.forEach((b, i) => {
      const w = result.websites[i];
      if (w) found.set(b.id, w);
    });
    if (result.error) errors.add(result.error);
    if (result.rawSample && samples.length < 3) samples.push(result.rawSample);
    done += batch.length;
    await opts?.onProgress?.(done, brands.length, found.size);
  });

  return {
    found,
    attempted: brands.length,
    errors: Array.from(errors),
    samples,
    missingApiKey: false,
  };
}
