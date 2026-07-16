import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient, getSupabaseAdminClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import { titleAndSummaryForExceptionPayload } from '@/lib/agents/exception-format'
import { safeCompare } from '@/lib/utils/safe-compare'

export const runtime = 'nodejs'
export const maxDuration = 60

// ───────────────────────────────────────────────────────────────────────────
// Footprint Agent — daily run.
//
// Sweeps the org's recent job tables (ingest_jobs, product_import_jobs,
// supplier_product_import_jobs) and lifts any completed-but-unreviewed rows
// into agent_exceptions. The classifier/extractor already did the hard part
// on upload; this handler is the bit that bridges "we extracted it" to "the
// agent owns it now and the user sees it as a queue item rather than as a
// pending review modal".
//
// Triggers:
//   - on demand: PUT  /api/agents/footprint/run     (any org member)
//   - scheduled: POST /api/agents/footprint/run with Bearer CRON_SECRET
//                (sweeps every org)
//
// Idempotent: partial unique indexes on
// agent_exceptions(source_ref->>'ingestJobId' | 'productImportJobId' |
// 'supplierImportJobId') mean we can re-run safely; duplicate inserts are
// caught and ignored (see migration 20260716120000).
// ───────────────────────────────────────────────────────────────────────────

interface RunSummary {
  organizationId: string
  exceptionsCreated: number
  ingestJobsSwept: number
  productImportJobsSwept: number
  supplierImportJobsSwept: number
  errors: string[]
}

/**
 * Insert exception rows, tolerating the partial unique index on
 * `source_ref->>'<dedupKey>'` racing with a concurrent sweep. PostgREST
 * batch-inserts fail the whole batch on one conflict, so on a 23505 we
 * retry one row at a time and count what actually landed. Shared by all
 * three job-table sweeps below.
 */
async function insertExceptionsIdempotent(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  rows: Record<string, unknown>[],
  errors: string[],
): Promise<number> {
  if (!rows.length) return 0
  const { data: inserted, error: insertErr } = await (admin as any)
    .from('agent_exceptions')
    .insert(rows)
    .select('id')

  if (!insertErr) return inserted?.length ?? 0

  if (insertErr.code !== '23505') {
    errors.push(`insert: ${insertErr.message}`)
    return 0
  }
  let created = 0
  for (const row of rows) {
    const { error: rowErr } = await (admin as any).from('agent_exceptions').insert(row)
    if (!rowErr) created += 1
    else if (rowErr.code !== '23505') errors.push(rowErr.message)
  }
  return created
}

async function sweepOrgIngestJobs(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  organizationId: string,
  errors: string[],
): Promise<{ swept: number; created: number }> {
  // Recent completed jobs the agent hasn't queued yet. The 30-day window
  // keeps the per-run cost bounded; older jobs are assumed handled.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: jobs, error: jobsErr } = await (admin as any)
    .from('ingest_jobs')
    .select('id, organization_id, result_type, result_payload, file_name, created_at')
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200)

  if (jobsErr) {
    errors.push(`ingest_jobs query: ${jobsErr.message}`)
    return { swept: 0, created: 0 }
  }
  if (!jobs?.length) return { swept: 0, created: 0 }

  const jobIds = jobs.map((j: any) => j.id)
  const { data: existing } = await (admin as any)
    .from('agent_exceptions')
    .select('source_ref')
    .eq('organization_id', organizationId)
    .in('source_ref->>ingestJobId', jobIds)

  const seen = new Set((existing ?? []).map((e: any) => e.source_ref?.ingestJobId).filter(Boolean))

  const rows = jobs
    .filter((j: any) => !seen.has(j.id))
    .filter((j: any) => j.result_type && j.result_type !== 'unsupported')
    .map((j: any) => {
      const formatted = titleAndSummaryForExceptionPayload(j.result_type, j.result_payload, {
        fileName: j.file_name,
      })
      return {
        organization_id: organizationId,
        kind: j.result_type,
        source: 'agent_run',
        source_ref: { ingestJobId: j.id, fileName: j.file_name, sweptAt: new Date().toISOString() },
        payload: j.result_payload || {},
        title: formatted.title,
        summary: formatted.summary,
        confidence: formatted.confidence,
        status: 'open' as const,
      }
    })

  const created = await insertExceptionsIdempotent(admin, rows, errors)
  return { swept: jobs.length, created }
}

/**
 * Lifts completed `product_import_jobs` (website-product-import) rows into
 * the queue as a `website_import` summary exception. The confirm step that
 * actually creates products/certifications/suppliers still requires the
 * live import dialog (no resume-by-URL exists yet — see
 * WebsiteImportFlow.tsx), so this is a notification, not a write dispatch:
 * it tells the user N products were found and links to /products.
 */
async function sweepOrgProductImportJobs(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  organizationId: string,
  errors: string[],
): Promise<{ swept: number; created: number }> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: jobs, error: jobsErr } = await (admin as any)
    .from('product_import_jobs')
    .select('id, url, products, created_at')
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50)

  if (jobsErr) {
    errors.push(`product_import_jobs query: ${jobsErr.message}`)
    return { swept: 0, created: 0 }
  }
  if (!jobs?.length) return { swept: 0, created: 0 }

  const jobIds = jobs.map((j: any) => j.id)
  const { data: existing } = await (admin as any)
    .from('agent_exceptions')
    .select('source_ref')
    .eq('organization_id', organizationId)
    .in('source_ref->>productImportJobId', jobIds)
  const seen = new Set((existing ?? []).map((e: any) => e.source_ref?.productImportJobId).filter(Boolean))

  const rows = jobs
    .filter((j: any) => !seen.has(j.id))
    .map((j: any) => {
      const count = Array.isArray(j.products) ? j.products.length : 0
      return {
        organization_id: organizationId,
        kind: 'website_import',
        source: 'agent_run',
        source_ref: { productImportJobId: j.id, url: j.url, sweptAt: new Date().toISOString() },
        payload: { url: j.url, product_count: count },
        title: `Website import: ${j.url || 'unknown site'}`,
        summary: count > 0 ? `${count} product${count === 1 ? '' : 's'} found` : null,
        confidence: 0.7,
        status: 'open' as const,
      }
    })

  const created = await insertExceptionsIdempotent(admin, rows, errors)
  return { swept: jobs.length, created }
}

/**
 * Lifts completed `supplier_product_import_jobs` rows into the queue as a
 * `supplier_catalog_import` summary exception. Same shape as product_import
 * — extraction sits as JSON until a confirm step commits real
 * `supplier_products` rows, and no resume-by-URL exists yet, so this is a
 * notification that links back to the Smart Import dialog.
 */
async function sweepOrgSupplierImportJobs(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  organizationId: string,
  errors: string[],
): Promise<{ swept: number; created: number }> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: jobs, error: jobsErr } = await (admin as any)
    .from('supplier_product_import_jobs')
    .select('id, supplier_id, extracted_products, created_at')
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50)

  if (jobsErr) {
    // Table may not exist on older local snapshots; treat as "nothing to sweep".
    if (jobsErr.code !== '42P01') errors.push(`supplier_product_import_jobs query: ${jobsErr.message}`)
    return { swept: 0, created: 0 }
  }
  if (!jobs?.length) return { swept: 0, created: 0 }

  const jobIds = jobs.map((j: any) => j.id)
  const { data: existing } = await (admin as any)
    .from('agent_exceptions')
    .select('source_ref')
    .eq('organization_id', organizationId)
    .in('source_ref->>supplierImportJobId', jobIds)
  const seen = new Set((existing ?? []).map((e: any) => e.source_ref?.supplierImportJobId).filter(Boolean))

  const supplierIds = Array.from(new Set(jobs.map((j: any) => j.supplier_id).filter(Boolean)))
  const { data: suppliers } = supplierIds.length
    ? await (admin as any).from('suppliers').select('id, name').in('id', supplierIds)
    : { data: [] as any[] }
  const supplierNameById = new Map((suppliers ?? []).map((s: any) => [s.id, s.name]))

  const rows = jobs
    .filter((j: any) => !seen.has(j.id))
    .map((j: any) => {
      const products = j.extracted_products?.products
      const count = Array.isArray(products) ? products.length : 0
      const supplierName = supplierNameById.get(j.supplier_id) || 'a supplier'
      return {
        organization_id: organizationId,
        kind: 'supplier_catalog_import',
        source: 'agent_run',
        source_ref: { supplierImportJobId: j.id, supplierId: j.supplier_id, sweptAt: new Date().toISOString() },
        payload: { supplier_id: j.supplier_id, supplier_name: supplierName, product_count: count },
        title: `Supplier catalogue import: ${supplierName}`,
        summary: count > 0 ? `${count} product${count === 1 ? '' : 's'} extracted, awaiting confirmation` : null,
        confidence: 0.7,
        status: 'open' as const,
      }
    })

  const created = await insertExceptionsIdempotent(admin, rows, errors)
  return { swept: jobs.length, created }
}

async function sweepOrg(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  organizationId: string,
): Promise<RunSummary> {
  const errors: string[] = []
  const [ingest, productImport, supplierImport] = await Promise.all([
    sweepOrgIngestJobs(admin, organizationId, errors),
    sweepOrgProductImportJobs(admin, organizationId, errors),
    sweepOrgSupplierImportJobs(admin, organizationId, errors),
  ])
  return {
    organizationId,
    exceptionsCreated: ingest.created + productImport.created + supplierImport.created,
    ingestJobsSwept: ingest.swept,
    productImportJobsSwept: productImport.swept,
    supplierImportJobsSwept: supplierImport.swept,
    errors,
  }
}

// On-demand path — any member of the org can trigger their own org's sweep.
export async function PUT(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }

  const denied = await denyReadOnlyAdvisor(client as any, user, organizationId)
  if (denied) return denied

  const admin = getSupabaseAdminClient()
  const summary = await sweepOrg(admin, organizationId)
  return NextResponse.json(summary)
}

// Scheduled path — Bearer CRON_SECRET, sweeps every org. The queue is
// standard now (no longer gated behind managed_footprint_enabled, which was
// a pilot flag), so every org with recent job activity gets swept.
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const auth = request.headers.get('authorization') || ''
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!safeCompare(provided, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdminClient()
  const { data: orgs, error } = await (admin as any)
    .from('organizations')
    .select('id, name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const summaries: RunSummary[] = []
  for (const org of orgs || []) {
    const s = await sweepOrg(admin, org.id)
    summaries.push(s)
  }

  const totalExceptions = summaries.reduce((acc, s) => acc + s.exceptionsCreated, 0)
  return NextResponse.json({
    runAt: new Date().toISOString(),
    organisations: summaries.length,
    totalExceptionsCreated: totalExceptions,
    summaries,
  })
}
