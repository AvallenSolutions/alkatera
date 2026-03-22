import 'server-only'
import { XeroClient } from 'xero-node'
import { getTokens, updateTokens } from './token-store'

// ── Scopes ────────────────────────────────────────────────────────────

export const XERO_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'accounting.transactions.read',
  'accounting.contacts.read',
  'accounting.settings.read',
]

// ── Client factory ────────────────────────────────────────────────────

/**
 * Create a bare XeroClient configured with app credentials.
 * Used for OAuth flows (consent URL, token exchange).
 */
export function getXeroClient(): XeroClient {
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
  })
}

// ── Token refresh buffer (5 minutes) ──────────────────────────────────

const REFRESH_BUFFER_MS = 5 * 60 * 1000

/**
 * Get an authenticated XeroClient for an organisation.
 * Automatically refreshes the access token if it is within 5 minutes of expiry.
 *
 * Returns { client, tenantId } ready for API calls.
 * Returns null if no connection exists.
 */
export async function getAuthenticatedClient(
  organizationId: string
): Promise<{ client: XeroClient; tenantId: string } | null> {
  const tokens = await getTokens(organizationId)
  if (!tokens) return null

  const xero = getXeroClient()

  // Check if token needs refresh
  const now = Date.now()
  const expiresAt = tokens.expiresAt.getTime()

  if (now >= expiresAt - REFRESH_BUFFER_MS) {
    // Token is expired or about to expire, refresh it
    try {
      const newTokenSet = await xero.refreshWithRefreshToken(
        process.env.XERO_CLIENT_ID!,
        process.env.XERO_CLIENT_SECRET!,
        tokens.refreshToken
      )

      const newExpiresAt = new Date(Date.now() + (newTokenSet.expires_in || 1800) * 1000)

      // CRITICAL: Always persist the new refresh token.
      // Each refresh invalidates the previous refresh token.
      await updateTokens(
        organizationId,
        tokens.tenantId,
        newTokenSet.access_token!,
        newTokenSet.refresh_token!,
        newExpiresAt
      )

      // Set the new token on the client
      xero.setTokenSet(newTokenSet)
    } catch (err) {
      console.error('Failed to refresh Xero token:', err)
      throw new Error(
        'Xero token refresh failed. The connection may need to be re-authorised.'
      )
    }
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
