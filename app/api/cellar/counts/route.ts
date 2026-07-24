/**
 * The cellar landing's live numbers.
 *
 * GET /api/cellar/counts — one cheap round trip for the landing's fact rows:
 * products, LCAs (completed and in-flight), and this year's nature-assessment
 * status. Counts only (head queries), no rows; the landing stays light.
 * Sibling of /api/workbench/counts, same shape and auth. The vitality score
 * for the poster comes separately from /api/vitality/composite (shared,
 * HTTP-cached with the desk and Rosa).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const organizationId = await resolveAccessibleOrg(
    client as any,
    user,
    url.searchParams.get('organization_id'),
  )
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }

  const db = client as any
  const count = async (
    table: string,
    apply?: (q: any) => any,
    column = 'organization_id',
  ) => {
    let q = db.from(table).select('id', { count: 'exact', head: true }).eq(column, organizationId)
    if (apply) q = apply(q)
    const { count: n, error } = await q
    return error ? 0 : (n ?? 0)
  }

  const year = new Date().getFullYear()

  const [products, liquids, packs, ingredients, lcasCompleted, lcasDraft] = await Promise.all([
    count('products'),
    count('liquids'),
    count('pack_formats'),
    count('ingredients'),
    count('product_carbon_footprints', (q) => q.eq('status', 'completed')),
    count('product_carbon_footprints', (q) => q.in('status', ['draft', 'in_progress'])),
  ])

  return NextResponse.json({
    products,
    liquids,
    packs,
    ingredients,
    lcasCompleted,
    lcasDraft,
    year,
  })
}
