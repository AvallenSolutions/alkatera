import { getGeminiClient } from '@/lib/ai/gemini';
import { GEMINI_FAST_MODEL } from '@/lib/ai/models';
import { logGeminiUsage } from '@/lib/ai/usage-log';
import { mapWithConcurrency } from './concurrent-map';

export interface BrandExtraction {
  /** false for category headers / section labels / non-products. */
  is_product: boolean;
  /** Producer / brand / marque, or null when not a product. */
  brand: string | null;
  /** Product name with the brand + marketing tags stripped, or null. */
  product: string | null;
}

const BATCH_SIZE = 40;
const BATCH_CONCURRENCY = 4;

const SYSTEM = `You are cleaning a UK drinks distributor's product list where the brand is baked into the product name and there is no separate brand column.

For each numbered line decide:
- is_product: false if the line is a CATEGORY HEADER or section label (e.g. "Bitters", "Gin", "Rum", "Vodka", "Liqueurs - Giffard", "Ready to Drink", "No and Lo") or otherwise not a real sellable product; true for an actual product.
- brand: the producer / brand / marque (e.g. "Fee Brothers", "Nc'nean", "The English Whisky Co", "Giffard", "Chairman's Reserve", "Rhum Clement", "El Sueno"). null when is_product is false.
- product: the product name with the brand removed and marketing tags like "**Limited**" stripped (e.g. "Fee Brothers Aztec Chocolate Bitters" -> "Aztec Chocolate Bitters"). null when is_product is false.

Return ONLY a JSON array, one element per input line, each: {"index": <1-based line number>, "is_product": <boolean>, "brand": <string|null>, "product": <string|null>}.
No prose, no markdown. Do not invent brands you don't recognise — if unsure, use the leading word(s) that read like a brand. Never leave brand null when is_product is true.`;

async function extractBatch(
  apiKey: string,
  names: string[],
): Promise<BrandExtraction[]> {
  const client = getGeminiClient(apiKey);
  const model = client.getGenerativeModel({
    model: GEMINI_FAST_MODEL,
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 },
  });
  const numbered = names.map((n, i) => `${i + 1}. ${n}`).join('\n');
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: `${SYSTEM}\n\nLines:\n${numbered}` }] }],
  });
  logGeminiUsage('brand_detection', GEMINI_FAST_MODEL, result);
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Whole batch unparseable — fall back to "leading two words" per name so
    // the import still proceeds rather than failing.
    return names.map((n) => fallback(n));
  }
  const arr = Array.isArray(parsed) ? parsed : [];
  const out: BrandExtraction[] = names.map((n) => fallback(n));
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const idx = typeof rec.index === 'number' ? rec.index - 1 : -1;
    if (idx < 0 || idx >= names.length) continue;
    const isProduct = rec.is_product !== false;
    out[idx] = {
      is_product: isProduct,
      brand: isProduct ? coerceString(rec.brand) ?? fallback(names[idx]).brand : null,
      product: isProduct ? coerceString(rec.product) ?? names[idx] : null,
    };
  }
  return out;
}

function coerceString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Heuristic fallback when the model can't be reached or parsed. */
function fallback(name: string): BrandExtraction {
  const cleaned = name.replace(/\*\*[^*]*\*\*/g, '').trim();
  const words = cleaned.split(/\s+/);
  const brand = words.slice(0, 2).join(' ') || cleaned;
  const product = words.slice(2).join(' ') || cleaned;
  return { is_product: true, brand, product };
}

/**
 * Extract a brand + clean product name for each product-name string using
 * Gemini Flash. Dedupes inputs, batches them, and runs batches with bounded
 * concurrency. Returns a map keyed by the EXACT input string.
 *
 * Best-effort by design: if the API key is missing or a batch fails, those
 * names fall back to a leading-words heuristic so the import never blocks.
 */
export async function extractBrandsFromProductNames(
  names: string[],
  opts?: { onProgress?: (done: number, total: number) => Promise<void> | void },
): Promise<Map<string, BrandExtraction>> {
  const result = new Map<string, BrandExtraction>();
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter((n) => n.length > 0)));
  if (unique.length === 0) return result;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    for (const n of unique) result.set(n, fallback(n));
    return result;
  }

  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    batches.push(unique.slice(i, i + BATCH_SIZE));
  }

  let done = 0;
  await mapWithConcurrency(batches, BATCH_CONCURRENCY, async (batch) => {
    let extracted: BrandExtraction[];
    try {
      extracted = await extractBatch(apiKey, batch);
    } catch {
      extracted = batch.map((n) => fallback(n));
    }
    batch.forEach((name, i) => result.set(name, extracted[i] ?? fallback(name)));
    done += batch.length;
    await opts?.onProgress?.(done, unique.length);
  });

  return result;
}
