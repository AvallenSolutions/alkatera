import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getXeroClient } from '@/lib/xero/client'
import { storeTokens } from '@/lib/xero/token-store'

export const dynamic = 'force-dynamic'

/**
 * GET /api/xero/callback
 *
 * Handles the OAuth 2.0 callback from Xero after user authorisation.
 * Exchanges the authorisation code for tokens, fetches connected tenants,
 * stores encrypted tokens, and redirects to the settings page.
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  try {
    // 1. Validate state parameter
    const { searchParams } = request.nextUrl
    const returnedState = searchParams.get('state')
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      console.error('Xero OAuth error:', error, searchParams.get('error_description'))
      return NextResponse.redirect(
        `${baseUrl}/settings?tab=integrations&xero=error&message=${encodeURIComponent(
          searchParams.get('error_description') || 'Authorisation was denied'
        )}`
      )
    }

    if (!code || !returnedState) {
      return NextResponse.redirect(
        `${baseUrl}/settings?tab=integrations&xero=error&message=${encodeURIComponent(
          'Missing authorisation code or state parameter'
        )}`
      )
    }

    // 2. Retrieve and validate stored state
    const cookieStore = cookies()
    const storedCookie = cookieStore.get('xero_oauth_state')
    if (!storedCookie?.value) {
      return NextResponse.redirect(
        `${baseUrl}/settings?tab=integrations&xero=error&message=${encodeURIComponent(
          'OAuth state expired. Please try connecting again.'
        )}`
      )
    }

    let storedState: { state: string; organizationId: string; userId: string }
    try {
      storedState = JSON.parse(storedCookie.value)
    } catch {
      return NextResponse.redirect(
        `${baseUrl}/settings?tab=integrations&xero=error&message=${encodeURIComponent(
          'Invalid OAuth state. Please try connecting again.'
        )}`
      )
    }

    if (returnedState !== storedState.state) {
      return NextResponse.redirect(
        `${baseUrl}/settings?tab=integrations&xero=error&message=${encodeURIComponent(
          'OAuth state mismatch. This may indicate a CSRF attack. Please try again.'
        )}`
      )
    }

    // Clear the state cookie
    cookieStore.delete('xero_oauth_state')

    // 3. Exchange code for tokens
    // Pass the original state so the OpenID client can validate it
    const xero = getXeroClient(storedState.state)
    const callbackUrl = `${process.env.XERO_REDIRECT_URI}?code=${code}&state=${returnedState}`
    const tokenSet = await xero.apiCallback(callbackUrl)

    // 4. Get connected tenants (Xero organisations)
    await xero.updateTenants(false)
    const tenants = xero.tenants

    if (!tenants || tenants.length === 0) {
      return NextResponse.redirect(
        `${baseUrl}/settings?tab=integrations&xero=error&message=${encodeURIComponent(
          'No Xero organisations found. Please ensure you have access to at least one Xero organisation.'
        )}`
      )
    }

    // 5. Store tokens for the first tenant (most common case)
    // If multi-tenant support is needed later, we can store all and let user choose
    const tenant = tenants[0]
    const expiresAt = new Date(Date.now() + (tokenSet.expires_in || 1800) * 1000)

    await storeTokens({
      organizationId: storedState.organizationId,
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName || null,
      accessToken: tokenSet.access_token!,
      refreshToken: tokenSet.refresh_token!,
      expiresAt,
      scopes: (tokenSet.scope || '').split(' ').filter(Boolean),
      connectedBy: storedState.userId,
    })

    // 6. Redirect to settings with success + auto-sync trigger
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&xero=connected&auto-sync=true`
    )
  } catch (err: unknown) {
    console.error('Error in Xero OAuth callback:', err)
    const message = err instanceof Error ? err.message : 'Failed to complete Xero authorisation'
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&xero=error&message=${encodeURIComponent(message)}`
    )
  }
}
