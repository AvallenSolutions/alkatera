import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import { titleAndSummaryForExceptionPayload } from '@/lib/agents/exception-format'

export const runtime = 'nodejs'

// ───────────────────────────────────────────────────────────────────────────
// GET /api/agents/exceptions
//
// Lists the current org's exception queue. Default: status='open', most recent
// first, capped at 200. The Agent Console reads this directly.
// ───────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }

  const url = new URL(request.url)
  const status = url.searchParams.get('status') || 'open'
  const kind = url.searchParams.get('kind')
  const limit = Math.min(Number(url.searchParams.get('limit') || '200'), 500)

  let query = (client as any)
    .from('agent_exceptions')
    .select(
      'id, kind, source, source_ref, payload, suggested_facility_id, suggested_supplier_id, confidence, title, summary, status, reviewed_by, reviewed_at, applied_to, created_at, updated_at',
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status !== 'all') query = query.eq('status', status)
  if (kind) {
    query = query.eq('kind', kind)
  } else {
    // 'factor_gap' is alkatera-internal (tasks/data-revolution-plan.md,
    // Pillar 2: "the user never sees a factor picker") — resolved from
    // /admin-tools/factor-queue, never the org's own Ask Queue.
    query = query.neq('kind', 'factor_gap')
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ exceptions: data ?? [] })
}

// ───────────────────────────────────────────────────────────────────────────
// POST /api/agents/exceptions
//
// Creates an exception from a completed ingest_jobs row. Idempotent on
// (source_ref->>ingestJobId), so calling it twice for the same job is safe.
// Used both by the daily run handler and by the email-in webhook.
// ───────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => ({}))
  const ingestJobId: string | undefined = body?.ingestJobId

  if (!ingestJobId) {
    return NextResponse.json({ error: 'ingestJobId required' }, { status: 400 })
  }

  const { data: job, error: jobErr } = await (client as any)
    .from('ingest_jobs')
    .select('id, organization_id, result_type, result_payload, file_name, status')
    .eq('id', ingestJobId)
    .maybeSingle()

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Ingest job not found' }, { status: 404 })
  }
  if (job.organization_id !== organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (job.status !== 'completed' || !job.result_type) {
    return NextResponse.json(
      { error: 'Job not yet completed', status: job.status },
      { status: 409 },
    )
  }

  const formatted = titleAndSummaryForExceptionPayload(job.result_type, job.result_payload, {
    fileName: job.file_name,
  })

  const insert = {
    organization_id: organizationId,
    kind: job.result_type,
    source: body?.source || 'upload',
    source_ref: { ingestJobId, fileName: job.file_name, ...(body?.source_ref || {}) },
    payload: job.result_payload || {},
    title: formatted.title,
    summary: formatted.summary,
    confidence: formatted.confidence,
    status: 'open' as const,
  }

  // ON CONFLICT on the partial unique index keyed by source_ref->>ingestJobId
  // — this is what makes the call idempotent. PostgREST doesn't expose the
  // expression-index target syntax, so we do an upsert on the row's natural
  // key by deleting any existing row with the same ingestJobId in 'open'.
  const { data: existing } = await (client as any)
    .from('agent_exceptions')
    .select('id, status')
    .filter('source_ref->>ingestJobId', 'eq', ingestJobId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ exception: { id: existing.id, status: existing.status }, deduped: true })
  }

  const { data: created, error: insertErr } = await (client as any)
    .from('agent_exceptions')
    .insert(insert)
    .select('id, status')
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ exception: created })
}
