import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import type { ExtractedBillData } from '@/app/api/utilities/import-from-pdf/route'
import type {
  ExtractedFacilityBillData,
  ExtractedWaterEntry,
  ExtractedWasteEntry,
} from '@/app/api/facilities/import-bill/route'

// ───────────────────────────────────────────────────────────────────────────────
// Smart Upload enqueue endpoint.
//
// Stashes the incoming file in ingest-staging, inserts an ingest_jobs row,
// and fires a fire-and-forget HMAC-signed request to the -background Netlify
// function which runs the slow Claude classifier (15 min cap). The client
// then polls /api/ingest/auto/[jobId] for the result.
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

async function stashFile(
  serviceClient: any,
  file: File,
  orgId: string,
  userId: string,
): Promise<string | null> {
  try {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
    const path = `${orgId}/${userId}/${unique}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error } = await serviceClient.storage
      .from('ingest-staging')
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })
    if (error) {
      console.error('[ingest/auto] Stash upload failed:', error.message)
      return null
    }
    return path
  } catch (err: any) {
    console.error('[ingest/auto] Stash unexpected error:', err?.message)
    return null
  }
}

export type IngestResultType =
  | 'utility_bill'
  | 'water_bill'
  | 'waste_bill'
  | 'bulk_xlsx'
  | 'spray_diary'
  | 'bom'
  | 'soil_carbon_evidence'
  | 'accounts_csv'
  | 'historical_sustainability_report'
  | 'historical_lca_report'
  | 'unsupported'

export interface IngestResponse {
  type: IngestResultType
  utilityBill?: ExtractedBillData
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
    targets?: Array<{ metric?: string; year?: number; percent_reduction?: number }>
    stashId?: string
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

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
    }

    const MAX_FILE_SIZE = 20 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 })
    }

    const hmacSecret = process.env.INTERNAL_JOB_HMAC_SECRET
    if (!hmacSecret) {
      console.error('[ingest/auto] INTERNAL_JOB_HMAC_SECRET not set')
      return NextResponse.json({ error: 'Ingest service not configured' }, { status: 500 })
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: membership } = await serviceClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const rate = checkRateLimit(organizationId)
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Slow down — you've uploaded ${RATE_LIMIT_MAX} documents in the last hour. Try again shortly.`,
        },
        { status: 429 },
      )
    }

    const stashPath = await stashFile(serviceClient, file, organizationId, user.id)
    if (!stashPath) {
      return NextResponse.json({ error: 'Failed to stash uploaded file' }, { status: 500 })
    }

    const { data: job, error: insertErr } = await (serviceClient as any)
      .from('ingest_jobs')
      .insert({
        user_id: user.id,
        organization_id: organizationId,
        status: 'pending',
        phase_message: 'Queued…',
        stash_path: stashPath,
        file_name: file.name,
        file_mime: file.type || null,
      })
      .select('id')
      .single()

    if (insertErr || !job) {
      console.error('[ingest/auto] Failed to create job:', insertErr)
      return NextResponse.json({ error: 'Failed to start ingest' }, { status: 500 })
    }

    const triggerPayload = JSON.stringify({ jobId: job.id })
    const signature = createHmac('sha256', hmacSecret).update(triggerPayload).digest('hex')

    const baseUrl =
      process.env.URL ||
      process.env.DEPLOY_URL ||
      `${request.nextUrl.protocol}//${request.headers.get('host')}`
    const target = `${baseUrl}/.netlify/functions/ingest-auto-background`

    void fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-hmac': signature,
      },
      body: triggerPayload,
    }).catch((err) => {
      console.error('[ingest/auto] Failed to trigger background function:', err)
    })

    return NextResponse.json({ jobId: job.id }, { status: 202 })
  } catch (err: any) {
    console.error('[ingest/auto] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
