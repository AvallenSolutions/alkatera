import { runGroundedSearch } from '@/lib/ai/gemini';
import { mapWithConcurrency } from './concurrent-map';

export interface BrandWebsiteInput {
  id: string;
  name: string;
  country_of_origin?: string | null;
}

const BATCH_SIZE = 8;
const BATCH_CONCURRENCY = 4;

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

async function findBatch(
  apiKey: string,
  brands: BrandWebsiteInput[],
): Promise<Array<string | null>> {
  const lines = brands
    .map((b, i) => `${i + 1}. ${b.name}${b.country_of_origin ? ` (${b.country_of_origin})` : ''}`)
    .join('\n');
  let text: string;
  try {
    text = await runGroundedSearch({ apiKey, prompt: `${PROMPT_HEAD}\n${lines}` });
  } catch {
    return brands.map(() => null);
  }
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  // Grounded responses sometimes wrap the array in prose; grab the array.
  const match = cleaned.match(/\[[\s\S]*\]/);
  let parsed: unknown;
  try {
    parsed = JSON.parse(match ? match[0] : cleaned);
  } catch {
    return brands.map(() => null);
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
  return out;
}

/**
 * Find official websites for brands that don't have one, using Gemini with
 * Google Search grounding. Batched + bounded-parallel. Best-effort: returns a
 * map of brand id → website (only entries we found); missing/uncertain brands
 * are simply absent. If the API key is missing, returns an empty map.
 */
export async function findBrandWebsites(
  brands: BrandWebsiteInput[],
  opts?: { onProgress?: (done: number, total: number) => Promise<void> | void },
): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || brands.length === 0) return found;

  const batches: BrandWebsiteInput[][] = [];
  for (let i = 0; i < brands.length; i += BATCH_SIZE) {
    batches.push(brands.slice(i, i + BATCH_SIZE));
  }

  let done = 0;
  await mapWithConcurrency(batches, BATCH_CONCURRENCY, async (batch) => {
    const websites = await findBatch(apiKey, batch);
    batch.forEach((b, i) => {
      const w = websites[i];
      if (w) found.set(b.id, w);
    });
    done += batch.length;
    await opts?.onProgress?.(done, brands.length);
  });

  return found;
}
