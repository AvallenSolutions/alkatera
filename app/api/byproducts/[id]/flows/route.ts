/**
 * Byproduct flow logging.
 *
 * GET  /api/byproducts/[id]/flows     — list flows for one byproduct, newest first.
 * POST /api/byproducts/[id]/flows     — log a mass entry for a reporting period.
 *
 * Mass is in kilograms. The reporting period can be a single month, quarter,
 * or year — whatever cadence the org tracks at. The score integration uses
 * `reporting_period_end` to bucket flows into current vs prior year.
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
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }

  const { data, error } = await (client as any)
    .from('byproduct_flows')
    .select('id, byproduct_id, reporting_period_start, reporting_period_end, mass_kg, unit, notes, created_at')
    .eq('byproduct_id', context.params.id)
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
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
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

  const mass_kg = Number(body?.mass_kg)
  if (!Number.isFinite(mass_kg) || mass_kg <= 0) {
    return NextResponse.json({ error: 'mass_kg must be a positive number' }, { status: 400 })
  }
  const start = body?.reporting_period_start
  const end = body?.reporting_period_end
  if (!start || !end) {
    return NextResponse.json(
      { error: 'reporting_period_start and reporting_period_end required' },
      { status: 400 },
    )
  }

  // Confirm the byproduct belongs to this org before inserting a flow.
  const { data: byproduct, error: lookupErr } = await (client as any)
    .from('byproducts')
    .select('id, organization_id')
    .eq('id', context.params.id)
    .eq('organization_id', organizationId)
    .single()
  if (lookupErr || !byproduct) {
    return NextResponse.json({ error: 'Byproduct not found' }, { status: 404 })
  }

  const { data, error } = await (client as any)
    .from('byproduct_flows')
    .insert({
      byproduct_id: context.params.id,
      organization_id: organizationId,
      reporting_period_start: start,
      reporting_period_end: end,
      mass_kg,
      unit: body?.unit ? String(body.unit) : 'kg',
      notes: body?.notes ? String(body.notes) : null,
      created_by: user.id,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ flow: data }, { status: 201 })
}
