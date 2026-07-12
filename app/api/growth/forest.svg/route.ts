/**
 * The forest as a downloadable artefact.
 *
 * GET /api/growth/forest.svg — the org's living signature: the same
 * seeded population the growth field draws, rendered standalone at the
 * org's current score, dressed for today's season. Linked from the
 * "Your forest" panel; ready for report covers later. Same auth as
 * /api/growth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { computeGrowthScore } from '@/lib/desk/growth-score'
import { buildForestSvg } from '@/components/studio/growth/render-svg'
import { hemisphereForCountry, seasonForDate } from '@/components/studio/growth/season'

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

  const [{ score }, org] = await Promise.all([
    computeGrowthScore(client as any, organizationId),
    (client as any)
      .from('organizations')
      .select('country')
      .eq('id', organizationId)
      .maybeSingle(),
  ])
  const season = seasonForDate(new Date(), hemisphereForCountry(org?.data?.country))
  const svg = buildForestSvg({ seed: organizationId, score, season })

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'private, max-age=300',
    },
  })
}
