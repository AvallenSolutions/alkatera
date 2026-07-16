/**
 * The confirmed-share rollup, served up.
 *
 * GET /api/provenance — "how much of your footprint is confirmed", 0 to
 * 100, plus the per-area breakdown (products, utilities, packaging). Same
 * auth and shape as the /api/growth sibling; privately cacheable for two
 * minutes so the surfaces this feeds (later phases: the forest, report
 * gating, the Ask Queue) don't recompute it on every render.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { computeConfirmedShare } from '@/lib/provenance/rollup'

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

  const rollup = await computeConfirmedShare(client as any, organizationId)

  return NextResponse.json(rollup, {
    headers: { 'Cache-Control': 'private, max-age=120' },
  })
}
