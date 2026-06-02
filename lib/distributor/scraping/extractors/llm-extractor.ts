import Anthropic from '@anthropic-ai/sdk';
import { htmlToText } from './html-to-text';
import { FIELD_DEFINITIONS, type FieldKey } from '../field-definitions';
import { logClaudeUsage } from '@/lib/ai/usage-log';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 768;

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

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
  const client = getClient();
  if (!client) {
    return { values: {}, error: 'ANTHROPIC_API_KEY not configured' };
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
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });
    logClaudeUsage('source_extract', MODEL, response);
    const first = response.content[0];
    raw = first && first.type === 'text' ? first.text : '';
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { values: {}, error: `anthropic_error: ${message}` };
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
