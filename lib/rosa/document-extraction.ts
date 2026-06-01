/**
 * Rosa — document intelligence helpers.
 *
 * Loads files from the `rosa-uploads` Supabase Storage bucket, builds the
 * Gemini inlineData part shape, and (optionally) runs a targeted structured
 * extraction via Gemini vision.
 *
 * Ownership model:
 *   - Files are stored at `{organization_id}/{user_id}/{uuid}.{ext}`.
 *   - All reads go through the service-role client. We check that the prefix
 *     matches the caller's org+user before returning the payload.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  extractStructured as extractStructuredGemini,
  toGeminiInlineData,
  type LoadedAttachmentLike,
} from '@/lib/ai/gemini';

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
 * a Gemini inlineData part. Returns null if the file does not exist or the
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
 * Turn a loaded attachment into a Gemini inlineData part.
 */
export function toGeminiPart(a: LoadedAttachment) {
  return toGeminiInlineData(a as LoadedAttachmentLike);
}

export function isSupportedMediaType(mt: string): mt is AttachmentMediaType {
  return SUPPORTED_VISION_TYPES.includes(mt as AttachmentMediaType);
}

/**
 * Run a targeted extraction pass against Gemini Flash with JSON-mode forced
 * on. Returns a plain object on success.
 */
export async function extractStructured(
  apiKey: string,
  attachment: LoadedAttachment,
  fields: string[],
  documentKind?: string,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  return extractStructuredGemini({
    apiKey,
    attachment: attachment as LoadedAttachmentLike,
    fields,
    documentKind,
  });
}
