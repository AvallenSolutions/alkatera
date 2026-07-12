/**
 * Bulk-set a recipe's ingredient quantities from the bulk quantity grid.
 * PUT /api/hospitality/recipes/[id]/quantities
 *   body: { ingredients: [{ id?, material_name, quantity, unit }], status?: 'confirmed' | 'estimated' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import { setRecipeQuantities } from '@/lib/hospitality/recipe-service'

export const runtime = 'nodejs'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  const denied = await denyReadOnlyAdvisor(client as any, user, organizationId)
  if (denied) return denied

  const productId = Number(params.id)
  if (!Number.isFinite(productId)) return NextResponse.json({ error: 'Invalid recipe id' }, { status: 400 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const ingredients = Array.isArray(body?.ingredients) ? body.ingredients : []
  const status = body?.status === 'estimated' ? 'estimated' : 'confirmed'

  const r = await setRecipeQuantities(client as any, organizationId, productId, ingredients, status)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json(r.data)
}
