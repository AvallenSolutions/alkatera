import crypto from 'crypto';

/**
 * Svix webhook signature verification.
 *
 * Resend signs webhooks with Svix. We implement the scheme directly rather
 * than pulling in the `svix` package: this repo has repeatedly hit "Cannot
 * find module" at Netlify function init when a dependency is reached through
 * nested requires across pnpm symlinks, and the whole algorithm is fifteen
 * lines of node:crypto.
 *
 * Scheme (https://docs.svix.com/receiving/verifying-payloads/how-manual):
 *   signedContent = `${svix-id}.${svix-timestamp}.${rawBody}`
 *   secret        = base64-decode(webhook secret minus its `whsec_` prefix)
 *   expected      = base64(HMAC-SHA256(secret, signedContent))
 * The `svix-signature` header carries a space-separated list of
 * `v1,<signature>` pairs (more than one during a secret rotation), and the
 * delivery is valid if ANY of them matches.
 */

/** Reject anything older than this to blunt replay attempts. Svix's own default. */
const TOLERANCE_SECONDS = 5 * 60;

export interface SvixHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export type VerifyResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Constant-time compare that cannot throw on a length mismatch.
 * `timingSafeEqual` requires equal-length buffers, so guard the length first.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyResendWebhook(
  rawBody: string,
  headers: SvixHeaders,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): VerifyResult {
  const { id, timestamp, signature } = headers;

  if (!id || !timestamp || !signature) {
    return { valid: false, reason: 'Missing svix-id, svix-timestamp or svix-signature header' };
  }

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) {
    return { valid: false, reason: 'Malformed svix-timestamp' };
  }
  if (Math.abs(nowSeconds - sentAt) > TOLERANCE_SECONDS) {
    return { valid: false, reason: 'Timestamp outside tolerance window' };
  }

  // Secrets are handed out as `whsec_<base64>`; the bytes we key the HMAC with
  // are the base64-decoded remainder, NOT the literal string.
  const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(rawSecret, 'base64');
  } catch {
    return { valid: false, reason: 'Webhook secret is not valid base64' };
  }
  if (key.length === 0) {
    return { valid: false, reason: 'Webhook secret decoded to zero bytes' };
  }

  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', key).update(signedContent).digest('base64');

  // `v1,<sig> v1,<sig>` — compare against every version-1 entry.
  const candidates = signature
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('v1,'))
    .map((part) => part.slice(3));

  if (candidates.length === 0) {
    return { valid: false, reason: 'No v1 signature present' };
  }

  const matched = candidates.some((candidate) => safeEqual(candidate, expected));
  return matched ? { valid: true } : { valid: false, reason: 'Signature mismatch' };
}

/**
 * Map a Resend event type onto the value we store in
 * `supplier_invitations.email_status`. Anything not listed is logged to
 * email_delivery_events but leaves the invitation's status alone, so a stray
 * open or click never overwrites a bounce.
 */
const STATUS_BY_EVENT: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delivery_delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'email.suppressed': 'suppressed',
};

export function invitationStatusForEvent(eventType: string): string | null {
  return STATUS_BY_EVENT[eventType] ?? null;
}

/**
 * `delivered` must not be downgraded to `sent` if Resend delivers the two
 * events out of order, and a terminal failure must never be overwritten by a
 * late `sent`. Higher wins.
 */
const STATUS_RANK: Record<string, number> = {
  sent: 1,
  delivery_delayed: 2,
  delivered: 3,
  suppressed: 4,
  failed: 5,
  complained: 6,
  bounced: 7,
  unsubscribed: 8,
};

export function shouldOverwriteStatus(current: string | null, incoming: string): boolean {
  if (!current) return true;
  return (STATUS_RANK[incoming] ?? 0) >= (STATUS_RANK[current] ?? 0);
}
