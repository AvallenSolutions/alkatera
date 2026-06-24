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
// Sweeps the org's recent ingest_jobs and lifts any completed-but-unreviewed
// jobs into agent_exceptions. The classifier already did the hard part on
// upload; this handler is the bit that bridges "we classified it" to "the
// agent owns it now and the user sees it as a queue item rather than as a
// pending review modal".
//
// Triggers:
//   - on demand: PUT  /api/agents/footprint/run     (any org member)
//   - scheduled: POST /api/agents/footprint/run with Bearer CRON_SECRET
//                (sweeps every managed-tier org)
//
// Idempotent: the partial unique index on
// agent_exceptions(source_ref->>'ingestJobId') means we can re-run safely;
// duplicate inserts are caught and ignored.
// ───────────────────────────────────────────────────────────────────────────

interface RunSummary {
  organizationId: string
  exceptionsCreated: number
  ingestJobsSwept: number
  errors: string[]
}

async function sweepOrgIngestJobs(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  organizationId: string,
): Promise<RunSummary> {
  const summary: RunSummary = {
    organizationId,
    exceptionsCreated: 0,
    ingestJobsSwept: 0,
    errors: [],
  }

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
    summary.errors.push(`ingest_jobs query: ${jobsErr.message}`)
    return summary
  }
  summary.ingestJobsSwept = jobs?.length ?? 0
  if (!jobs?.length) return summary

  const jobIds = jobs.map((j: any) => j.id)
  const { data: existing } = await (admin as any)
    .from('agent_exceptions')
    .select('source_ref')
    .eq('organization_id', organizationId)
    .in('source_ref->>ingestJobId', jobIds)

  const seen = new Set(
    (existing ?? []).map((e: any) => e.source_ref?.ingestJobId).filter(Boolean),
  )

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

  if (!rows.length) return summary

  const { data: inserted, error: insertErr } = await (admin as any)
    .from('agent_exceptions')
    .insert(rows)
    .select('id')

  if (insertErr) {
    // The unique index on source_ref->>'ingestJobId' will reject any
    // already-queued job; that's an expected race, not an error.
    if (insertErr.code === '23505') {
      // Try one-by-one to count what actually landed.
      let created = 0
      for (const row of rows) {
        const { error: rowErr } = await (admin as any)
          .from('agent_exceptions')
          .insert(row)
        if (!rowErr) created += 1
        else if (rowErr.code !== '23505') summary.errors.push(rowErr.message)
      }
      summary.exceptionsCreated = created
    } else {
      summary.errors.push(`insert: ${insertErr.message}`)
    }
    return summary
  }

  summary.exceptionsCreated = inserted?.length ?? 0
  return summary
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
  const summary = await sweepOrgIngestJobs(admin, organizationId)
  return NextResponse.json(summary)
}

// Scheduled path — Bearer CRON_SECRET, sweeps every managed-tier org.
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
    .eq('managed_footprint_enabled', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const summaries: RunSummary[] = []
  for (const org of orgs || []) {
    const s = await sweepOrgIngestJobs(admin, org.id)
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
