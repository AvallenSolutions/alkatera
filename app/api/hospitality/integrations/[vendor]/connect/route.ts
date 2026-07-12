/**
 * Begin a vendor connect (OAuth) flow.
 * GET /api/hospitality/integrations/[vendor]/connect → { authorize_url } | 501
 *
 * Returns the vendor's OAuth authorize URL when credentials are configured;
 * otherwise 501 with a clear "needs setup" message. The callback that exchanges
 * the code and stores the per-org token needs a secrets store (see the adapter
 * header) and is wired per-deployment, not from the workspace.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { INTEGRATION_VENDORS, isVendorConfigured } from '@/lib/hospitality/integrations/adapter'
import { squareAuthorizeUrl } from '@/lib/hospitality/integrations/square'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: { vendor: string } }) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 })

  const vendor = INTEGRATION_VENDORS.find((v) => v.id === params.vendor)
  if (!vendor) return NextResponse.json({ error: 'Unknown vendor' }, { status: 404 })
  if (!isVendorConfigured(vendor)) {
    return NextResponse.json(
      { error: `${vendor.label} is not configured. Add its OAuth credentials to the environment to enable connecting.` },
      { status: 501 },
    )
  }

  const origin = new URL(request.url).origin
  const redirectUri = `${origin}/api/hospitality/integrations/${vendor.id}/callback`
  // `state` should be a signed, single-use token tying the callback to this org;
  // a minimal org-scoped state is used here pending the per-deployment CSRF store.
  const state = Buffer.from(JSON.stringify({ org: organizationId })).toString('base64url')

  let authorizeUrl: string | null = null
  if (vendor.id === 'square') authorizeUrl = squareAuthorizeUrl(state, redirectUri)

  if (!authorizeUrl) {
    return NextResponse.json({ error: `Connect flow for ${vendor.label} is not wired yet.` }, { status: 501 })
  }
  return NextResponse.json({ authorize_url: authorizeUrl })
}
