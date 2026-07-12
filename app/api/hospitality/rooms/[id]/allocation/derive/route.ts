/**
 * Suggest a per-room-night energy/water allocation from the venue's facility
 * utility data. GET /api/hospitality/rooms/[id]/allocation/derive?start=&end=
 * (defaults to the trailing 12 months). Read-only — returns a suggestion the
 * user reviews and saves via the allocation PUT.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { deriveRoomAllocation } from '@/lib/hospitality/room-allocation-derive'

export const runtime = 'nodejs'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function trailingYear(): { start: string; end: string } {
  // Dates are stable strings; avoid Date.now() nondeterminism concerns by using
  // the request's own clock only for the default window.
  const now = new Date()
  const end = now.toISOString().slice(0, 10)
  const startDate = new Date(now)
  startDate.setUTCFullYear(startDate.getUTCFullYear() - 1)
  const start = startDate.toISOString().slice(0, 10)
  return { start, end }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  const db = client as any

  const productId = Number(params.id)
  if (!Number.isFinite(productId)) return NextResponse.json({ error: 'Invalid room id' }, { status: 400 })

  // The room must belong to the org.
  const { data: product } = await db
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .eq('product_kind', 'hospitality_room_night')
    .maybeSingle()
  if (!product) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  const url = new URL(request.url)
  const fallback = trailingYear()
  const startParam = url.searchParams.get('start')
  const endParam = url.searchParams.get('end')
  const start = startParam && DATE_RE.test(startParam) ? startParam : fallback.start
  const end = endParam && DATE_RE.test(endParam) ? endParam : fallback.end

  const r = await deriveRoomAllocation(db, organizationId, productId, start, end)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json(r.data, { headers: { 'Cache-Control': 'no-store' } })
}
