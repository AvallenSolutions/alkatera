/**
 * Hospitality venue update + delete.
 *
 * PATCH  /api/hospitality/venues/[id]   — update name/type/description/status.
 * DELETE /api/hospitality/venues/[id]   — remove the venue.
 *
 * Org scoping is enforced on every mutation (the `.eq('organization_id', …)`
 * guards belt-and-braces over RLS).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'
import {
  VENUE_TYPE_VALUES,
  VENUE_STATUS_VALUES,
} from '@/lib/hospitality/venue-types'

export const runtime = 'nodejs'

const VENUE_COLUMNS =
  'id, organization_id, facility_id, name, venue_type, description, status, created_at, updated_at, created_by'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { organizationId, error: orgErr } = await resolveUserOrganization(client as any, user)
  if (orgErr || !organizationId) {
    return NextResponse.json({ error: orgErr || 'No organisation' }, { status: 403 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body?.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    updates.name = name
  }
  if (body?.venue_type !== undefined) {
    const venue_type = String(body.venue_type).trim()
    if (!VENUE_TYPE_VALUES.has(venue_type)) {
      return NextResponse.json({ error: 'invalid venue_type' }, { status: 400 })
    }
    updates.venue_type = venue_type
  }
  if (body?.description !== undefined) {
    updates.description = body.description ? String(body.description) : null
  }
  if (body?.facility_id !== undefined) {
    updates.facility_id = body.facility_id ?? null
  }
  if (body?.status !== undefined) {
    const status = String(body.status)
    if (!VENUE_STATUS_VALUES.has(status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    }
    updates.status = status
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updatable fields provided' }, { status: 400 })
  }

  const { data, error } = await (client as any)
    .from('hospitality_venues')
    .update(updates)
    .eq('id', params.id)
    .eq('organization_id', organizationId)
    .select(VENUE_COLUMNS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Venue not found' }, { status: 404 })

  return NextResponse.json({ venue: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { organizationId, error: orgErr } = await resolveUserOrganization(client as any, user)
  if (orgErr || !organizationId) {
    return NextResponse.json({ error: orgErr || 'No organisation' }, { status: 403 })
  }

  const { error } = await (client as any)
    .from('hospitality_venues')
    .delete()
    .eq('id', params.id)
    .eq('organization_id', organizationId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
