/**
 * What this business works with: vineyards, orchards, arable fields,
 * hospitality.
 *
 * GET  /api/organization/works-with?organizationId=…  → the declared modules
 * PUT  /api/organization/works-with                   → replace them
 *
 * Declared need, not entitlement. Saying "yes, we have vineyards" makes the
 * module appear in the workbench; the Canopy tier is what makes it open (see
 * lib/subscription/works-with.ts and lib/subscription/module-access.ts).
 * Writing it therefore grants nothing commercial, so any member of the org
 * may answer the question — it is a fact about the business, not a setting.
 *
 * Written by the arrival ritual's modules step and by Settings > Organisation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg, userHasOrgAccess } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import { parseWorksWith, tierOpensModules } from '@/lib/subscription/works-with'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = await resolveAccessibleOrg(
    client as any,
    user,
    request.nextUrl.searchParams.get('organizationId'),
  )
  if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 })

  const { data, error } = await (client as any)
    .from('organizations')
    .select('works_with, subscription_tier')
    .eq('id', organizationId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    worksWith: parseWorksWith(data?.works_with),
    unlocked: tierOpensModules(data?.subscription_tier),
  })
}

export async function PUT(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { organizationId?: string; worksWith?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const organizationId = await resolveAccessibleOrg(client as any, user, body.organizationId ?? null)
  if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 })

  const hasAccess = await userHasOrgAccess(client as any, user.id, organizationId)
  if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const denied = await denyReadOnlyAdvisor(client as any, user, organizationId)
  if (denied) return denied

  // Anything unrecognised is dropped rather than rejected: the DB CHECK only
  // accepts the four known keys, and a stale client sending a fifth should
  // not fail the whole save.
  const worksWith = parseWorksWith(body.worksWith)

  const { error } = await (client as any)
    .from('organizations')
    .update({ works_with: worksWith })
    .eq('id', organizationId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ worksWith })
}
