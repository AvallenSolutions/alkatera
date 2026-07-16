import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import { userHasOrgAccess } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import {
  exceptionGroupsFromExtraction,
  additionalAnnualHistoricalRows,
  type MigrationExtraction,
} from '@/lib/ingest/migrate-report'

// POST /api/ingest/historical
//
// Persists an extracted historical report (sustainability report or prior
// LCA) into public.historical_imports. If a stash_id is provided (a path in
// the ingest-staging bucket) the source PDF is moved into historical-imports
// for audit-trail provenance.
//
// Migration engine v1 (data-revolution plan, Pillar 2b): when the extraction
// carries the richer migrate-report.ts shape (facilities, product PCFs,
// targets, certifications, multi-year totals), this route also —
//   1. drops a batched agent_exceptions row per entity kind so the Ask Queue
//      confirms them (never a silent write — see lib/intake/dispatch.ts for
//      the approve-time writers), and
//   2. writes one extra historical_imports row per additional year found in
//      annual_totals, so the trend/CCF fallback (lib/trends/historical-fallback.ts,
//      queried per year) has data for the whole history in one upload, not
//      just the headline year.
// Both are best-effort: the primary historical_imports row is the source of
// truth and always succeeds or fails on its own.

const STAGING_BUCKET = 'ingest-staging'
const TARGET_BUCKET = 'historical-imports'

interface SavePayload {
  kind: 'sustainability_report' | 'lca_report'
  organizationId: string
  reporting_year?: number | null
  source_document_name?: string
  extracted_data: Record<string, unknown>
  stash_id?: string
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = (await request.json()) as SavePayload
    if (!payload?.kind || !['sustainability_report', 'lca_report'].includes(payload.kind)) {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
    }
    if (!payload.organizationId) {
      return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
    }
    if (!payload.extracted_data || typeof payload.extracted_data !== 'object') {
      return NextResponse.json({ error: 'extracted_data required' }, { status: 400 })
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Advisor-aware access (a member-only check locked out write-access
    // advisors who had legitimately uploaded and reviewed the report), plus
    // the standard write guard for read-only advisors.
    const hasAccess = await userHasOrgAccess(serviceClient, user.id, payload.organizationId)
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    const denied = await denyReadOnlyAdvisor(serviceClient, user, payload.organizationId)
    if (denied) return denied

    // Move the source PDF from staging into the long-term audit bucket if provided.
    let finalStoragePath: string | null = null
    if (payload.stash_id) {
      const parts = payload.stash_id.split('/')
      if (parts.length < 3 || parts[0] !== payload.organizationId || parts[1] !== user.id) {
        return NextResponse.json({ error: 'Invalid stash_id' }, { status: 403 })
      }
      const targetPath = `${payload.organizationId}/${Date.now()}-${parts[parts.length - 1]}`
      // Download from staging → upload to target → delete staging copy.
      const { data: dl, error: dlErr } = await serviceClient.storage
        .from(STAGING_BUCKET)
        .download(payload.stash_id)
      if (dlErr || !dl) {
        return NextResponse.json({ error: 'Stashed file missing' }, { status: 404 })
      }
      const { error: upErr } = await serviceClient.storage
        .from(TARGET_BUCKET)
        .upload(targetPath, dl, { contentType: dl.type || 'application/pdf' })
      if (upErr) {
        console.error('[ingest/historical] Target upload failed:', upErr.message)
        return NextResponse.json({ error: 'Failed to preserve source document' }, { status: 500 })
      }
      await serviceClient.storage.from(STAGING_BUCKET).remove([payload.stash_id])
      finalStoragePath = targetPath
    }

    const { data, error } = await serviceClient
      .from('historical_imports')
      .insert({
        organization_id: payload.organizationId,
        kind: payload.kind,
        reporting_year: payload.reporting_year ?? null,
        source_document_name: payload.source_document_name ?? null,
        storage_object_path: finalStoragePath,
        extracted_data: payload.extracted_data,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('[ingest/historical] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ── Migration engine v1: best-effort, additive on top of the primary row ──
    let exceptionsCreated = 0
    let extraYearsSeeded = 0
    try {
      const extraction = payload.extracted_data as MigrationExtraction

      const groups = exceptionGroupsFromExtraction(extraction, {
        organizationId: payload.organizationId,
        historicalImportId: data.id,
        sourceDocumentName: payload.source_document_name ?? null,
        reportingYear: payload.reporting_year ?? null,
      })
      if (groups.length > 0) {
        const { error: excErr } = await serviceClient.from('agent_exceptions').insert(groups)
        if (excErr) {
          console.error('[ingest/historical] agent_exceptions insert failed (non-fatal):', excErr.message)
        } else {
          exceptionsCreated = groups.length
        }
      }

      // Only sustainability reports carry multi-year totals today; a prior
      // LCA report is one product/one reference year.
      if (payload.kind === 'sustainability_report') {
        const extraRows = additionalAnnualHistoricalRows(extraction.annual_totals, payload.reporting_year ?? null)
        if (extraRows.length > 0) {
          const { error: extraErr } = await serviceClient.from('historical_imports').insert(
            extraRows.map((row) => ({
              organization_id: payload.organizationId,
              kind: payload.kind,
              reporting_year: row.reporting_year,
              source_document_name: payload.source_document_name ?? null,
              storage_object_path: finalStoragePath,
              extracted_data: row.extracted_data,
              created_by: user.id,
            })),
          )
          if (extraErr) {
            console.error('[ingest/historical] extra-year rows insert failed (non-fatal):', extraErr.message)
          } else {
            extraYearsSeeded = extraRows.length
          }
        }
      }
    } catch (migrationErr: any) {
      // Never fail the save over the migration-engine extras — the primary
      // historical_imports row (the source of truth) is already committed.
      console.error('[ingest/historical] migration engine step failed (non-fatal):', migrationErr)
    }

    return NextResponse.json({ success: true, data, exceptionsCreated, extraYearsSeeded }, { status: 201 })
  } catch (err: any) {
    console.error('[ingest/historical] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
