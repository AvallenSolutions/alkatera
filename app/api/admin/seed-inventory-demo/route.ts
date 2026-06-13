import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SeedBodySchema = z.object({
  organizationId: z.string().min(1),
})

/**
 * Seeds a realistic inventory/Xero scenario into the target org so the
 * end-to-end double-counting fix can be demoed:
 *
 *   - 1 facility (if missing)
 *   - 3 ingredients: bottle, cork, label
 *   - 2 products: one with a completed LCA, one without
 *   - product_materials (BOM) linking ingredients to both products
 *   - 5 unlinked Xero raw_materials transactions spread across recent months,
 *     ready to be linked via the XeroInventoryLinker
 *
 * Idempotent — re-running it only inserts missing rows.
 */

async function assertAdmin(
  request: NextRequest,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
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
  return { ok: true }
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function ensureXeroConnection(svc: SupabaseClient, orgId: string) {
  const { data: existing } = await svc
    .from('xero_connections')
    .select('id')
    .eq('organization_id', orgId)
    .maybeSingle()
  if (existing) return
  await svc.from('xero_connections').insert({
    organization_id: orgId,
    xero_tenant_id: 'demo-seed-tenant',
    xero_tenant_name: 'Demo Seed Xero (fake)',
    access_token_encrypted: 'demo:demo:demo',
    refresh_token_encrypted: 'demo:demo:demo',
    token_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    scopes: ['offline_access', 'accounting.transactions.read'],
    sync_status: 'idle',
    last_sync_at: new Date().toISOString(),
  })
}

async function ensureFacility(svc: SupabaseClient, orgId: string): Promise<string> {
  const { data: existing } = await svc
    .from('facilities')
    .select('id')
    .eq('organization_id', orgId)
    .limit(1)
    .maybeSingle()
  if (existing) return (existing as { id: string }).id

  const { data: inserted, error } = await svc
    .from('facilities')
    .insert({
      organization_id: orgId,
      name: 'Demo Distillery',
      location: 'Bristol, UK',
      address_country: 'GB',
      location_country_code: 'GB',
      location_city: 'Bristol',
    })
    .select('id')
    .single()
  if (error) throw new Error(`facility: ${error.message}`)
  return (inserted as { id: string }).id
}

async function ensureIngredient(
  svc: SupabaseClient,
  orgId: string,
  name: string,
): Promise<string> {
  const { data: existing } = await svc
    .from('ingredients')
    .select('id')
    .eq('organization_id', orgId)
    .eq('name', name)
    .maybeSingle()
  if (existing) return (existing as { id: string }).id
  const { data: inserted, error } = await svc
    .from('ingredients')
    .insert({ organization_id: orgId, name })
    .select('id')
    .single()
  if (error) throw new Error(`ingredient ${name}: ${error.message}`)
  return (inserted as { id: string }).id
}

async function ensureProduct(
  svc: SupabaseClient,
  orgId: string,
  name: string,
  sku: string,
): Promise<number> {
  const { data: existing } = await svc
    .from('products')
    .select('id')
    .eq('organization_id', orgId)
    .eq('sku', sku)
    .maybeSingle()
  if (existing) return (existing as { id: number }).id
  const { data: inserted, error } = await svc
    .from('products')
    .insert({
      organization_id: orgId,
      name,
      sku,
      unit_size_value: 750,
      unit_size_unit: 'ml',
      product_category: 'spirits',
    })
    .select('id')
    .single()
  if (error) throw new Error(`product ${sku}: ${error.message}`)
  return (inserted as { id: number }).id
}

async function ensureBOM(
  svc: SupabaseClient,
  productId: number,
  ingredientId: string,
  materialName: string,
  quantity: number,
  unit: string,
) {
  const { data: existing } = await svc
    .from('product_materials')
    .select('id')
    .eq('product_id', productId)
    .eq('material_id', ingredientId)
    .maybeSingle()
  if (existing) return
  const { error } = await svc.from('product_materials').insert({
    product_id: productId,
    material_id: ingredientId,
    material_name: materialName,
    material_type: 'ingredient',
    quantity,
    unit,
  })
  if (error) throw new Error(`BOM ${materialName}: ${error.message}`)
}

async function ensureCompletedLCA(
  svc: SupabaseClient,
  orgId: string,
  productId: number,
  productName: string,
) {
  const { data: existing } = await svc
    .from('product_carbon_footprints')
    .select('id')
    .eq('organization_id', orgId)
    .eq('product_id', productId)
    .eq('status', 'completed')
    .maybeSingle()
  if (existing) return
  const { error } = await svc.from('product_carbon_footprints').insert({
    organization_id: orgId,
    product_id: productId,
    product_name: productName,
    status: 'completed',
    is_draft: false,
    functional_unit: '1 × 750ml bottle',
    system_boundary: 'cradle-to-gate',
    reference_year: new Date().getFullYear(),
    total_ghg_emissions: 1.25,
    total_ghg_raw_materials: 0.45,
    total_ghg_packaging: 0.55,
    total_ghg_processing: 0.25,
    ingredients_complete: true,
    packaging_complete: true,
    production_complete: true,
  })
  if (error) throw new Error(`LCA ${productName}: ${error.message}`)
}

interface XeroSeedRow {
  key: string
  date: string
  description: string
  supplier: string
  amount: number
  emissionsKg: number
}

async function ensureXeroTransactions(
  svc: SupabaseClient,
  orgId: string,
): Promise<number> {
  const today = new Date()
  const monthsAgo = (n: number) => {
    const d = new Date(today)
    d.setMonth(d.getMonth() - n)
    return d.toISOString().slice(0, 10)
  }
  const rows: XeroSeedRow[] = [
    { key: 'demo-seed-bottles-001', date: monthsAgo(6), description: 'Glass bottles 750ml x 5000', supplier: 'Verallia UK', amount: 7500, emissionsKg: 2250 },
    { key: 'demo-seed-corks-001',   date: monthsAgo(5), description: 'Natural cork stoppers x 5000', supplier: 'Amorim Cork', amount: 1800, emissionsKg: 180 },
    { key: 'demo-seed-labels-001',  date: monthsAgo(5), description: 'Printed paper labels x 5000', supplier: 'Skanem Labels', amount: 950, emissionsKg: 95 },
    { key: 'demo-seed-bottles-002', date: monthsAgo(2), description: 'Glass bottles 750ml x 3000', supplier: 'Verallia UK', amount: 4500, emissionsKg: 1350 },
    { key: 'demo-seed-corks-002',   date: monthsAgo(1), description: 'Natural cork stoppers x 3000', supplier: 'Amorim Cork', amount: 1100, emissionsKg: 110 },
  ]
  let inserted = 0
  for (const r of rows) {
    const { data: existing } = await svc
      .from('xero_transactions')
      .select('id')
      .eq('organization_id', orgId)
      .eq('xero_transaction_id', r.key)
      .maybeSingle()
    if (existing) continue
    const { error } = await svc.from('xero_transactions').insert({
      organization_id: orgId,
      xero_transaction_id: r.key,
      xero_transaction_type: 'invoice',
      xero_contact_name: r.supplier,
      description: r.description,
      amount: r.amount,
      currency: 'GBP',
      transaction_date: r.date,
      emission_category: 'raw_materials',
      classification_source: 'manual',
      classification_confidence: 1,
      spend_based_emissions_kg: r.emissionsKg,
      data_quality_tier: 4,
      upgrade_status: 'pending',
      reporting_year: Number(r.date.slice(0, 4)),
    })
    if (error) throw new Error(`xero ${r.key}: ${error.message}`)
    inserted += 1
  }
  return inserted
}

export async function POST(request: NextRequest) {
  const auth = await assertAdmin(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const raw = await request.json().catch(() => null)
  const parsed = SeedBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 })
  }
  const orgId = parsed.data.organizationId
  const svc = serviceClient()

  try {
    await ensureXeroConnection(svc, orgId)
    const facilityId = await ensureFacility(svc, orgId)

    const bottleId = await ensureIngredient(svc, orgId, 'Glass bottle 750ml')
    const corkId = await ensureIngredient(svc, orgId, 'Natural cork stopper')
    const labelId = await ensureIngredient(svc, orgId, 'Printed paper label')

    const ginId = await ensureProduct(svc, orgId, 'Demo Gin (LCA complete)', 'DEMO-GIN-001')
    const vodkaId = await ensureProduct(svc, orgId, 'Demo Vodka (no LCA yet)', 'DEMO-VODKA-001')

    await ensureBOM(svc, ginId, bottleId, 'Glass bottle 750ml', 1, 'unit')
    await ensureBOM(svc, ginId, corkId, 'Natural cork stopper', 1, 'unit')
    await ensureBOM(svc, ginId, labelId, 'Printed paper label', 1, 'unit')
    await ensureBOM(svc, vodkaId, bottleId, 'Glass bottle 750ml', 1, 'unit')
    await ensureBOM(svc, vodkaId, corkId, 'Natural cork stopper', 1, 'unit')

    await ensureCompletedLCA(svc, orgId, ginId, 'Demo Gin (LCA complete)')

    const xeroInserted = await ensureXeroTransactions(svc, orgId)

    return NextResponse.json({
      ok: true,
      facilityId,
      ingredients: { bottle: bottleId, cork: corkId, label: labelId },
      products: { gin: ginId, vodka: vodkaId },
      xeroTransactionsInserted: xeroInserted,
      nextSteps: [
        'Open Data → Xero to link the seeded invoices to ingredients',
        'Log production against Demo Gin to see FIFO draw + Option 3 (product_lca) suppression',
        'Log production against Demo Vodka to see inventory_ledger booking',
        'Check the Scope 1 & 2 page banner for the split attribution',
      ],
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Seed failed' },
      { status: 500 },
    )
  }
}
