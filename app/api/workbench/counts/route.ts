/**
 * The workbench landing's live numbers.
 *
 * GET /api/workbench/counts — one cheap round trip for the landing's fact
 * rows: sites, vehicles, growing sites, hospitality venues, plus whether
 * Xero is connected and which beta rooms this org has keys to. Counts only
 * (head queries), no rows; the landing must stay light. Sibling of
 * /api/desk/counts, same shape and auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'

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
      db.from('organizations').select('feature_flags').eq('id', organizationId).single(),
    ])

  // feature_flags is a jsonb object map: {"hospitality_beta": true, ...}
  const flags: Record<string, unknown> =
    org?.data?.feature_flags && typeof org.data.feature_flags === 'object'
      ? org.data.feature_flags
      : {}

  return NextResponse.json({
    facilities,
    vehicles,
    vineyards,
    orchards,
    arableFields,
    venues,
    xeroConnected: xeroConnections > 0,
    flags: {
      viticulture: flags['viticulture_beta'] === true,
      orchard: flags['orchard_beta'] === true,
      arable: flags['arable_beta'] === true,
      hospitality: flags['hospitality_beta'] === true,
    },
  })
}
