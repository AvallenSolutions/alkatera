/**
 * Hospitality event detail + update + delete.
 * GET / PATCH / DELETE /api/hospitality/events/[id]
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import { getEvent, updateEvent, deleteEvent } from '@/lib/hospitality/event-service'

export const runtime = 'nodejs'

async function auth() {
  const { client, user, error } = await getSupabaseAPIClient()
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) return { error: NextResponse.json({ error: 'No organisation' }, { status: 403 }) }
  return { db: client as any, organizationId, user }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const a = await auth()
  if ('error' in a) return a.error
  const r = await getEvent(a.db, a.organizationId, params.id)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ event: r.data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await auth()
  if ('error' in a) return a.error
  const denied = await denyReadOnlyAdvisor(a.db, a.user, a.organizationId)
  if (denied) return denied
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const r = await updateEvent(a.db, a.organizationId, params.id, body)
  return r.ok ? NextResponse.json(r.data) : NextResponse.json({ error: r.error }, { status: r.status })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const a = await auth()
  if ('error' in a) return a.error
  const denied = await denyReadOnlyAdvisor(a.db, a.user, a.organizationId)
  if (denied) return denied
  const r = await deleteEvent(a.db, a.organizationId, params.id)
  return r.ok ? NextResponse.json(r.data) : NextResponse.json({ error: r.error }, { status: r.status })
}
