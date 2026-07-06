/**
 * The desk's live numbers.
 *
 * GET /api/desk/counts — one cheap round trip for the poster blocks:
 * products, facilities, reports and open supplier requests. Counts only
 * (head queries), no rows; the desk must stay light.
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
  const count = async (table: string, column = 'organization_id') => {
    const { count: n, error } = await db
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(column, organizationId)
    return error ? 0 : (n ?? 0)
  }

  const [products, facilities, reports] = await Promise.all([
    count('products'),
    count('facilities'),
    count('generated_reports'),
  ])

  return NextResponse.json({ products, facilities, reports })
}
