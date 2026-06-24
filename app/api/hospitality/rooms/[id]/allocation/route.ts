/**
 * Room-night energy/water allocation.
 *
 * GET /api/hospitality/rooms/[id]/allocation  — current allocation + computed CO2e.
 * PUT /api/hospitality/rooms/[id]/allocation  — upsert occupancy + electricity/gas/water/country.
 *
 * The computed allocated CO2e is display-only (already in the venue's facility
 * Scope 1/2), so it is never added to the company total.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import { computeAllocatedImpact, DEFAULT_ROOM_ALLOCATION } from '@/lib/hospitality/room-allocation'

export const runtime = 'nodejs'

async function ctx(productId: string) {
  const { client, user, error } = await getSupabaseAPIClient()
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) return { error: NextResponse.json({ error: 'No organisation' }, { status: 403 }) }
  const db = client as any
  const { data: product } = await db
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .eq('product_kind', 'hospitality_room_night')
    .maybeSingle()
  if (!product) return { error: NextResponse.json({ error: 'Room not found' }, { status: 404 }) }
  return { db, organizationId, productId: Number(productId), userId: user.id }
}

function withImpact(row: { occupancy: number; electricity_kwh: number; gas_kwh: number; water_litres: number; country: string }) {
  return { allocation: row, impact: computeAllocatedImpact(row) }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const c = await ctx(params.id)
  if ('error' in c) return c.error
  const { data } = await c.db
    .from('hospitality_room_allocation')
    .select('occupancy, electricity_kwh, gas_kwh, water_litres, country')
    .eq('product_id', c.productId)
    .maybeSingle()
  const row = data
    ? {
        occupancy: Number(data.occupancy),
        electricity_kwh: Number(data.electricity_kwh),
        gas_kwh: Number(data.gas_kwh),
        water_litres: Number(data.water_litres),
        country: data.country,
      }
    : { ...DEFAULT_ROOM_ALLOCATION }
  return NextResponse.json(withImpact(row), { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const c = await ctx(params.id)
  if ('error' in c) return c.error
  const denied = await denyReadOnlyAdvisor(c.db, { id: c.userId }, c.organizationId)
  if (denied) return denied

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const occupancy = Math.trunc(Number(body?.occupancy))
  if (!Number.isFinite(occupancy) || occupancy <= 0) {
    return NextResponse.json({ error: 'occupancy must be greater than 0' }, { status: 400 })
  }
  const nums: Record<string, number> = {}
  for (const f of ['electricity_kwh', 'gas_kwh', 'water_litres']) {
    const v = Number(body?.[f] ?? 0)
    if (!Number.isFinite(v) || v < 0) return NextResponse.json({ error: `${f} must be 0 or more` }, { status: 400 })
    nums[f] = v
  }
  const country = String(body?.country || 'GB').toUpperCase().slice(0, 3)

  const row = {
    occupancy,
    electricity_kwh: nums.electricity_kwh,
    gas_kwh: nums.gas_kwh,
    water_litres: nums.water_litres,
    country,
  }

  const { error } = await c.db
    .from('hospitality_room_allocation')
    .upsert(
      { organization_id: c.organizationId, product_id: c.productId, ...row },
      { onConflict: 'product_id' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(withImpact(row))
}
