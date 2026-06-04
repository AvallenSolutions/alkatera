import { runJsonPrompt } from '@/lib/ai/gemini';
import { KNOWN_PRODUCT_CATEGORIES } from '@/lib/industry-benchmarks';

/**
 * AI product-category detection for brands that have no declared
 * category. The category drives the category-adjusted carbon / water
 * benchmarks in the scorer (gin vs wine vs beer have very different
 * baselines), so backfilling it materially improves scoring accuracy.
 *
 * Constrained to the closed set of {@link KNOWN_PRODUCT_CATEGORIES} —
 * the model must pick one of our recognised categories or return null,
 * and we validate its answer against the set before trusting it.
 *
 * Non-blocking by design: when `GEMINI_API_KEY` is unset, there's no
 * usable context, or the call fails, it returns `{ category: null }`
 * and the caller falls back to the industry-average benchmark. Category
 * detection must never break a score recalculation.
 */
export async function detectBrandCategory(args: {
  brandName: string;
  description: string | null;
  skuNames: string[];
}): Promise<{ category: string | null; confidence: 'detected' | 'low' }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { category: null, confidence: 'low' };

  const context = [
    args.description ?? '',
    ...args.skuNames,
  ]
    .filter((s) => s && s.trim())
    .join('\n')
    .slice(0, 2000);

  // Need at least a name plus *some* signal to make a sensible call.
  if (!args.brandName.trim() || !context.trim()) {
    return { category: null, confidence: 'low' };
  }

  const prompt = `You categorise drinks brands by their primary product type.

Brand: ${args.brandName}

Context (description and/or product names):
"""
${context}
"""

Choose the SINGLE best-fitting category for this brand's primary product
from this exact list:
${KNOWN_PRODUCT_CATEGORIES.join(', ')}

Rules:
- Return ONLY a JSON object: {"category": "Gin"} using a value copied
  verbatim from the list above.
- If the product type is genuinely unclear, return {"category": null}.
- Do not invent categories that aren't in the list.`;

  try {
    const res = await runJsonPrompt<{ category: string | null }>({
      apiKey,
      prompt,
      op: 'category-detect',
      maxTokens: 64,
    });
    const category = res?.category;
    if (category && KNOWN_PRODUCT_CATEGORIES.includes(category)) {
      return { category, confidence: 'detected' };
    }
    return { category: null, confidence: 'low' };
  } catch {
    return { category: null, confidence: 'low' };
  }
}
