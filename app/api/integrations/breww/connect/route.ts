import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import {
  BREWW_OAUTH_COOKIE,
  BREWW_OAUTH_COOKIE_TTL_SECONDS,
  buildAuthorizeUrl,
  codeChallengeFromVerifier,
  encodeOAuthCookie,
  generateCodeVerifier,
  generateState,
} from '@/lib/integrations/breww/oauth'

// GET /api/integrations/breww/connect?organizationId=...
// Starts the Breww OAuth2 (Authorization Code + PKCE) flow.
// 1. Verifies caller is a member of the org.
// 2. Stashes state + PKCE verifier + org id in an encrypted HttpOnly cookie.
// 3. Redirects to Breww's authorize endpoint.
//
// The matching callback is /api/integrations/breww/callback.

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) {
    return NextResponse.redirect(new URL('/auth/login?next=/settings', request.url))
  }

  const organizationId = request.nextUrl.searchParams.get('organizationId')
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
  }

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: membership } = await serviceClient
    .from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const state = generateState()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = codeChallengeFromVerifier(codeVerifier)

  const authorizeUrl = buildAuthorizeUrl({ state, codeChallenge })

  const response = NextResponse.redirect(authorizeUrl)
  response.cookies.set({
    name: BREWW_OAUTH_COOKIE,
    value: encodeOAuthCookie({ state, codeVerifier, organizationId }),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: BREWW_OAUTH_COOKIE_TTL_SECONDS,
  })
  return response
}
