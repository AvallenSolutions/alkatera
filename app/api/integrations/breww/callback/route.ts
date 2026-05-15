import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import { encryptConfig } from '@/lib/crypto/config-encryption'
import {
  BREWW_OAUTH_COOKIE,
  decodeOAuthCookie,
  exchangeCode,
} from '@/lib/integrations/breww/oauth'
import { pingBreww, BrewwError } from '@/lib/integrations/breww/client'
import type { BrewwStoredTokens } from '@/lib/integrations/breww/get-access-token'

// GET /api/integrations/breww/callback?code=...&state=...
// Handles the redirect back from Breww's authorize endpoint:
//   1. Reads + clears the breww_oauth cookie set by /connect.
//   2. Validates state (CSRF) and that the caller is the original user.
//   3. Exchanges the code for tokens (POST /oauth/token/, PKCE).
//   4. Smoke-tests the token by listing sites.
//   5. Encrypts + upserts to integration_connections.
//   6. Redirects back to /settings with a success or error flag.

export const dynamic = 'force-dynamic'

const SETTINGS_PATH = '/settings?tab=integrations'

/**
 * Redirect back to wherever the connect call was kicked off from. The Breww
 * /connect route stores an optional `returnTo` in the encrypted state cookie;
 * onboarding sets `/dashboard` so the user lands back in the wizard rather
 * than on the settings page. Falls back to settings for the historical path.
 */
function landingRedirect(request: NextRequest, returnTo: string | undefined, params: Record<string, string>): NextResponse {
  const target = returnTo || SETTINGS_PATH
  const url = new URL(target, request.url)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = NextResponse.redirect(url)
  res.cookies.delete(BREWW_OAUTH_COOKIE)
  return res
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const errParam = request.nextUrl.searchParams.get('error')

  // Pre-stash errors: no returnTo available, default to settings.
  if (errParam) {
    return landingRedirect(request, undefined, { error: 'breww_denied', detail: errParam })
  }
  if (!code || !state) {
    return landingRedirect(request, undefined, { error: 'breww_invalid_callback' })
  }

  const cookie = request.cookies.get(BREWW_OAUTH_COOKIE)?.value
  const stash = cookie ? decodeOAuthCookie(cookie) : null
  if (!stash) {
    return landingRedirect(request, undefined, { error: 'breww_oauth_state' })
  }
  // State mismatch may indicate CSRF; don't honour an attacker-controlled
  // returnTo. Land on settings with the error.
  if (stash.state !== state) {
    return landingRedirect(request, undefined, { error: 'breww_state_mismatch' })
  }

  const { user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) {
    const url = new URL('/auth/login', request.url)
    url.searchParams.set('next', stash.returnTo || SETTINGS_PATH)
    return NextResponse.redirect(url)
  }

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: membership } = await serviceClient
    .from('organization_members')
    .select('id')
    .eq('organization_id', stash.organizationId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) {
    return landingRedirect(request, stash.returnTo, { error: 'breww_access_denied' })
  }

  let tokens
  try {
    tokens = await exchangeCode({ code, codeVerifier: stash.codeVerifier })
  } catch (err) {
    console.error('[breww/callback] token exchange failed:', err)
    return landingRedirect(request, stash.returnTo, {
      error: 'breww_token_exchange_failed',
      detail: (err as Error).message.slice(0, 200),
    })
  }

  // Smoke-test the access token. Treat 401/403 as a connect failure rather
  // than persisting a token we know to be unusable.
  try {
    const ping = await pingBreww(tokens.access_token)

    const stored: BrewwStoredTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
    }

    const { error: upsertErr } = await serviceClient
      .from('integration_connections')
      .upsert(
        {
          organization_id: stash.organizationId,
          provider_slug: 'breww',
          status: 'active',
          encrypted_config: encryptConfig(stored),
          connected_by: user.id,
          connected_at: new Date().toISOString(),
          sync_status: 'idle',
          sync_error: null,
          metadata: { facilitiesCount: ping.facilitiesCount, scope: tokens.scope },
        },
        { onConflict: 'organization_id,provider_slug' },
      )
    if (upsertErr) {
      console.error('[breww/callback] upsert error:', upsertErr)
      return landingRedirect(request, stash.returnTo, { error: 'breww_save_failed' })
    }
  } catch (err) {
    const detail =
      err instanceof BrewwError ? err.message : (err as Error)?.message || 'unknown'
    console.error('[breww/callback] smoke-test failed:', detail)
    return landingRedirect(request, stash.returnTo, {
      error: 'breww_token_unusable',
      detail: detail.slice(0, 200),
    })
  }

  return landingRedirect(request, stash.returnTo, { connected: 'breww' })
}
