/**
 * Distinct ingredient names already used across this org's hospitality recipes.
 * Powers the autocomplete in the recipe editor so the same ingredient ("Olive
 * oil", "Beef mince") isn't retyped from scratch on every dish.
 *
 * GET /api/hospitality/ingredients → { ingredients: string[] }
 */

import { NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { HOSPITALITY_KINDS } from '@/lib/hospitality/constants'

export const runtime = 'nodejs'

const MAX_NAMES = 500

export async function GET() {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  const db = client as any

  const { data: products } = await db
    .from('products')
    .select('id')
    .eq('organization_id', organizationId)
    .in('product_kind', HOSPITALITY_KINDS)
  const ids = (products ?? []).map((p: any) => p.id)
  if (ids.length === 0) return NextResponse.json({ ingredients: [] }, { headers: { 'Cache-Control': 'no-store' } })

  const { data: materials } = await db
    .from('product_materials')
    .select('material_name')
    .in('product_id', ids)
    .eq('material_type', 'ingredient')

  // Distinct, case-insensitive, keeping the first-seen casing; alphabetical.
  const seen = new Map<string, string>()
  for (const m of materials ?? []) {
    const name = String(m?.material_name ?? '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (!seen.has(key)) seen.set(key, name)
  }
  const ingredients = Array.from(seen.values())
    .sort((a, b) => a.localeCompare(b))
    .slice(0, MAX_NAMES)

  return NextResponse.json({ ingredients }, { headers: { 'Cache-Control': 'no-store' } })
}
