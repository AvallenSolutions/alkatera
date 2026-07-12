/**
 * Live-integration vendor catalogue with per-vendor configured status.
 * GET /api/hospitality/integrations → { vendors: [...] }
 *
 * `configured` reflects whether the vendor's OAuth/API credentials are present in
 * the environment. Until then a vendor shows as "needs setup" and its connect
 * flow returns 501 — nothing implies a connection that doesn't exist.
 */
import { NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { vendorCatalogue } from '@/lib/hospitality/integrations/adapter'

export const runtime = 'nodejs'

export async function GET() {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  return NextResponse.json({ vendors: vendorCatalogue() }, { headers: { 'Cache-Control': 'no-store' } })
}
