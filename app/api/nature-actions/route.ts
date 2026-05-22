/**
 * Nature-positive actions list + create.
 *
 * GET  /api/nature-actions             — list, default active. ?status=all|active|planned|paused|ended.
 * POST /api/nature-actions             — create. Validates against action_type enum.
 *
 * Mirrors the byproducts module pattern: org-scoped, soft-delete via
 * status='ended' to preserve history. Hectares logged via flows.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'
import { NATURE_ACTION_TYPES, type NatureActionType } from '@/lib/nature-actions/action-types'

export const runtime = 'nodejs'

const ACTION_TYPE_VALUES = new Set<string>(NATURE_ACTION_TYPES.map(t => t.value))
const STATUS_VALUES = new Set([
  'planned',
  'in_progress',
  'established',
  'paused',
  'ended',
])
const VISIBILITY_VALUES = new Set(['private', 'platform', 'public'])

const ACTIVE_STATUSES = ['planned', 'in_progress', 'established', 'paused']

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { organizationId, error: orgErr } = await resolveUserOrganization(client as any, user)
  if (orgErr || !organizationId) {
    return NextResponse.json({ error: orgErr || 'No organisation' }, { status: 403 })
  }

  const url = new URL(request.url)
  const status = url.searchParams.get('status') || 'active'
  const limit = Math.min(Number(url.searchParams.get('limit') || '200'), 500)

  let query = (client as any)
    .from('nature_actions')
    .select(
      'id, name, description, action_type, hectares, partner_name, partner_url, location, contract_started, status, visibility, facility_id, created_at, updated_at',
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status === 'active') query = query.in('status', ACTIVE_STATUSES)
  else if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ actions: data ?? [] }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  const action_type = String(body?.action_type ?? '').trim()
  const hectares = Number(body?.hectares)
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!ACTION_TYPE_VALUES.has(action_type)) {
    return NextResponse.json({ error: 'invalid action_type' }, { status: 400 })
  }
  if (!Number.isFinite(hectares) || hectares < 0) {
    return NextResponse.json({ error: 'hectares must be a non-negative number' }, { status: 400 })
  }

  const status = body?.status && STATUS_VALUES.has(String(body.status))
    ? String(body.status)
    : 'in_progress'
  const visibility = body?.visibility && VISIBILITY_VALUES.has(String(body.visibility))
    ? String(body.visibility)
    : 'private'

  const insertRow = {
    organization_id: organizationId,
    facility_id: body?.facility_id ?? null,
    name,
    description: body?.description ? String(body.description) : null,
    action_type: action_type as NatureActionType,
    hectares,
    partner_name: body?.partner_name ? String(body.partner_name) : null,
    partner_url: body?.partner_url ? String(body.partner_url) : null,
    location: body?.location ? String(body.location) : null,
    contract_started: body?.contract_started ?? null,
    status,
    visibility,
    created_by: user.id,
  }

  const { data, error } = await (client as any)
    .from('nature_actions')
    .insert(insertRow)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ action: data }, { status: 201 })
}
