/**
 * The workbench landing's live numbers.
 *
 * GET /api/workbench/counts — one cheap round trip for the landing's fact
 * rows: sites, vehicles, growing sites, hospitality venues, plus whether
 * Xero is connected, which modules this org has declared it works with, and
 * whether its tier opens them. Counts only (head queries), no rows; the
 * landing must stay light. Sibling of /api/desk/counts, same shape and auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { parseWorksWith, tierOpensModules } from '@/lib/subscription/works-with'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const organizationId = await resolveAccessibleOrg(
    client as any,
    user,
    url.searchParams.get('organization_id'),
  )
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }

  const db = client as any
  const count = async (table: string, column = 'organization_id') => {
    const { count: n, error } = await db
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(column, organizationId)
    return error ? 0 : (n ?? 0)
  }

  const [facilities, vehicles, vineyards, orchards, arableFields, venues, xeroConnections, org] =
    await Promise.all([
      count('facilities'),
      count('vehicles'),
      count('vineyards'),
      count('orchards'),
      count('arable_fields'),
      count('hospitality_venues'),
      count('xero_connections'),
      db
        .from('organizations')
        .select('works_with, subscription_tier')
        .eq('id', organizationId)
        .single(),
    ])

  // Declared is what the business says it does; entitled is what its plan
  // opens. The landing shows every declared module and marks the ones the
  // tier does not yet reach.
  const worksWith = parseWorksWith(org?.data?.works_with)

  return NextResponse.json({
    facilities,
    vehicles,
    vineyards,
    orchards,
    arableFields,
    venues,
    xeroConnected: xeroConnections > 0,
    worksWith,
    modulesUnlocked: tierOpensModules(org?.data?.subscription_tier),
  })
}
