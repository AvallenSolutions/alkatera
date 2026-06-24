/**
 * Supplier responsibility attestations.
 *
 * GET    /api/supplier-responsibility       — list current attestations.
 * PUT    /api/supplier-responsibility       — upsert (one per attestation type per org).
 *                                              Body: { attestation_type, is_attested, evidence_url?, notes? }.
 * DELETE /api/supplier-responsibility?type=…— remove an attestation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import { SUPPLIER_ATTESTATIONS } from '@/lib/supplier-responsibility/attestation-types'

export const runtime = 'nodejs'

const TYPE_VALUES = new Set<string>(SUPPLIER_ATTESTATIONS.map(a => a.value))

export async function GET(_request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }

  const { data, error } = await (client as any)
    .from('supplier_responsibility_attestations')
    .select('id, attestation_type, is_attested, evidence_url, notes, created_at, updated_at')
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ attestations: data ?? [] }, {
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

  const attestation_type = String(body?.attestation_type ?? '').trim()
  if (!TYPE_VALUES.has(attestation_type)) {
    return NextResponse.json({ error: 'invalid attestation_type' }, { status: 400 })
  }
  const is_attested = body?.is_attested !== false // default true

  const row = {
    organization_id: organizationId,
    attestation_type,
    is_attested,
    evidence_url: body?.evidence_url ? String(body.evidence_url) : null,
    notes: body?.notes ? String(body.notes) : null,
    created_by: user.id,
  }

  const { data, error } = await (client as any)
    .from('supplier_responsibility_attestations')
    .upsert(row, { onConflict: 'organization_id,attestation_type' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attestation: data })
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
  const attestation_type = url.searchParams.get('type')
  if (!attestation_type || !TYPE_VALUES.has(attestation_type)) {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 })
  }

  const { error } = await (client as any)
    .from('supplier_responsibility_attestations')
    .delete()
    .eq('organization_id', organizationId)
    .eq('attestation_type', attestation_type)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
