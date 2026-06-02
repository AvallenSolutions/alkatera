import { FIELD_DEFINITIONS, type FieldKey } from '../../scraping/field-definitions';
import { getGeminiClient, toGeminiInlineData } from '@/lib/ai/gemini';
import { GEMINI_FAST_MODEL } from '@/lib/ai/models';

const MAX_TOKENS = 1024;

const SUPPORTED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export interface ImageExtractResult {
  values: Partial<Record<FieldKey, unknown>>;
  error?: string;
}

/**
 * Use Gemini's vision capability to extract sustainability data from an
 * image — typically a scanned certificate (B Corp, Carbon Trust, ISO)
 * or a screenshot of a sustainability report page.
 *
 * Returns only fields the model claims to have evidence for. Unknown
 * media types are rejected up front so we don't burn a model call
 * on something the model won't accept.
 */
export async function extractFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  brandName: string,
): Promise<ImageExtractResult> {
  if (!SUPPORTED_IMAGE_MIME.has(mimeType)) {
    return { values: {}, error: `unsupported_image_mime: ${mimeType}` };
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { values: {}, error: 'GEMINI_API_KEY not configured' };
  }

  const fieldList = FIELD_DEFINITIONS.map(
    (f) => `- ${f.key} (${f.type}): ${f.label}`,
  ).join('\n');

  const prompt = `This image is a sustainability document for a drinks brand called "${brandName}" — typically a certification, audit report, or sustainability report page.

Extract any of the following fields you can find in the image. Use exactly these JSON keys:
${fieldList}

Rules:
- Return ONLY a JSON object. No markdown, no commentary.
- For boolean fields, return true/false.
- For "number" fields, return a JSON number (no units, no commas).
- For "year" fields, return a 4-digit integer.
- For "string" fields, return a short factual string (no marketing prose).
- OMIT any field you cannot read from the image. Do not guess.`;

  let raw: string;
  try {
    const client = getGeminiClient(apiKey);
    const generativeModel = client.getGenerativeModel({
      model: GEMINI_FAST_MODEL,
      generationConfig: { maxOutputTokens: MAX_TOKENS },
    });
    const result = await generativeModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            toGeminiInlineData({ base64: imageBuffer.toString('base64'), media_type: mimeType }),
            { text: prompt },
          ],
        },
      ],
    });
    raw = result.response.text();
  } catch (err: unknown) {
    return { values: {}, error: err instanceof Error ? err.message : String(err) };
  }

  const parsed = parseJsonObject(raw);
  if (!parsed) return { values: {}, error: 'model_returned_invalid_json' };
  return { values: parsed };
}

function parseJsonObject(text: string): Record<string, unknown> | null {
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
