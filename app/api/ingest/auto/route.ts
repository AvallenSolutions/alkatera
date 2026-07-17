import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import { enqueueIngestJob } from '@/lib/ingest/enqueue'
import { userHasOrgAccess } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import type { ExtractedBillData } from '@/app/api/utilities/import-from-pdf/route'
import type {
  ExtractedFacilityBillData,
  ExtractedWaterEntry,
  ExtractedWasteEntry,
} from '@/app/api/facilities/import-bill/route'

// On Netlify the lambda freezes the moment the HTTP response is sent, so the
// inline fallback below MUST be awaited. Bumping maxDuration gives us
// headroom for Claude to finish on a small bill before the platform kills
// the request.
export const maxDuration = 26

// ───────────────────────────────────────────────────────────────────────────────
// Smart Upload enqueue endpoint.
//
// Everything about stashing the file, creating its ingest_jobs row and
// deciding inline-vs-background classification lives in
// lib/ingest/enqueue.ts (shared with the Rosa drawer, supplier smart-import
// and email-in channels — data-revolution-plan.md Pillar 1). This route is
// left with the HTTP-specific concerns: auth, per-org rate limiting, access
// checks and multipart parsing.
//
// Moving extraction off the synchronous code path is what fixes the
// "completely failed" historical-report uploads — those were dying at
// Netlify's 26s sync ceiling, not a bug in the classifier itself.
// ───────────────────────────────────────────────────────────────────────────────

const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const rateLimits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(orgId: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimits.get(orgId)
  if (!entry || entry.resetAt < now) {
    rateLimits.set(orgId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 }
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 }
  }
  entry.count += 1
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count }
}

export type IngestResultType =
  | 'utility_bill'
  | 'water_bill'
  | 'waste_bill'
  | 'bulk_xlsx'
  | 'spray_diary'
  | 'bom'
  | 'supplier_invoice'
  | 'freight_invoice'
  | 'refrigerant_service'
  | 'packaging_spec'
  | 'supplier_coa'
  | 'certification'
  | 'soil_carbon_lab'
  | 'soil_carbon_evidence'
  | 'accounts_csv'
  | 'smart_meter_csv'
  | 'historical_sustainability_report'
  | 'historical_lca_report'
  | 'hospitality_menu'
  | 'pos_sales_export'
  | 'unsupported'

export interface IngestResponse {
  type: IngestResultType
  /** Classifier's self-reported confidence; captured for the learning loop. */
  classifierMeta?: { confidence?: 'high' | 'medium' | 'low'; alternate?: string }
  utilityBill?: ExtractedBillData
  smartMeter?: {
    format: 'long' | 'wide'
    readings: number
    totalKwh: number
    firstDate: string | null
    lastDate: string | null
    months: number
    stashId?: string
  }
  waterBill?: ExtractedFacilityBillData<ExtractedWaterEntry>
  wasteBill?: ExtractedFacilityBillData<ExtractedWasteEntry>
  xlsx?: {
    summary: { products: number; ingredients: number; packaging: number; errors: number }
    errors: string[]
  }
  sprayDiary?: { sheetNames: string[]; note?: string; stashId?: string }
  bom?: {
    note?: string
    stashId?: string
    product_name?: string
    product_sku?: string
    product_category?: 'Spirits' | 'Beer & Cider' | 'Wine' | 'Ready-to-Drink & Cocktails' | 'Non-Alcoholic'
    supplier_name?: string
    product_description?: string
    unit_size_value?: number
    unit_size_unit?: string
    line_items?: Array<{
      name?: string
      quantity?: number
      unit?: string
      quantity_basis?: 'per_litre' | 'per_hectolitre' | 'per_unit'
      type?: 'ingredient' | 'packaging'
    }>
  }
  supplierInvoice?: {
    supplier_name?: string
    invoice_date?: string
    currency?: 'GBP' | 'USD' | 'EUR'
    suggested_category?: string
    line_items?: Array<{ description?: string; amount?: number; quantity?: number; unit?: string }>
    invoice_total?: number
    stashId?: string
  }
  freightInvoice?: {
    carrier_name?: string
    shipment_date?: string
    transport_mode?: 'truck' | 'train' | 'ship' | 'air'
    weight_kg?: number
    distance_km?: number
    origin?: string
    destination?: string
    amount?: number
    currency?: 'GBP' | 'USD' | 'EUR'
    stashId?: string
  }
  refrigerantService?: {
    service_date?: string
    refrigerant_type?: string
    quantity_kg?: number
    equipment?: string
    engineer?: string
    stashId?: string
  }
  packagingSpec?: {
    product_hint?: string
    components?: Array<{
      component_name?: string
      material?: string
      role?: 'container' | 'label' | 'closure' | 'secondary' | 'shipment' | 'tertiary'
      weight_g?: number
      recycled_content_pct?: number
      recyclability_pct?: number
    }>
    stashId?: string
  }
  supplierCoa?: {
    supplier_name?: string
    product_name?: string
    document_type?: 'specification_sheet' | 'test_report' | 'carbon_certificate'
    document_date?: string
    expiry_date?: string
    reference_number?: string
    covers_climate?: boolean
    covers_water?: boolean
    covers_waste?: boolean
    stashId?: string
  }
  certification?: {
    framework_hint?: string
    certificate_name?: string
    issuer?: string
    certificate_number?: string
    issue_date?: string
    expiry_date?: string
    stashId?: string
  }
  soilCarbonLab?: {
    lab_name?: string
    methodology?: string
    default_sample_date?: string
    samples?: Array<{
      location_label?: string
      sample_date?: string
      depth_cm?: number
      soc_input_method?: 'stock' | 'concentration'
      soc_stock_tc_ha?: number
      soc_concentration_pct?: number
      bulk_density_g_cm3?: number
      sampling_points?: number
    }>
    stashId?: string
  }
  soilCarbonEvidence?: { note?: string; stashId?: string }
  accountsCsv?: { note?: string }
  historicalSustainabilityReport?: {
    reporting_year?: number
    organization_name?: string
    scope1_tco2e?: number
    scope2_tco2e_market?: number
    scope2_tco2e_location?: number
    scope3_tco2e?: number
    water_m3?: number
    waste_tonnes?: number
    waste_diversion_rate_pct?: number
    headcount?: number
    revenue_gbp?: number
    certifications_held?: string[]
    targets?: Array<{
      metric?: string
      year?: number
      percent_reduction?: number
      baseline_value?: number
      baseline_year?: number
      target_value?: number
      target_date?: string
    }>
    stashId?: string
    // Migration engine v1 (lib/ingest/migrate-report.ts) — deep-extraction
    // fields, present when the source document has them. All optional and
    // additive: an older/simpler upload with only the headline fields above
    // still works exactly as before.
    company_profile?: { name?: string; sector?: string; founding_year?: number }
    facilities?: Array<{ name: string; location?: string; type?: string }>
    baseline_year?: number
    annual_totals?: Array<{
      year: number
      scope1_tco2e?: number
      scope2_tco2e_market?: number
      scope2_tco2e_location?: number
      scope3_tco2e?: number
      energy_kwh?: number
      water_m3?: number
      waste_tonnes?: number
    }>
    products?: Array<{
      product_name: string
      functional_unit?: string
      system_boundary?: string
      reference_year?: number
      total_gwp_kgco2e?: number
      methodology?: string
    }>
    supplier_names?: string[]
    methodology_notes?: string
  }
  historicalLcaReport?: {
    product_name?: string
    functional_unit?: string
    reference_year?: number
    system_boundary?: 'cradle-to-gate' | 'cradle-to-grave' | 'gate-to-gate'
    total_gwp_kgco2e?: number
    stage_breakdown?: {
      raw_materials?: number
      processing?: number
      packaging?: number
      transport?: number
      use?: number
      eol?: number
    }
    water_footprint_l?: number
    methodology?: string
    study_commissioned_by?: string
    // Migration engine v1 — see historicalSustainabilityReport above.
    company_profile?: { name?: string; sector?: string; founding_year?: number }
    facilities?: Array<{ name: string; location?: string; type?: string }>
    products?: Array<{
      product_name: string
      functional_unit?: string
      system_boundary?: string
      reference_year?: number
      total_gwp_kgco2e?: number
      methodology?: string
    }>
    certifications_held?: string[]
    supplier_names?: string[]
    methodology_notes?: string
    stashId?: string
  }
  hospitalityMenu?: {
    looks_like?: 'food_menu' | 'drinks_menu' | 'mixed_menu'
    approx_item_count?: number
    stashId?: string
  }
  posSalesExport?: {
    pos_hint?: string
    stashId?: string
  }
  reason?: string
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const organizationId = formData.get('organizationId') as string | null
    // Which intake surface is driving this upload (data-revolution-plan.md
    // Pillar 1: one classifier, one learning substrate, shared by every
    // channel). Purely an admin-visible tag on ingest_jobs.channel — absent
    // or unrecognised falls back to the untagged default (the Smart Upload
    // dropzone), never blocks the upload.
    const channelRaw = formData.get('channel') as string | null
    const channel = channelRaw === 'rosa' || channelRaw === 'supplier_import' ? channelRaw : null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
    }

    const MAX_FILE_SIZE = 20 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[ingest/auto] Supabase service credentials not configured')
      return NextResponse.json({ error: 'Ingest service not configured' }, { status: 500 })
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey)

    // Access check: members AND active advisors (read or write) may reach an
    // org's data. This route runs on the service-role client which bypasses
    // RLS, so org scoping is enforced here in application code.
    const hasAccess = await userHasOrgAccess(serviceClient, user.id, organizationId)
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    // Smart upload writes into the org (stashed file + ingest job that seeds
    // org data), so read-only advisors are blocked here even though they can
    // reach the org for reads.
    const denied = await denyReadOnlyAdvisor(serviceClient, user, organizationId)
    if (denied) return denied

    const rate = checkRateLimit(organizationId)
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Slow down — you've uploaded ${RATE_LIMIT_MAX} documents in the last hour. Try again shortly.`,
        },
        { status: 429 },
      )
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer())

    let jobId: string
    try {
      const enqueued = await enqueueIngestJob({
        serviceClient,
        organizationId,
        userId: user.id,
        file: { bytes: fileBytes, name: file.name, mime: file.type || '', size: file.size },
        channel,
      })
      jobId = enqueued.jobId
    } catch (err: any) {
      console.error('[ingest/auto] enqueueIngestJob failed:', err?.message)
      return NextResponse.json({ error: err?.message || 'Failed to start ingest' }, { status: 500 })
    }

    return NextResponse.json({ jobId }, { status: 202 })
  } catch (err: any) {
    console.error('[ingest/auto] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
