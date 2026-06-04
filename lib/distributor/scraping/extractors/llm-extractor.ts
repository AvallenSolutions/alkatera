import { htmlToText } from './html-to-text';
import { FIELD_DEFINITIONS, type FieldKey } from '../field-definitions';
import { runTextPrompt } from '@/lib/ai/gemini';

// 768 was eaten by Gemini 3.5 Flash's thinking budget on most brand
// sites, so the structured-field JSON came back truncated and most
// fields silently dropped. 8000 leaves headroom for thinking + the
// full JSON payload across all TARGET_FIELDS. See description-generator
// for the same fix and the SDK-version context.
const MAX_TOKENS = 8000;

export interface ExtractArgs {
  /** Raw HTML or plain text from the page. */
  content: string;
  /** True if `content` is already plain text. Skips HTML stripping. */
  isPlainText?: boolean;
  brandName: string;
  /** Which fields we want the model to look for. Subset of FieldKey. */
  fieldsToExtract: FieldKey[];
  /** Display name of the source — included in the prompt for context. */
  sourceName: string;
}

export interface ExtractResult {
  /** Per-field extracted values keyed by FieldKey. */
  values: Partial<Record<FieldKey, unknown>>;
  /** If the LLM call failed or wasn't configured. */
  error?: string;
}

/**
 * Ask claude-haiku to read a page and pull out structured sustainability
 * fields for the given brand. Returns only fields the model claims to
 * have evidence for; null/missing fields are dropped so we never write a
 * "no value" row.
 */
export async function extractFieldsFromContent(args: ExtractArgs): Promise<ExtractResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { values: {}, error: 'GEMINI_API_KEY not configured' };
  }

  const text = args.isPlainText ? args.content : htmlToText(args.content);
  if (!text.trim()) {
    return { values: {}, error: 'no extractable text in page' };
  }

  const fieldList = args.fieldsToExtract
    .map((key) => {
      const def = FIELD_DEFINITIONS.find((f) => f.key === key);
      if (!def) return null;
      const note = def.description ? ` — ${def.description}` : '';
      return `- ${key} (${def.type})${note}`;
    })
    .filter(Boolean)
    .join('\n');

  const prompt = `You are extracting sustainability data for a drinks brand from a webpage.

Brand: ${args.brandName}
Source: ${args.sourceName}

Fields to extract (use exactly these JSON keys, only include keys you found explicit evidence for):
${fieldList}

Evidence guide for the trickier signals (only use when you can quote supporting text — never guess):

- "epd_published": true if the page links to OR describes a published Environmental Product Declaration, Life Cycle Assessment, EPD, LCA, ISO 14025, or ISO 14044 document for the brand's product(s). The presence of a downloadable EPD/LCA PDF, or an explicit reference to having one, is enough.
- "carbon_negative_claim": true if the brand states they are carbon negative, climate positive, carbon-neutral net-negative, or similar. The claim needs to be the brand's own positioning (not aspirational language about a future target).
- "renewable_energy_percentage": a number 0-100. Look for "100% renewable", "all-electric distillery powered by solar/wind", "X% of energy from renewables". If the page says fully renewable / 100% renewable / all renewable without a number, use 100.
- "cdr_partnership": true if the brand has a named partnership with a permanent carbon-removal provider (Climeworks, Carbfix, Charm Industrial, Heirloom, Running Tide, Lithos, Equatic, or similar). Carbon-offset / forestry / reforestation purchases do NOT count.
- "sbt_status": "committed" if SBTi committed, "targets_set" if approved targets, "none" if explicitly disclaims, otherwise omit.
- "carbon_negative_claim" + "carbon_intensity_kgco2e_per_litre": if the page quotes a per-litre carbon intensity ≤ 0, fire both.
- "iwca_member": true ONLY for wine brands that name themselves as International Wineries for Climate Action members. Distillers / brewers should omit.
- "porto_protocol_signatory": same — wine industry only.
- "bcorp_certified": true if the page mentions B Corp / B Corporation / Certified B Corporation, including B Impact score, B Corp Month, etc.

Page text:
"""
${text}
"""

Rules:
- Return ONLY a JSON object. No markdown, no commentary.
- For boolean fields, return true/false.
- For "number" fields, return a JSON number (no units, no commas).
- For "year" fields, return a 4-digit integer.
- For "string" fields, return a short factual string (no marketing prose).
- OMIT any field you don't have explicit evidence for in the text above. Do NOT guess.
- If the page is clearly about a different brand, return {}.`;

  let raw: string;
  try {
    raw = await runTextPrompt({ apiKey, prompt, maxTokens: MAX_TOKENS, op: 'source_extract' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { values: {}, error: `gemini_error: ${message}` };
  }

  const parsed = safeParseJson(raw);
  if (!parsed) return { values: {}, error: 'model_returned_invalid_json' };
  return { values: parsed };
}

/**
 * Extract a JSON object from a model response that might be wrapped in
 * code fences or contain leading explanation. Returns null on any
 * structural failure rather than throwing.
 */
function safeParseJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  // Slice at the first { ... } block if the model returned prose around it.
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  const candidate = stripped.slice(start, end + 1);

  try {
    const value = JSON.parse(candidate);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
