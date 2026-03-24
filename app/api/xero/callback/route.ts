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
 *
 * If the user has multiple Xero organisations (tenants), the token data and
 * tenant list are stored in a secure cookie and the user is redirected to
 * a tenant-selection UI instead of auto-picking the first one.
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

    const expiresAt = new Date(Date.now() + (tokenSet.expires_in || 1800) * 1000)

    // 5. If multiple tenants, let the user choose which one to connect
    if (tenants.length > 1) {
      // Store token data + tenant list in a secure httpOnly cookie so the
      // select-tenant endpoint can finalise the connection without another
      // round-trip to Xero.
      const pendingData = {
        organizationId: storedState.organizationId,
        userId: storedState.userId,
        accessToken: tokenSet.access_token!,
        refreshToken: tokenSet.refresh_token!,
        expiresAt: expiresAt.toISOString(),
        scopes: (tokenSet.scope || '').split(' ').filter(Boolean),
        tenants: tenants.map((t: { tenantId: string; tenantName?: string }) => ({
          tenantId: t.tenantId,
          tenantName: t.tenantName || null,
        })),
      }

      const response = NextResponse.redirect(
        `${baseUrl}/settings?tab=integrations&xero=select-tenant`
      )

      response.cookies.set('xero_pending_tenants', JSON.stringify(pendingData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600, // 10 minutes to pick a tenant
        path: '/',
      })

      return response
    }

    // 6. Single tenant - auto-connect as before
    const tenant = tenants[0]

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

    // 7. Redirect to settings with success + auto-sync trigger
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
