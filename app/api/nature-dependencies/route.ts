/**
 * Nature dependencies — declared materiality on ecosystem services.
 *
 * GET    /api/nature-dependencies      — list current declarations.
 * PUT    /api/nature-dependencies      — upsert (one declaration per
 *                                         dependency_type per org). Body:
 *                                         { dependency_type, materiality, notes? }.
 * DELETE /api/nature-dependencies?type=… — remove a declaration.
 *
 * Each row corresponds to one (org, dependency_type) pair via the unique
 * constraint, so an upsert is the right primitive — declaring a new
 * materiality replaces any prior declaration.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import { NATURE_DEPENDENCIES } from '@/lib/nature-context/dependency-types'

export const runtime = 'nodejs'

const TYPE_VALUES = new Set<string>(NATURE_DEPENDENCIES.map(d => d.value))
const MATERIALITY_VALUES = new Set(['low', 'medium', 'high', 'critical'])

export async function GET(_request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }

  const { data, error } = await (client as any)
    .from('nature_dependencies')
    .select('id, dependency_type, materiality, notes, source, created_at, updated_at')
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ dependencies: data ?? [] }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function PUT(request: NextRequest) {
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

  const dependency_type = String(body?.dependency_type ?? '').trim()
  const materiality = String(body?.materiality ?? '').trim()
  if (!TYPE_VALUES.has(dependency_type)) {
    return NextResponse.json({ error: 'invalid dependency_type' }, { status: 400 })
  }
  if (!MATERIALITY_VALUES.has(materiality)) {
    return NextResponse.json({ error: 'invalid materiality' }, { status: 400 })
  }

  const row = {
    organization_id: organizationId,
    dependency_type,
    materiality,
    notes: body?.notes ? String(body.notes) : null,
    source: 'self-declared',
    created_by: user.id,
  }

  const { data, error } = await (client as any)
    .from('nature_dependencies')
    .upsert(row, { onConflict: 'organization_id,facility_id,dependency_type' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dependency: data })
}

export async function DELETE(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }
  const denied = await denyReadOnlyAdvisor(client as any, user, organizationId)
  if (denied) return denied

  const url = new URL(request.url)
  const dependency_type = url.searchParams.get('type')
  if (!dependency_type || !TYPE_VALUES.has(dependency_type)) {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 })
  }

  const { error } = await (client as any)
    .from('nature_dependencies')
    .delete()
    .eq('organization_id', organizationId)
    .eq('dependency_type', dependency_type)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
