import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptConfig, encryptConfig } from '@/lib/crypto/config-encryption'
import { refreshTokens } from './oauth'

// Stored shape of a Breww OAuth connection in
// integration_connections.encrypted_config.
export interface BrewwStoredTokens {
  access_token: string
  refresh_token: string
  expires_at: number // ms epoch
  scope?: string
}

const PROVIDER_SLUG = 'breww'
// Refresh a little before expiry to absorb clock skew and slow networks.
const REFRESH_LEEWAY_MS = 60_000

/**
 * Returns a usable Breww access token for an org, transparently refreshing
 * (and persisting the rotated refresh_token) if the cached one is near expiry.
 *
 * Throws if there's no connection, or if the refresh fails — caller should
 * surface "needs reconnect" to the user when that happens.
 */
export async function getBrewwAccessToken(
  serviceClient: SupabaseClient,
  organizationId: string,
): Promise<string> {
  const { data: conn, error } = await serviceClient
    .from('integration_connections')
    .select('encrypted_config, status')
    .eq('organization_id', organizationId)
    .eq('provider_slug', PROVIDER_SLUG)
    .maybeSingle()
  if (error) throw new Error(`Failed to load Breww connection: ${error.message}`)
  if (!conn) throw new Error('Breww not connected for this org')

  const tokens = decryptConfig<BrewwStoredTokens>(conn.encrypted_config)
  if (!tokens.access_token) throw new Error('Breww connection is missing tokens')

  if (tokens.expires_at - Date.now() > REFRESH_LEEWAY_MS) {
    return tokens.access_token
  }

  // Refresh. Breww rotates refresh tokens on each use; persist the new one
  // before returning so a concurrent caller doesn't reuse the old (now-dead)
  // refresh token.
  let fresh
  try {
    fresh = await refreshTokens(tokens.refresh_token)
  } catch (err) {
    await serviceClient
      .from('integration_connections')
      .update({
        status: 'error',
        sync_error: `Token refresh failed: ${(err as Error).message}`,
      })
      .eq('organization_id', organizationId)
      .eq('provider_slug', PROVIDER_SLUG)
    throw err
  }

  const updated: BrewwStoredTokens = {
    access_token: fresh.access_token,
    refresh_token: fresh.refresh_token,
    expires_at: Date.now() + fresh.expires_in * 1000,
    scope: fresh.scope,
  }
  await serviceClient
    .from('integration_connections')
    .update({
      encrypted_config: encryptConfig(updated),
      status: 'active',
      sync_error: null,
    })
    .eq('organization_id', organizationId)
    .eq('provider_slug', PROVIDER_SLUG)

  return updated.access_token
}
