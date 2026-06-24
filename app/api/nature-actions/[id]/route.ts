/**
 * Nature action edit + soft-delete.
 *
 * PATCH  /api/nature-actions/[id]      — update mutable fields.
 * DELETE /api/nature-actions/[id]      — soft-delete via status='ended'.
 *                                       History preserved.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import { NATURE_ACTION_TYPES } from '@/lib/nature-actions/action-types'

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

const MUTABLE_FIELDS = [
  'name',
  'description',
  'action_type',
  'hectares',
  'partner_name',
  'partner_url',
  'location',
  'contract_started',
  'status',
  'visibility',
  'facility_id',
] as const

export async function PATCH(
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

  const update: Record<string, unknown> = {}
  for (const field of MUTABLE_FIELDS) {
    if (body[field] !== undefined) update[field] = body[field]
  }
  if (
    update.action_type !== undefined &&
    !ACTION_TYPE_VALUES.has(String(update.action_type))
  ) {
    return NextResponse.json({ error: 'invalid action_type' }, { status: 400 })
  }
  if (update.status !== undefined && !STATUS_VALUES.has(String(update.status))) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })
  }
  if (
    update.visibility !== undefined &&
    !VISIBILITY_VALUES.has(String(update.visibility))
  ) {
    return NextResponse.json({ error: 'invalid visibility' }, { status: 400 })
  }
  if (update.hectares !== undefined) {
    const ha = Number(update.hectares)
    if (!Number.isFinite(ha) || ha < 0) {
      return NextResponse.json({ error: 'hectares must be a non-negative number' }, { status: 400 })
    }
    update.hectares = ha
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no mutable fields supplied' }, { status: 400 })
  }

  const { data, error } = await (client as any)
    .from('nature_actions')
    .update(update)
    .eq('id', context.params.id)
    .eq('organization_id', organizationId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  return NextResponse.json({ action: data })
}

export async function DELETE(
  _request: NextRequest,
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

  const { data, error } = await (client as any)
    .from('nature_actions')
    .update({ status: 'ended' })
    .eq('id', context.params.id)
    .eq('organization_id', organizationId)
    .select('id, status')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  return NextResponse.json({ action: data })
}
