/**
 * Rosa — document intelligence helpers.
 *
 * Loads files from Supabase Storage, builds the Gemini inlineData part
 * shape, and (optionally) runs a targeted structured extraction via Gemini
 * vision — kept as the fallback path for when the shared Smart Upload
 * classifier (lib/ingest/classify-document.ts) returns 'unsupported' (see
 * app/api/rosa/uploads/extract/route.ts).
 *
 * Bucket model (data-revolution-plan.md Pillar 1 — one intake, one learning
 * substrate): new uploads are stashed to `ingest-staging`, the same bucket
 * every other Smart Upload channel uses, so a Rosa upload produces a real
 * `ingest_jobs` row. Historical uploads from before this rewire live in the
 * legacy `rosa-uploads` bucket, which stays readable — `loadAttachment` tries
 * the new bucket first and falls back to the legacy one, so old chat
 * attachments (`/api/rosa/chat`'s `attachments: [{file_id}]`) keep resolving.
 *
 * Ownership model:
 *   - Files are stored at `{organization_id}/{user_id}/{uuid}-{filename}`.
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

/** New Rosa uploads land here — the same bucket every Smart Upload channel stashes into. */
export const ROSA_UPLOAD_BUCKET = 'ingest-staging';
/** Pre-rewire uploads only. Never written to any more; kept readable. */
export const LEGACY_ROSA_UPLOAD_BUCKET = 'rosa-uploads';

export interface LoadedAttachment {
  file_id: string;
  filename: string;
  media_type: AttachmentMediaType;
  base64: string;
  /** Raw bytes, for callers (e.g. classifyDocument) that don't want a base64 round-trip. */
  bytes: Uint8Array;
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
 * Load a file out of storage and return it as a base64 (+ raw bytes)
 * attachment. Tries the current `ingest-staging` bucket first, then falls
 * back to the legacy `rosa-uploads` bucket for files stashed before the
 * Pillar 1 rewire. Returns null if the file does not exist in either bucket
 * or the caller does not own it.
 */
export async function loadAttachment(
  supabase: SupabaseClient,
  path: string,
  organizationId: string,
  userId: string,
): Promise<LoadedAttachment | null> {
  if (!ownsUploadPath(path, organizationId, userId)) return null;

  let data = (await supabase.storage.from(ROSA_UPLOAD_BUCKET).download(path)).data;
  if (!data) {
    data = (await supabase.storage.from(LEGACY_ROSA_UPLOAD_BUCKET).download(path)).data;
  }
  if (!data) return null;

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
    bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
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
