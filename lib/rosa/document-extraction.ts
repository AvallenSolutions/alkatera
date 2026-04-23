/**
 * Rosa — document intelligence helpers.
 *
 * Loads files from the `rosa-uploads` Supabase Storage bucket, builds the
 * Anthropic document/image block shape, and (optionally) runs a targeted
 * structured extraction via Sonnet 4.6 vision.
 *
 * Ownership model:
 *   - Files are stored at `{organization_id}/{user_id}/{uuid}.{ext}`.
 *   - All reads go through the service-role client. We check that the prefix
 *     matches the caller's org+user before returning the payload.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type AttachmentMediaType =
  | 'application/pdf'
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/gif';

const SUPPORTED_VISION_TYPES: AttachmentMediaType[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

export interface LoadedAttachment {
  file_id: string;
  filename: string;
  media_type: AttachmentMediaType;
  base64: string;
  size_bytes: number;
}

/**
 * Build the storage path for a new upload.
 */
export function buildUploadPath(
  organizationId: string,
  userId: string,
  fileId: string,
  filename: string,
): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  return `${organizationId}/${userId}/${fileId}-${safeName}`;
}

/**
 * Parse an upload path and check that it belongs to the requesting user.
 */
export function ownsUploadPath(
  path: string,
  organizationId: string,
  userId: string,
): boolean {
  const parts = path.split('/');
  return parts.length >= 3 && parts[0] === organizationId && parts[1] === userId;
}

/**
 * Load a file out of storage and return it as a base64 attachment ready for
 * an Anthropic content block. Returns null if the file does not exist or the
 * caller does not own it.
 */
export async function loadAttachment(
  supabase: SupabaseClient,
  path: string,
  organizationId: string,
  userId: string,
): Promise<LoadedAttachment | null> {
  if (!ownsUploadPath(path, organizationId, userId)) return null;
  const { data, error } = await supabase.storage.from('rosa-uploads').download(path);
  if (error || !data) return null;

  const buf = Buffer.from(await data.arrayBuffer());
  const base64 = buf.toString('base64');
  const filename = path.split('/').slice(2).join('/');
  const mediaType = inferMediaType(filename, (data as any).type);
  if (!mediaType) return null;
  return {
    file_id: path,
    filename,
    media_type: mediaType,
    base64,
    size_bytes: buf.length,
  };
}

export function inferMediaType(
  filenameOrType: string,
  fallback?: string,
): AttachmentMediaType | null {
  const lower = (filenameOrType || '').toLowerCase();
  if (lower.endsWith('.pdf') || fallback === 'application/pdf') return 'application/pdf';
  if (lower.endsWith('.png') || fallback === 'image/png') return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || fallback === 'image/jpeg') return 'image/jpeg';
  if (lower.endsWith('.webp') || fallback === 'image/webp') return 'image/webp';
  if (lower.endsWith('.gif') || fallback === 'image/gif') return 'image/gif';
  return null;
}

/**
 * Turn a loaded attachment into the Anthropic message content block.
 */
export function toAnthropicBlock(a: LoadedAttachment): any {
  if (a.media_type === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: a.base64 },
    };
  }
  return {
    type: 'image',
    source: { type: 'base64', media_type: a.media_type, data: a.base64 },
  };
}

export function isSupportedMediaType(mt: string): mt is AttachmentMediaType {
  return SUPPORTED_VISION_TYPES.includes(mt as AttachmentMediaType);
}

/**
 * Run a targeted extraction pass. Calls Anthropic in tools-off mode with a
 * specific "return JSON with these keys" instruction. Returns a plain object.
 */
export async function extractStructured(
  apiKey: string,
  attachment: LoadedAttachment,
  fields: string[],
  documentKind?: string,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    const keys = fields.length > 0 ? fields.join(', ') : 'any fields that look structured and relevant';
    const kind = documentKind ?? 'document';
    const instruction = `Look at the attached ${kind} and extract the following fields as a single flat JSON object: ${keys}.

Rules:
- Return ONLY valid JSON. No markdown, no explanation, no code fences.
- If a field is missing, use null.
- Use ISO 8601 for dates (YYYY-MM-DD).
- Numeric values as numbers, not strings. Strip units; name the unit in a separate key when relevant (e.g. "quantity_value" + "quantity_unit").
- Do not invent values. If uncertain, return null and add a key "uncertainty_notes" with a short reason.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [toAnthropicBlock(attachment), { type: 'text', text: instruction }],
        },
      ],
    });

    const textBlock = response.content.find((b: any) => b.type === 'text') as any;
    const raw = (textBlock?.text ?? '').trim();
    // Strip accidental code fences just in case.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      const data = JSON.parse(cleaned);
      return { ok: true, data };
    } catch {
      return { ok: false, error: 'Could not parse extraction response as JSON' };
    }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Extraction failed' };
  }
}
