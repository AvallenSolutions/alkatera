/**
 * Import service volumes from a CSV.
 * POST /api/hospitality/volumes/import   body: { csv: string }
 * Columns (case-insensitive): product, units (or units_sold), period_start, period_end.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import { importVolumesCsv } from '@/lib/hospitality/volume-service'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  const denied = await denyReadOnlyAdvisor(client as any, user, organizationId)
  if (denied) return denied

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const csv = String(body?.csv ?? '')
  if (!csv.trim()) return NextResponse.json({ error: 'csv is empty' }, { status: 400 })

  const r = await importVolumesCsv(client as any, organizationId, csv)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json(r.data)
}
