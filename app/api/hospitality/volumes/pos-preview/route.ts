/**
 * Preview a POS item-sales export (Square / Toast / Lightspeed, etc.) before
 * creating volume rows. Aggregates units per item and matches item names to
 * hospitality products. Writes nothing — the client confirms, then posts the
 * confirmed rows to /api/hospitality/volumes with one chosen period.
 *
 * POST /api/hospitality/volumes/pos-preview   body: { csv: string }
 *   → { rows_parsed, skipped_no_quantity, matched[], unmatched[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { previewPosSales } from '@/lib/hospitality/volume-service'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const csv = String(body?.csv ?? '')
  if (!csv.trim()) return NextResponse.json({ error: 'csv is empty' }, { status: 400 })

  const r = await previewPosSales(client as any, organizationId, csv)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json(r.data, { headers: { 'Cache-Control': 'no-store' } })
}
