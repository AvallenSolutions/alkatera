/**
 * Hospitality venues list + create.
 *
 * A venue is an org-scoped restaurant / bar / accommodation that anchors
 * per-venue hospitality reporting. Gated behind the `hospitality_beta` flag at
 * the UI/layout level; this route enforces organisation scoping.
 *
 * GET  /api/hospitality/venues   — list, default active. ?status=all|active|archived.
 * POST /api/hospitality/venues   — create. Body validated against the venue-type enum.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import {
  VENUE_TYPE_VALUES,
  VENUE_STATUS_VALUES,
  type VenueType,
} from '@/lib/hospitality/venue-types'

export const runtime = 'nodejs'

const VENUE_COLUMNS =
  'id, organization_id, facility_id, name, venue_type, description, status, created_at, updated_at, created_by'

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }

  const url = new URL(request.url)
  const status = url.searchParams.get('status') || 'active'

  let query = (client as any)
    .from('hospitality_venues')
    .select(VENUE_COLUMNS)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ venues: data ?? [] }, {
    headers: { 'Cache-Control': 'no-store' },
  })
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

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = String(body?.name ?? '').trim()
  const venue_type = String(body?.venue_type ?? '').trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!VENUE_TYPE_VALUES.has(venue_type)) {
    return NextResponse.json({ error: 'invalid venue_type' }, { status: 400 })
  }

  const insertRow = {
    organization_id: organizationId,
    facility_id: body?.facility_id ?? null,
    name,
    venue_type: venue_type as VenueType,
    description: body?.description ? String(body.description) : null,
    status: VENUE_STATUS_VALUES.has(String(body?.status)) ? String(body.status) : 'active',
    created_by: user.id,
  }

  const { data, error } = await (client as any)
    .from('hospitality_venues')
    .insert(insertRow)
    .select(VENUE_COLUMNS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ venue: data }, { status: 201 })
}
