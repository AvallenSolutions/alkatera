import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { calculateCorporateEmissions } from '@/lib/calculations/corporate-emissions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SnapshotBodySchema = z.object({
  organizationId: z.string().min(1),
  year: z.number(),
  reason: z.string().optional().nullable(),
})

/**
 * Reconciliation snapshot API.
 *
 * - GET: list recent snapshots (admin UI).
 * - POST: compute the current corporate footprint for (organizationId, year),
 *   compare against the most recent prior snapshot, and persist a new row.
 *   Returns the row so the admin page can show delta + notify eligibility.
 */

async function assertAdmin(
  request: Request,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string }
> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { ok: false, status: 401, error: 'Unauthorised' }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userData } = await userClient.auth.getUser()
  if (!userData?.user) return { ok: false, status: 401, error: 'Unauthorised' }
  const { data: isAdmin } = await userClient.rpc('is_alkatera_admin')
  if (isAdmin !== true) return { ok: false, status: 403, error: 'Admin only' }
  return { ok: true, userId: userData.user.id }
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function GET(request: NextRequest) {
  const auth = await assertAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const svc = serviceClient()
  const { data } = await svc
    .from('emission_reconciliation_snapshots')
    .select('id, organization_id, year, previous_total_kg, new_total_kg, delta_kg, delta_pct, reason, captured_at, notified_at, notified_to')
    .order('captured_at', { ascending: false })
    .limit(200)

  const orgIds = Array.from(new Set((data || []).map((r: { organization_id: string }) => r.organization_id)))
  const { data: orgs } = orgIds.length
    ? await svc.from('organizations').select('id, name').in('id', orgIds)
    : { data: [] as Array<{ id: string; name: string }> }

  const orgNameById = new Map((orgs || []).map((o: { id: string; name: string }) => [o.id, o.name]))

  const rows = (data || []).map((r) => ({
    ...(r as Record<string, unknown>),
    organization_name: orgNameById.get((r as { organization_id: string }).organization_id) ?? null,
  }))

  return NextResponse.json({ snapshots: rows })
}

export async function POST(request: NextRequest) {
  const auth = await assertAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const raw = await request.json().catch(() => null)
  const parsed = SnapshotBodySchema.safeParse(raw)
  if (!parsed.success || !parsed.data.year) {
    return NextResponse.json({ error: 'Missing organizationId or year' }, { status: 400 })
  }
  const body = parsed.data

  const svc = serviceClient()

  const { data: prior } = await svc
    .from('emission_reconciliation_snapshots')
    .select('new_total_kg, new_breakdown')
    .eq('organization_id', body.organizationId)
    .eq('year', body.year)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const current = await calculateCorporateEmissions(svc, body.organizationId, body.year)

  const previousTotal = prior ? Number((prior as { new_total_kg: number }).new_total_kg) : null
  const newTotal = current.breakdown.total
  const deltaKg = previousTotal === null ? null : newTotal - previousTotal
  const deltaPct =
    previousTotal === null || previousTotal === 0
      ? null
      : ((newTotal - previousTotal) / previousTotal) * 100

  const { data: inserted, error: insertErr } = await svc
    .from('emission_reconciliation_snapshots')
    .insert({
      organization_id: body.organizationId,
      year: body.year,
      previous_total_kg: previousTotal,
      new_total_kg: newTotal,
      delta_kg: deltaKg,
      delta_pct: deltaPct,
      previous_breakdown: prior ? (prior as { new_breakdown: unknown }).new_breakdown : null,
      new_breakdown: current.breakdown,
      reason: body.reason ?? null,
      created_by: auth.userId,
    })
    .select()
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ snapshot: inserted })
}
