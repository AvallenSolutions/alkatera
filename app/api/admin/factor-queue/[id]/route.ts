import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PATCH /api/admin/factor-queue/[id]
 *
 * `[id]` is the `product_materials.id` (not the exception id — the material
 * row is the thing actually being fixed, and it's the one identifier
 * guaranteed to exist; see the GET route's doc comment for why the exception
 * row is a lazily-created workflow wrapper around it, not the source of
 * truth).
 *
 * Two actions:
 *   - `apply`: attaches a real factor from `staging_emission_factors`
 *     (the same library `/admin/factors` browses) to the material, clears
 *     the proxy markers, and marks the matching agent_exceptions row (if any)
 *     approved.
 *   - `dismiss`: the row isn't actually a gap (e.g. a proxy that's already
 *     good enough) — marks the exception rejected without touching the
 *     material, so it won't be re-added on the next GET... actually it WILL
 *     be re-added, since the material still reads ef_source_type='proxy'.
 *     Dismiss is for exception bookkeeping only; to stop a row reappearing,
 *     apply a real factor.
 *
 * Recalculating the product's LCA after applying a factor is a manual next
 * step, not done here: the calculator is client-side only
 * (`lib/utils/recalculate-product-lca.ts`) and organisation-scoped RLS means
 * only a session actively switched into that organisation can write its
 * `product_carbon_footprints` — exactly the constraint the existing
 * `/admin-tools/recalculate-lca` tool already works within. The factor-queue
 * page surfaces a matching "switch into {org} and recalculate" prompt.
 */

// See the GET route's doc comment: without this, Next.js's fetch patching
// can cache these outbound Supabase requests across invocations.
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

interface ApplyBody {
  action: 'apply'
  factorId: string
}
interface DismissBody {
  action: 'dismiss'
  reason?: string
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as ApplyBody | DismissBody
  const db = serviceClient()
  const materialId = params.id

  const { data: material, error: matErr } = await db
    .from('product_materials')
    .select('id, product_id, material_name')
    .eq('id', materialId)
    .maybeSingle()
  if (matErr) return NextResponse.json({ error: matErr.message }, { status: 500 })
  if (!material) return NextResponse.json({ error: 'Material not found — it may already have been resolved or removed.' }, { status: 404 })

  const { data: exception } = await db
    .from('agent_exceptions')
    .select('id')
    .eq('kind', 'factor_gap')
    .eq('status', 'open')
    .contains('source_ref', { product_material_id: materialId })
    .maybeSingle()

  if (body.action === 'dismiss') {
    if (exception?.id) {
      await db
        .from('agent_exceptions')
        .update({ status: 'rejected', reviewed_by: auth.userId, reviewed_at: new Date().toISOString(), review_notes: (body as DismissBody).reason || null })
        .eq('id', exception.id)
    }
    return NextResponse.json({ ok: true })
  }

  if (body.action !== 'apply' || !(body as ApplyBody).factorId) {
    return NextResponse.json({ error: 'factorId is required to apply a factor.' }, { status: 400 })
  }

  const { data: factor, error: factorErr } = await db
    .from('staging_emission_factors')
    .select('id, name, category, co2_factor, source, organization_id, metadata, uncertainty_percent')
    .eq('id', (body as ApplyBody).factorId)
    .maybeSingle()
  if (factorErr) return NextResponse.json({ error: factorErr.message }, { status: 500 })
  if (!factor) return NextResponse.json({ error: 'Chosen factor not found.' }, { status: 404 })

  const isGlobalLibrary = !factor.organization_id && (factor as any).metadata?.data_quality_grade
  const qualityGrade = (factor as any).metadata?.data_quality_grade ?? null

  const { error: updErr } = await db
    .from('product_materials')
    .update({
      matched_source_name: factor.name,
      ef_source: factor.source,
      ef_source_type: isGlobalLibrary ? 'global_library' : 'staging',
      ef_data_quality_grade: qualityGrade,
      ef_uncertainty_percent: factor.uncertainty_percent ?? null,
      cached_co2_factor: factor.co2_factor,
      data_source: null,
      data_source_id: null,
      match_status: 'verified',
      updated_at: new Date().toISOString(),
    })
    .eq('id', materialId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  if (exception?.id) {
    await db
      .from('agent_exceptions')
      .update({
        status: 'approved',
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
        applied_to: { table: 'product_materials', id: materialId, factor_id: factor.id, factor_name: factor.name },
      })
      .eq('id', exception.id)
  }

  const { data: product } = await db.from('products').select('id, organization_id').eq('id', material.product_id).maybeSingle()

  return NextResponse.json({
    ok: true,
    productId: material.product_id,
    organizationId: (product as any)?.organization_id ?? null,
  })
}
