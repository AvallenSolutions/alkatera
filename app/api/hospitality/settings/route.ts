/**
 * Per-org hospitality function selection.
 * GET /api/hospitality/settings  → { meals, drinks, rooms, configured }
 * PUT /api/hospitality/settings  → upsert the chosen functions (sets configured=true)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import { DEFAULT_HOSPITALITY_SETTINGS } from '@/lib/hospitality/settings'

export const runtime = 'nodejs'

async function auth() {
  const { client, user, error } = await getSupabaseAPIClient()
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) return { error: NextResponse.json({ error: 'No organisation' }, { status: 403 }) }
  return { db: client as any, organizationId, userId: user.id }
}

export async function GET() {
  const a = await auth()
  if ('error' in a) return a.error
  const { data } = await a.db
    .from('hospitality_settings')
    .select('meals, drinks, rooms, configured')
    .eq('organization_id', a.organizationId)
    .maybeSingle()
  const settings = data
    ? { meals: !!data.meals, drinks: !!data.drinks, rooms: !!data.rooms, configured: !!data.configured }
    : { ...DEFAULT_HOSPITALITY_SETTINGS }
  return NextResponse.json({ settings }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(request: NextRequest) {
  const a = await auth()
  if ('error' in a) return a.error
  const denied = await denyReadOnlyAdvisor(a.db, { id: a.userId }, a.organizationId)
  if (denied) return denied

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const meals = !!body?.meals
  const drinks = !!body?.drinks
  const rooms = !!body?.rooms
  if (!meals && !drinks && !rooms) {
    return NextResponse.json({ error: 'Choose at least one function.' }, { status: 400 })
  }

  const { error } = await a.db
    .from('hospitality_settings')
    .upsert(
      { organization_id: a.organizationId, meals, drinks, rooms, configured: true },
      { onConflict: 'organization_id' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ settings: { meals, drinks, rooms, configured: true } })
}
