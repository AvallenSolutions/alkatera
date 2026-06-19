/**
 * Hospitality menu detail + update + delete.
 * GET    /api/hospitality/menus/[id]  — menu + items with LIVE per-serving impact + aggregate.
 * PATCH  /api/hospitality/menus/[id]  — update name / description / venue.
 * DELETE /api/hospitality/menus/[id]  — delete the menu (items cascade).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'
import { getMenu, updateMenu, deleteMenu } from '@/lib/hospitality/menu-service'

export const runtime = 'nodejs'

async function auth() {
  const { client, user, error } = await getSupabaseAPIClient()
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { organizationId, error: orgErr } = await resolveUserOrganization(client as any, user)
  if (orgErr || !organizationId) return { error: NextResponse.json({ error: orgErr || 'No organisation' }, { status: 403 }) }
  return { db: client as any, organizationId }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const a = await auth()
  if ('error' in a) return a.error
  const r = await getMenu(a.db, a.organizationId, params.id)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ menu: r.data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await auth()
  if ('error' in a) return a.error
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const r = await updateMenu(a.db, a.organizationId, params.id, body)
  return r.ok ? NextResponse.json(r.data) : NextResponse.json({ error: r.error }, { status: r.status })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const a = await auth()
  if ('error' in a) return a.error
  const r = await deleteMenu(a.db, a.organizationId, params.id)
  return r.ok ? NextResponse.json(r.data) : NextResponse.json({ error: r.error }, { status: r.status })
}
