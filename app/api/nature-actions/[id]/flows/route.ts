/**
 * Nature action flow logging.
 *
 * GET  /api/nature-actions/[id]/flows  — list flows newest first.
 * POST /api/nature-actions/[id]/flows  — log hectares actively delivering
 *                                        ecological value during a period.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } },
) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }

  const { data, error } = await (client as any)
    .from('nature_action_flows')
    .select('id, nature_action_id, reporting_period_start, reporting_period_end, hectares_active, notes, created_at')
    .eq('nature_action_id', context.params.id)
    .eq('organization_id', organizationId)
    .order('reporting_period_end', { ascending: false })
    .limit(120)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ flows: data ?? [] }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }
  const denied = await denyReadOnlyAdvisor(client as any, user, organizationId)
  if (denied) return denied

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const hectares_active = Number(body?.hectares_active)
  if (!Number.isFinite(hectares_active) || hectares_active < 0) {
    return NextResponse.json(
      { error: 'hectares_active must be a non-negative number' },
      { status: 400 },
    )
  }
  const start = body?.reporting_period_start
  const end = body?.reporting_period_end
  if (!start || !end) {
    return NextResponse.json(
      { error: 'reporting_period_start and reporting_period_end required' },
      { status: 400 },
    )
  }

  const { data: action, error: lookupErr } = await (client as any)
    .from('nature_actions')
    .select('id, organization_id')
    .eq('id', context.params.id)
    .eq('organization_id', organizationId)
    .single()
  if (lookupErr || !action) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  }

  const { data, error } = await (client as any)
    .from('nature_action_flows')
    .insert({
      nature_action_id: context.params.id,
      organization_id: organizationId,
      reporting_period_start: start,
      reporting_period_end: end,
      hectares_active,
      notes: body?.notes ? String(body.notes) : null,
      created_by: user.id,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flow: data }, { status: 201 })
}
