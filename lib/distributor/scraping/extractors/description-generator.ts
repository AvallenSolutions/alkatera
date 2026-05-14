import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 600;

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export interface DescriptionArgs {
  brandName: string;
  /** Plain-text corpus assembled from the brand's crawled pages. */
  corpus: string;
}

export interface DescriptionResult {
  description: string | null;
  error?: string;
}

/**
 * Generate a short, defensible brand overview from the corpus we
 * crawled. Distinct from the structured-field extractor — this returns
 * prose, not JSON.
 *
 * Constraints baked into the prompt:
 *   - 2–3 paragraphs max
 *   - Only claims supported by the source text (no invention)
 *   - Leads with what the brand makes, then folds in sustainability
 *   - Never makes a numeric claim (those belong in structured fields)
 *   - Returns the literal string 'INSUFFICIENT_DATA' when there's
 *     nothing meaningful to say, which we map to no finding.
 */
export async function generateCompanyDescription(
  args: DescriptionArgs,
): Promise<DescriptionResult> {
  const client = getClient();
  if (!client) return { description: null, error: 'ANTHROPIC_API_KEY not configured' };

  const trimmed = args.corpus.trim();
  if (!trimmed) return { description: null, error: 'no_corpus' };

  const prompt = `You are writing a short, factual overview of a drinks-industry brand for a sustainability data portal.

Brand: ${args.brandName}

Source text (concatenated from the brand's own website pages):
"""
${trimmed.slice(0, 16000)}
"""

Write a 2–3 paragraph overview of this brand, with these rules:
- Start with what they make and where (one or two sentences).
- The remaining paragraph(s) MUST focus on their sustainability story: certifications, practices, commitments, partnerships, environmental philosophy.
- Only state facts you can support from the source text above. Do not invent figures, dates, or claims.
- Never include numeric values (carbon footprints, percentages, years). Those are tracked separately as structured fields.
- Plain prose. No markdown, no bullet points, no headings.
- 100–250 words total.
- If the source text doesn't have enough material for a credible overview (e.g. it's only nav/footer scraps), respond with exactly the single word INSUFFICIENT_DATA and nothing else.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });
    const first = response.content[0];
    const raw = first && first.type === 'text' ? first.text.trim() : '';
    if (!raw) return { description: null, error: 'empty_response' };
    if (raw === 'INSUFFICIENT_DATA' || raw.startsWith('INSUFFICIENT_DATA')) {
      return { description: null, error: 'insufficient_data' };
    }
    // Belt-and-braces: strip any code fences / markdown if the model
    // ignored the no-markdown rule.
    const cleaned = raw
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    return { description: cleaned };
  } catch (err: unknown) {
    return {
      description: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
