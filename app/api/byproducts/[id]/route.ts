/**
 * Byproduct edit + soft-delete.
 *
 * PATCH  /api/byproducts/[id]         — update mutable fields. Body keys are
 *                                       a subset of the create payload.
 * DELETE /api/byproducts/[id]         — soft-delete via status='ended'. Hard
 *                                       deletes are not exposed; ending a
 *                                       partnership preserves history so
 *                                       previous achievements stay reflected
 *                                       in the circularity-score YoY trend.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import { BYPRODUCT_DESTINATION_TYPES } from '@/lib/byproducts/destination-types'

export const runtime = 'nodejs'

const DESTINATION_VALUES = new Set<string>(BYPRODUCT_DESTINATION_TYPES.map(d => d.value))
const STATUS_VALUES = new Set(['active', 'paused', 'ended'])
const VISIBILITY_VALUES = new Set(['private', 'platform', 'public'])

const MUTABLE_FIELDS = [
  'name',
  'description',
  'destination_type',
  'partner_name',
  'partner_url',
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

  const update: Record<string, unknown> = {}
  for (const field of MUTABLE_FIELDS) {
    if (body[field] !== undefined) update[field] = body[field]
  }
  if (
    update.destination_type !== undefined &&
    !DESTINATION_VALUES.has(String(update.destination_type))
  ) {
    return NextResponse.json({ error: 'invalid destination_type' }, { status: 400 })
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
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no mutable fields supplied' }, { status: 400 })
  }

  const { data, error } = await (client as any)
    .from('byproducts')
    .update(update)
    .eq('id', context.params.id)
    .eq('organization_id', organizationId)
    .select()
    .single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Byproduct not found' }, { status: 404 })
  }
  return NextResponse.json({ byproduct: data })
}

export async function DELETE(
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
  const denied = await denyReadOnlyAdvisor(client as any, user, organizationId)
  if (denied) return denied

  // Soft-delete: set status='ended', preserve flows.
  const { data, error } = await (client as any)
    .from('byproducts')
    .update({ status: 'ended' })
    .eq('id', context.params.id)
    .eq('organization_id', organizationId)
    .select('id, status')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Byproduct not found' }, { status: 404 })
  return NextResponse.json({ byproduct: data })
}
