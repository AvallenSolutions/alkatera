/**
 * Org wine/spirit products (product_kind='product') for the own-product drink
 * picker — each with its LIVE per-bottle carbon, so a winery can put its own
 * wines on a menu and have the impact flow from the existing product LCA (#3).
 *
 * GET /api/hospitality/wines
 */

import { NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { listWines } from '@/lib/hospitality/menu-service'

export const runtime = 'nodejs'

export async function GET() {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 })

  const r = await listWines(client as any, organizationId)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ wines: r.data }, { headers: { 'Cache-Control': 'no-store' } })
}
