import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

// Unleashed signs each webhook delivery with HMAC-SHA256 of `${timestamp}.${body}`
// using the per-subscription signing key (returned once on subscription creation).
// Replay window is 5 minutes from the timestamp.
//
// Headers (per Unleashed docs):
//   x-unleashed-signature  — base64 HMAC
//   x-unleashed-timestamp  — Unix seconds

export const REPLAY_WINDOW_SECONDS = 5 * 60

export interface VerifyResult {
  ok: boolean
  reason?: 'missing_headers' | 'replay_window' | 'bad_signature'
}

export function verifyUnleashedWebhook(params: {
  signatureHeader: string | null
  timestampHeader: string | null
  rawBody: string
  signingKey: string
  nowSeconds?: number
}): VerifyResult {
  const { signatureHeader, timestampHeader, rawBody, signingKey } = params
  if (!signatureHeader || !timestampHeader) return { ok: false, reason: 'missing_headers' }

  const ts = Number(timestampHeader)
  if (!Number.isFinite(ts)) return { ok: false, reason: 'missing_headers' }

  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > REPLAY_WINDOW_SECONDS) return { ok: false, reason: 'replay_window' }

  const expected = createHmac('sha256', signingKey)
    .update(`${timestampHeader}.${rawBody}`, 'utf-8')
    .digest('base64')

  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return { ok: false, reason: 'bad_signature' }
  return { ok: timingSafeEqual(a, b), reason: timingSafeEqual(a, b) ? undefined : 'bad_signature' }
}

export interface UnleashedWebhookPayload {
  EventType: string // e.g. "Product.updated"
  ObjectType?: string
  ObjectId?: string
  OccurredAt?: string
  Data?: Record<string, unknown>
}
