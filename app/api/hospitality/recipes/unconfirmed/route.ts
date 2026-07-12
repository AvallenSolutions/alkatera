/**
 * Recipes (meals / drinks / rooms) whose ingredient quantities are still import
 * placeholders or AI estimates — the work-list for the bulk quantity grid.
 * GET /api/hospitality/recipes/unconfirmed
 */

import { NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { listUnconfirmedRecipes } from '@/lib/hospitality/recipe-service'

export const runtime = 'nodejs'

export async function GET() {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 })

  const r = await listUnconfirmedRecipes(client as any, organizationId)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ recipes: r.data }, { headers: { 'Cache-Control': 'no-store' } })
}
