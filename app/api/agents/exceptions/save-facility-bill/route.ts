import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'

export const runtime = 'nodejs'

// Internal save shim used by the agent approve flow for water/waste bills.
// The user-facing path saves through the supabase edge function
// `add-facility-activity-entry`, which expects a Bearer access token. The
// agent approve route forwards cookies from the original request to here;
// we exchange those for a session token and then call the edge function.
//
// We could call the edge function directly from the approve route — but the
// session-token plumbing is messy across cookie vs. bearer paths, and
// keeping it in a thin route lets us iterate on the save shape without
// touching the approve dispatcher.

interface SaveRequest {
  kind: 'water_bill' | 'waste_bill'
  facilityId: string
  organizationId: string
  periodStart: string
  periodEnd: string
  billName?: string
  bill: any
}

export async function POST(request: NextRequest) {
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

  const body = (await request.json()) as SaveRequest
  if (body.organizationId !== organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const entries = (body.bill?.entries || []).filter(
    (e: any) => e.activity_category && e.quantity > 0,
  )
  if (entries.length === 0) {
    return NextResponse.json({ error: 'No valid entries' }, { status: 400 })
  }

  // Insert facility_activity_entries rows directly via the service-role
  // path. add-facility-activity-entry edge fn enriches a few fields, but
  // for the agent path we keep it simple — the calculation worker picks
  // these up the same way regardless of how they were inserted.
  const trimmed = (body.billName || '').trim()
  const rows = entries.map((entry: any) => {
    const entryName = trimmed
      ? entries.length > 1
        ? `${trimmed} — ${entry.activity_category}`
        : trimmed
      : null
    const extra: Record<string, any> = {}
    if (body.kind === 'water_bill' && entry.water_source_type) {
      extra.water_source_type = entry.water_source_type
    }
    if (body.kind === 'waste_bill' && entry.waste_treatment_method) {
      extra.waste_treatment_method = entry.waste_treatment_method
    }
    return {
      facility_id: body.facilityId,
      organization_id: organizationId,
      activity_category: entry.activity_category,
      activity_date: body.periodStart,
      reporting_period_start: body.periodStart,
      reporting_period_end: body.periodEnd,
      quantity: entry.quantity,
      unit: entry.unit || (body.kind === 'water_bill' ? 'm3' : 'kg'),
      data_provenance: 'primary_measured_onsite',
      allocation_basis: 'none',
      name: entryName,
      created_by: user.id,
      ...extra,
    }
  })

  const { error: insertErr } = await (client as any)
    .from('facility_activity_entries')
    .insert(rows)

  if (insertErr) {
    console.error('[agents/save-facility-bill] insert failed:', insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ saved: rows.length })
}
