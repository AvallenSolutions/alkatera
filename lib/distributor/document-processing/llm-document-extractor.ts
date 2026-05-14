import Anthropic from '@anthropic-ai/sdk';
import { FIELD_DEFINITIONS, type FieldKey } from '../scraping/field-definitions';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

const SYSTEM_PROMPT = `You are a sustainability data analyst. Extract structured sustainability data from drinks industry documents. Return only valid JSON with field names exactly as specified. Use null (or omit) for fields not found. Do not invent or estimate values not present in the document.`;

export interface DocumentExtractArgs {
  /** Plain text extracted from a PDF / Excel / CSV / TXT document. */
  text: string;
  brandName: string;
  /** Self-declared document type from the brand uploader, e.g. lca_report. */
  documentType: string;
}

export interface DocumentExtractResult {
  values: Partial<Record<FieldKey, unknown>>;
  error?: string;
}

/**
 * Run Claude Sonnet over a document's extracted text to pull out
 * structured sustainability fields. Uses claude-sonnet-4-6 because
 * documents are richer and more ambiguous than the small web snippets
 * the Phase 2 scraper handles — the quality bump justifies the cost.
 */
export async function extractFieldsFromDocument(
  args: DocumentExtractArgs,
): Promise<DocumentExtractResult> {
  const client = getClient();
  if (!client) {
    return { values: {}, error: 'ANTHROPIC_API_KEY not configured' };
  }
  if (!args.text || !args.text.trim()) {
    return { values: {}, error: 'no_text_to_extract' };
  }

  const fieldList = FIELD_DEFINITIONS.map((f) => {
    const note = f.description ? ` — ${f.description}` : '';
    return `- ${f.key} (${f.type}): ${f.label}${note}`;
  }).join('\n');

  const userPrompt = `Brand: ${args.brandName}
Document type: ${args.documentType}

Extract all available sustainability data from this document text. Use exactly these JSON keys:
${fieldList}

Document text:
"""
${args.text}
"""

Return ONLY a JSON object with the fields you found. Omit any field with no explicit evidence in the text.`;

  let raw: string;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const first = response.content[0];
    raw = first && first.type === 'text' ? first.text : '';
  } catch (err: unknown) {
    return { values: {}, error: err instanceof Error ? err.message : String(err) };
  }

  const parsed = parseJsonObject(raw);
  if (!parsed) return { values: {}, error: 'model_returned_invalid_json' };
  return { values: parsed };
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    const value = JSON.parse(stripped.slice(start, end + 1));
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
