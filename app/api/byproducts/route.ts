/**
 * Byproducts list + create.
 *
 * Each byproduct is an org-scoped record describing a circular destination
 * for a co-product stream — spent grain to a named animal-feed partner,
 * surplus yeast to a food-grade buyer, recaptured CO₂ to a carbonation
 * supplier, etc. Mass logs are kept on `byproduct_flows`.
 *
 * GET  /api/byproducts                — list, default active. ?status=all|active|paused|ended.
 * POST /api/byproducts                — create. Body validated against destination-type enum.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'
import {
  BYPRODUCT_DESTINATION_TYPES,
  type ByproductDestinationType,
} from '@/lib/byproducts/destination-types'

export const runtime = 'nodejs'

const DESTINATION_VALUES = new Set<string>(
  BYPRODUCT_DESTINATION_TYPES.map(d => d.value),
)
const STATUS_VALUES = new Set(['active', 'paused', 'ended'])
const VISIBILITY_VALUES = new Set(['private', 'platform', 'public'])

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { organizationId, error: orgErr } = await resolveUserOrganization(client as any, user)
  if (orgErr || !organizationId) {
    return NextResponse.json({ error: orgErr || 'No organisation' }, { status: 403 })
  }

  const url = new URL(request.url)
  const status = url.searchParams.get('status') || 'active'
  const limit = Math.min(Number(url.searchParams.get('limit') || '200'), 500)

  let query = (client as any)
    .from('byproducts')
    .select(
      'id, name, description, destination_type, partner_name, partner_url, contract_started, status, visibility, facility_id, created_at, updated_at',
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ byproducts: data ?? [] }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest) {
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

  const name = String(body?.name ?? '').trim()
  const destination_type = String(body?.destination_type ?? '').trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!DESTINATION_VALUES.has(destination_type)) {
    return NextResponse.json({ error: 'invalid destination_type' }, { status: 400 })
  }

  const status = body?.status && STATUS_VALUES.has(String(body.status))
    ? String(body.status)
    : 'active'
  const visibility = body?.visibility && VISIBILITY_VALUES.has(String(body.visibility))
    ? String(body.visibility)
    : 'private'

  const insertRow = {
    organization_id: organizationId,
    facility_id: body?.facility_id ?? null,
    name,
    description: body?.description ? String(body.description) : null,
    destination_type: destination_type as ByproductDestinationType,
    partner_name: body?.partner_name ? String(body.partner_name) : null,
    partner_url: body?.partner_url ? String(body.partner_url) : null,
    contract_started: body?.contract_started ?? null,
    status,
    visibility,
    created_by: user.id,
  }

  const { data, error } = await (client as any)
    .from('byproducts')
    .insert(insertRow)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ byproduct: data }, { status: 201 })
}
