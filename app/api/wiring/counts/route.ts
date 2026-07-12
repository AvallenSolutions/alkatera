/**
 * The wiring landing's live numbers.
 *
 * GET /api/wiring/counts — one cheap round trip for the landing: THE PLAN
 * poster (subscription tier, status, renewal from the organizations row) and
 * the fact rows (team members, connected integrations, EPR obligation size,
 * the three social/governance scores, byproducts and nature actions). Counts
 * are head queries; the scores are latest-row reads of the *_scores tables
 * the vitality pillars already consume. Sibling of /api/library/counts, same
 * shape and auth.
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

  const count = async (table: string) => {
    const { count: n, error } = await db
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
    return error ? 0 : (n ?? 0)
  }

  /** Latest overall_score from a *_scores table, or null before first calc. */
  const latestScore = async (table: string) => {
    const { data, error } = await db
      .from(table)
      .select('overall_score')
      .eq('organization_id', organizationId)
      .order('calculation_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    return error ? null : (data?.overall_score ?? null)
  }

  const [org, members, integrations, eprSettings, people, governance, community, byproducts, natureActions] =
    await Promise.all([
      db
        .from('organizations')
        .select('subscription_tier, subscription_status, current_period_end')
        .eq('id', organizationId)
        .maybeSingle(),
      count('organization_members'),
      count('integration_connections'),
      db
        .from('epr_organization_settings')
        .select('obligation_size')
        .eq('organization_id', organizationId)
        .maybeSingle(),
      latestScore('people_culture_scores'),
      latestScore('governance_scores'),
      latestScore('community_impact_scores'),
      count('byproducts'),
      count('nature_actions'),
    ])

  return NextResponse.json({
    plan: {
      tier: org?.data?.subscription_tier ?? null,
      status: org?.data?.subscription_status ?? null,
      renewsAt: org?.data?.current_period_end ?? null,
    },
    members,
    integrations,
    eprObligation: eprSettings?.data?.obligation_size ?? null,
    scores: { people, governance, community },
    byproducts,
    natureActions,
  })
}
