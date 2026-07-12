/**
 * The growth score behind the growth field.
 *
 * GET /api/growth — one number for the desk and the room landings: how
 * complete the org's data is, 0 to 100, plus the per-band points for
 * anyone curious. The forest grows on this. Same auth and shape as the
 * /api/<room>/counts siblings; privately cacheable for two minutes so
 * walking between the eight surfaces does not recompute it every time.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { computeGrowthScore } from '@/lib/desk/growth-score'

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

  const { score, bands } = await computeGrowthScore(client as any, organizationId)

  return NextResponse.json(
    { score, bands },
    { headers: { 'Cache-Control': 'private, max-age=120' } },
  )
}
