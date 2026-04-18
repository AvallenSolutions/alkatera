import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'

// POST /api/ingest/historical
//
// Persists an extracted historical report (sustainability report or prior
// LCA) into public.historical_imports. If a stash_id is provided (a path in
// the ingest-staging bucket) the source PDF is moved into historical-imports
// for audit-trail provenance.

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

    const { data: membership } = await serviceClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', payload.organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

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

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err: any) {
    console.error('[ingest/historical] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
