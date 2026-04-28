import 'server-only'
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'crypto'

// Breww OAuth2 (Authorization Code + PKCE S256) helpers.
// Spec: https://breww.com/api/schema/elements/ → "Public apps (OAuth2)"
//
// Flow:
//   1. /connect builds an authorize URL with state + code_challenge and 302s.
//   2. Breww redirects back to /callback with `code` (and the `state` we set).
//   3. /callback POSTs to the token endpoint with the matching code_verifier.
//   4. Refresh tokens rotate on every use — persist the new one immediately.

const BREWW_BASE = process.env.BREWW_OAUTH_BASE || 'https://breww.com'
const AUTHORIZE_URL = `${BREWW_BASE}/oauth/authorize/`
const TOKEN_URL = `${BREWW_BASE}/oauth/token/`

export const BREWW_DEFAULT_SCOPE = 'read'

export interface BrewwTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  scope: string
}

export interface BrewwOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export function getBrewwOAuthConfig(): BrewwOAuthConfig {
  const clientId = process.env.BREWW_CLIENT_ID
  const clientSecret = process.env.BREWW_CLIENT_SECRET
  const redirectUri = process.env.BREWW_OAUTH_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'BREWW_CLIENT_ID, BREWW_CLIENT_SECRET and BREWW_OAUTH_REDIRECT_URI are required',
    )
  }
  return { clientId, clientSecret, redirectUri }
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export function generateState(): string {
  return base64url(randomBytes(32))
}

export function generateCodeVerifier(): string {
  // PKCE spec: 43-128 chars, unreserved characters. base64url of 32 bytes = 43 chars.
  return base64url(randomBytes(48))
}

export function codeChallengeFromVerifier(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest())
}

export function buildAuthorizeUrl(args: {
  state: string
  codeChallenge: string
  scope?: string
}): string {
  const { clientId, redirectUri } = getBrewwOAuthConfig()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: args.scope ?? BREWW_DEFAULT_SCOPE,
    state: args.state,
    code_challenge: args.codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${AUTHORIZE_URL}?${params.toString()}`
}

async function postToken(body: URLSearchParams): Promise<BrewwTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
    cache: 'no-store',
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Breww token endpoint failed (${res.status}): ${text.slice(0, 240)}`)
  }
  return JSON.parse(text) as BrewwTokenResponse
}

export async function exchangeCode(args: {
  code: string
  codeVerifier: string
}): Promise<BrewwTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getBrewwOAuthConfig()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: args.codeVerifier,
  })
  return postToken(body)
}

// ── OAuth-state cookie ──────────────────────────────────────────────
// We store the PKCE verifier + CSRF state + the originating org id in an
// HttpOnly cookie between /connect and /callback. AES-256-GCM with the same
// INTEGRATION_CONFIG_KEY used for token-at-rest encryption (no need for a
// separate secret).

const COOKIE_ALG = 'aes-256-gcm'
const COOKIE_IV_LEN = 12
const COOKIE_TAG_LEN = 16

export const BREWW_OAUTH_COOKIE = 'breww_oauth'
export const BREWW_OAUTH_COOKIE_TTL_SECONDS = 10 * 60

export interface BrewwOAuthCookiePayload {
  state: string
  codeVerifier: string
  organizationId: string
  returnTo?: string
}

function cookieKey(): Buffer {
  const secret = process.env.INTEGRATION_CONFIG_KEY
  if (!secret) {
    throw new Error('INTEGRATION_CONFIG_KEY is required for Breww OAuth cookies')
  }
  return Buffer.from(secret.padEnd(32, '0').slice(0, 32), 'utf-8')
}

export function encodeOAuthCookie(payload: BrewwOAuthCookiePayload): string {
  const iv = randomBytes(COOKIE_IV_LEN)
  const cipher = createCipheriv(COOKIE_ALG, cookieKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf-8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url')
}

export function decodeOAuthCookie(value: string): BrewwOAuthCookiePayload | null {
  try {
    const buf = Buffer.from(value, 'base64url')
    if (buf.length < COOKIE_IV_LEN + COOKIE_TAG_LEN) return null
    const iv = buf.subarray(0, COOKIE_IV_LEN)
    const tag = buf.subarray(COOKIE_IV_LEN, COOKIE_IV_LEN + COOKIE_TAG_LEN)
    const ciphertext = buf.subarray(COOKIE_IV_LEN + COOKIE_TAG_LEN)
    const decipher = createDecipheriv(COOKIE_ALG, cookieKey(), iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      'utf-8',
    )
    const parsed = JSON.parse(plaintext) as BrewwOAuthCookiePayload
    if (!parsed?.state || !parsed?.codeVerifier || !parsed?.organizationId) return null
    return parsed
  } catch {
    return null
  }
}

export async function refreshTokens(refreshToken: string): Promise<BrewwTokenResponse> {
  const { clientId, clientSecret } = getBrewwOAuthConfig()
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })
  return postToken(body)
}
