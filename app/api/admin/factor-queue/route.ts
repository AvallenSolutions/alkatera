import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/factor-queue
 *
 * The alkatera-side half of "factor selection abolished as a user task"
 * (tasks/data-revolution-plan.md, Pillar 2): every ingredient/packaging row
 * that computed with a conservative proxy or never matched at all — the
 * user already has a working number via `lib/factors/auto-proxy.ts`, this
 * is where alkatera finds the real factor for it.
 *
 * The candidate list is read LIVE from `product_materials` (the source of
 * truth: `ef_source_type = 'proxy'` or `match_status = 'needs_review'`)
 * rather than trusted to a write-time event log, because nothing reliably
 * knows a material's real row id at the moment a proxy is applied in the
 * browser (new products are edited under a client-only tempId until save).
 * Reading live is also self-healing: the moment an admin (or the user)
 * attaches a real factor, the row simply stops matching and drops off the
 * list on the next load — no separate status to keep in sync.
 *
 * An `agent_exceptions` row (kind='factor_gap') is still kept per gap, as
 * asked for, so the queue has the same open/approved/rejected workflow
 * state every other exception kind has and a record of who resolved what.
 * Rows are upserted lazily here (idempotent on `source_ref->>'product_material_id'`)
 * rather than at proxy-apply time, for the same row-id reason above.
 * `agent_exceptions` never gets a factor_gap row via the normal ingest
 * flow — this route is the only writer of this kind — and other org-facing
 * surfaces exclude it explicitly (see `app/api/agents/exceptions/route.ts`),
 * since the plan is explicit that the user never sees a factor picker.
 */

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' })

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
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStoreFetch },
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
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: noStoreFetch } })
}

export async function GET(request: NextRequest) {
  const auth = await assertAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const db = serviceClient()

  const { data: materials, error: matErr } = await db
    .from('product_materials')
    .select(
      'id, product_id, material_name, material_type, packaging_category, matched_source_name, ef_source, ef_source_type, ef_data_quality_grade, ef_uncertainty_percent, cached_co2_factor, match_status, unit, quantity, updated_at',
    )
    .eq('is_self_grown', false)
    .or('ef_source_type.eq.proxy,match_status.eq.needs_review')
    .order('updated_at', { ascending: false })
    .limit(300)

  if (matErr) return NextResponse.json({ error: matErr.message }, { status: 500 })

  const rows = materials ?? []
  if (rows.length === 0) return NextResponse.json({ items: [] })

  const productIds = Array.from(new Set(rows.map((r: any) => r.product_id)))
  const { data: products } = await db
    .from('products')
    .select('id, name, organization_id')
    .in('id', productIds)
  const productById = new Map((products ?? []).map((p: any) => [p.id, p]))

  const orgIds = Array.from(new Set((products ?? []).map((p: any) => p.organization_id).filter(Boolean)))
  const { data: orgs } = orgIds.length > 0
    ? await db.from('organizations').select('id, name').in('id', orgIds)
    : { data: [] as any[] }
  const orgById = new Map((orgs ?? []).map((o: any) => [o.id, o]))

  // Ensure every current gap has an open agent_exceptions row (idempotent,
  // keyed by product_material_id in source_ref). Existing check first so a
  // repeat GET never duplicates.
  const { data: openExceptions } = await db
    .from('agent_exceptions')
    .select('id, organization_id, source_ref, status, created_at, review_notes')
    .eq('kind', 'factor_gap')
    .eq('status', 'open')
  const exceptionByMaterialId = new Map(
    (openExceptions ?? [])
      .filter((e: any) => e?.source_ref?.product_material_id)
      .map((e: any) => [String(e.source_ref.product_material_id), e]),
  )

  const toInsert: Record<string, unknown>[] = []
  for (const row of rows as any[]) {
    if (exceptionByMaterialId.has(String(row.id))) continue
    const product = productById.get(row.product_id)
    if (!product?.organization_id) continue
    toInsert.push({
      organization_id: product.organization_id,
      kind: 'factor_gap',
      source: 'agent_run',
      source_ref: { product_material_id: row.id },
      payload: {
        material_name: row.material_name,
        material_type: row.material_type,
        packaging_category: row.packaging_category,
        proxy_factor_name: row.matched_source_name,
        confidence_pct: row.ef_uncertainty_percent != null ? 100 - Number(row.ef_uncertainty_percent) : null,
      },
      confidence: row.ef_uncertainty_percent != null ? Math.max(0, (100 - Number(row.ef_uncertainty_percent)) / 100) : null,
      title: `Factor gap: ${row.material_name}`,
      summary: row.matched_source_name
        ? `Computing with a conservative stand-in ("${row.matched_source_name}") — needs a real factor.`
        : 'No emission factor at all — the material is not computing.',
      status: 'open',
    })
  }
  if (toInsert.length > 0) {
    const { data: inserted } = await db.from('agent_exceptions').insert(toInsert).select('id, source_ref')
    for (const e of inserted ?? []) {
      exceptionByMaterialId.set(String((e as any).source_ref.product_material_id), e)
    }
  }

  const items = (rows as any[]).map((row) => {
    const product = productById.get(row.product_id)
    const org = product ? orgById.get(product.organization_id) : null
    const exception = exceptionByMaterialId.get(String(row.id))
    return {
      productMaterialId: row.id,
      exceptionId: exception?.id ?? null,
      materialName: row.material_name,
      materialType: row.material_type,
      packagingCategory: row.packaging_category,
      matchedSourceName: row.matched_source_name,
      efSource: row.ef_source,
      efSourceType: row.ef_source_type,
      efUncertaintyPercent: row.ef_uncertainty_percent,
      carbonIntensity: row.cached_co2_factor,
      matchStatus: row.match_status,
      unit: row.unit,
      quantity: row.quantity,
      productId: row.product_id,
      productName: product?.name ?? null,
      organizationId: product?.organization_id ?? null,
      organizationName: org?.name ?? null,
      updatedAt: row.updated_at,
    }
  })

  return NextResponse.json({ items })
}
