import 'server-only'
import { XeroClient } from 'xero-node'
import { getTokens, updateTokensIfRefreshUnchanged } from './token-store'

// ── Scopes ────────────────────────────────────────────────────────────

// Xero moved to granular scopes on 2 March 2026.
// Apps created after that date MUST use granular scopes.
// See: https://www.apideck.com/blog/xero-scopes
export const XERO_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  // Granular transaction scopes (replaces broad accounting.transactions.read)
  'accounting.invoices.read',
  'accounting.payments.read',
  'accounting.banktransactions.read',
  // Contacts and settings (unchanged)
  'accounting.contacts.read',
  'accounting.settings.read',
]

// ── Client factory ────────────────────────────────────────────────────

/**
 * Create a bare XeroClient configured with app credentials.
 * Used for OAuth flows (consent URL, token exchange).
 */
export function getXeroClient(state?: string): XeroClient {
  const clientId = process.env.XERO_CLIENT_ID
  const clientSecret = process.env.XERO_CLIENT_SECRET
  const redirectUri = process.env.XERO_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Xero environment variables: XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI')
  }

  return new XeroClient({
    clientId,
    clientSecret,
    redirectUris: [redirectUri],
    scopes: XERO_SCOPES,
    // state must be set when the client is used for apiCallback(),
    // so the OpenID client can validate the returned state parameter
    ...(state ? { state } : {}),
  })
}

// ── Token refresh buffer (5 minutes) ──────────────────────────────────

const REFRESH_BUFFER_MS = 5 * 60 * 1000

// Prevent concurrent token refreshes for the same org (each refresh invalidates the previous token)
const refreshLocks = new Map<string, Promise<void>>()

/**
 * Get an authenticated XeroClient for an organisation.
 * Automatically refreshes the access token if it is within 5 minutes of expiry.
 * Uses a per-org lock to prevent concurrent refresh attempts.
 *
 * Returns { client, tenantId } ready for API calls.
 * Returns null if no connection exists.
 */
export async function getAuthenticatedClient(
  organizationId: string
): Promise<{ client: XeroClient; tenantId: string } | null> {
  // Wait for any in-flight refresh for this org to complete first
  const existing = refreshLocks.get(organizationId)
  if (existing) {
    await existing
  }

  const tokens = await getTokens(organizationId)
  if (!tokens) return null

  const xero = getXeroClient()

  // Check if token needs refresh
  const now = Date.now()
  const expiresAt = tokens.expiresAt.getTime()

  if (now >= expiresAt - REFRESH_BUFFER_MS) {
    // Token is expired or about to expire, refresh it with a lock
    const refreshPromise = (async () => {
      const useStoredTokens = (stored: NonNullable<Awaited<ReturnType<typeof getTokens>>>) => {
        xero.setTokenSet({
          access_token: stored.accessToken,
          refresh_token: stored.refreshToken,
          expires_at: Math.floor(stored.expiresAt.getTime() / 1000),
          token_type: 'Bearer',
        } as any)
      }

      try {
        const newTokenSet = await xero.refreshWithRefreshToken(
          process.env.XERO_CLIENT_ID!,
          process.env.XERO_CLIENT_SECRET!,
          tokens.refreshToken
        )

        const newExpiresAt = new Date(Date.now() + (newTokenSet.expires_in || 1800) * 1000)

        // CRITICAL: Each refresh rotates the refresh token, and the in-process
        // lock above cannot serialise the cron and a user-triggered sync on
        // DIFFERENT lambdas. Persist conditionally: only if the stored row
        // still holds the refresh token this refresh was based on. Losing the
        // race must NOT overwrite the winner's rotation (that bricked
        // connections); the stored row is then authoritative.
        const persisted = await updateTokensIfRefreshUnchanged(
          organizationId,
          tokens.tenantId,
          tokens.refreshTokenEncrypted,
          newTokenSet.access_token!,
          newTokenSet.refresh_token!,
          newExpiresAt
        )

        if (persisted) {
          xero.setTokenSet(newTokenSet)
        } else {
          const fresh = await getTokens(organizationId)
          if (!fresh) {
            throw new Error('Xero connection removed during token refresh')
          }
          useStoredTokens(fresh)
        }
      } catch (err) {
        // Self-heal: if the refresh failed because another instance consumed
        // the token first, the stored row already holds a fresh rotation.
        const fresh = await getTokens(organizationId).catch(() => null)
        if (
          fresh &&
          fresh.refreshTokenEncrypted !== tokens.refreshTokenEncrypted &&
          fresh.expiresAt.getTime() > Date.now() + REFRESH_BUFFER_MS
        ) {
          useStoredTokens(fresh)
          return
        }
        console.error('Failed to refresh Xero token:', err)
        throw new Error(
          'Xero token refresh failed. The connection may need to be re-authorised.'
        )
      } finally {
        refreshLocks.delete(organizationId)
      }
    })()

    refreshLocks.set(organizationId, refreshPromise)
    await refreshPromise
  } else {
    // Token is still valid, set it directly
    xero.setTokenSet({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: Math.floor(expiresAt / 1000),
      token_type: 'Bearer',
    } as any)
  }

  return { client: xero, tenantId: tokens.tenantId }
}
