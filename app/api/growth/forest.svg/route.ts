/**
 * The forest as a downloadable artefact.
 *
 * GET /api/growth/forest.svg — the org's living signature: the same
 * seeded population the growth field draws, stamped with the brand, who
 * tended it, and the date. The "Your forest" panel passes the exact
 * view state (score, season, Rosa's session spot) so the download IS
 * what the user was looking at; each parameter is validated and falls
 * back to the server's own truth (computed score, the org's real
 * season) when absent. Same auth as /api/growth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { computeGrowthScore } from '@/lib/desk/growth-score'
import { buildForestSvg } from '@/components/studio/growth/render-svg'
import { FIELD_W } from '@/components/studio/growth/layout'
import {
  hemisphereForCountry,
  seasonForDate,
  type Season,
} from '@/components/studio/growth/season'

export const runtime = 'nodejs'

const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter']

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

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

  const sp = url.searchParams

  // The view state, validated; the server's own truth when absent.
  const forcedScore = Number(sp.get('score'))
  const forcedSeason = sp.get('season') as Season | null
  const rosaX = Number(sp.get('rosaX'))

  const needsComputedScore = !Number.isFinite(forcedScore)
  const [computed, org] = await Promise.all([
    needsComputedScore ? computeGrowthScore(client as any, organizationId) : null,
    (client as any)
      .from('organizations')
      .select('name, country')
      .eq('id', organizationId)
      .maybeSingle(),
  ])

  const score = needsComputedScore
    ? (computed?.score ?? 0)
    : Math.round(clamp(forcedScore, 0, 100))
  const season =
    forcedSeason && SEASONS.includes(forcedSeason)
      ? forcedSeason
      : seasonForDate(new Date(), hemisphereForCountry(org?.data?.country))
  const rosa = Number.isFinite(rosaX)
    ? { x: Math.round(clamp(rosaX, 0, FIELD_W)), flip: sp.get('rosaFlip') === '1' }
    : undefined

  // The maker's stamp: brand, who tended it, and the day.
  const brand = (org?.data?.name as string | undefined)?.trim() || 'Our forest'
  const tendedBy =
    (user.user_metadata?.full_name as string | undefined)?.trim() || user.email || null
  const date = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  const svg = buildForestSvg({
    seed: organizationId,
    score,
    season,
    rosa,
    caption: { brand, user: tendedBy, date },
  })

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'private, max-age=300',
    },
  })
}
