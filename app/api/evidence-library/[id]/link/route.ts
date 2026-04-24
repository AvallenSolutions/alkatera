import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'

// POST /api/evidence-library/[id]/link
//   Body: { organizationId, requirementId, acceptSuggestionId?, evidenceType? }
//   Creates a certification_evidence_links row pointing at this doc. If
//   `acceptSuggestionId` is provided, the matching evidence_suggestions row
//   flips to 'accepted'.
//
// DELETE /api/evidence-library/[id]/link?organizationId=…&linkId=…
//   Removes one link.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json().catch(() => ({}))
    const { organizationId, requirementId, acceptSuggestionId, evidenceType } = body || {}
    if (!organizationId || !requirementId) {
      return NextResponse.json({ error: 'organizationId and requirementId required' }, { status: 400 })
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

    // Load the doc + its title for the evidence_description fallback.
    const { data: doc } = await serviceClient
      .from('evidence_documents')
      .select('id, title')
      .eq('id', params.id)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Guard against duplicate links for the same (requirement, doc) pair.
    const { data: existing } = await serviceClient
      .from('certification_evidence_links')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('requirement_id', requirementId)
      .eq('source_module', 'evidence_library')
      .eq('source_record_id', params.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ success: true, data: existing, deduped: true })
    }

    const { data: link, error: linkErr } = await serviceClient
      .from('certification_evidence_links')
      .insert({
        organization_id: organizationId,
        requirement_id: requirementId,
        source_module: 'evidence_library',
        source_table: 'evidence_documents',
        source_record_id: params.id,
        evidence_type: evidenceType || 'document',
        evidence_description: doc.title,
        verification_status: 'pending',
      })
      .select()
      .single()
    if (linkErr) {
      console.error('[evidence-library/link POST] Error:', linkErr)
      return NextResponse.json({ error: linkErr.message }, { status: 500 })
    }

    // If this came from accepting a suggestion, flip its status.
    if (acceptSuggestionId) {
      await serviceClient
        .from('evidence_suggestions')
        .update({ status: 'accepted' })
        .eq('id', acceptSuggestionId)
        .eq('organization_id', organizationId)
    }

    return NextResponse.json({ success: true, data: link })
  } catch (err: any) {
    console.error('[evidence-library/link POST] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/evidence-library/[id]/link?organizationId=…&rejectSuggestionId=…
// Flips an evidence_suggestions row to 'rejected' so it stops surfacing.
// Kept narrow on purpose — accept goes through POST (which creates a link).
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const organizationId = request.nextUrl.searchParams.get('organizationId')
    const rejectSuggestionId = request.nextUrl.searchParams.get('rejectSuggestionId')
    if (!organizationId || !rejectSuggestionId) {
      return NextResponse.json({ error: 'organizationId and rejectSuggestionId required' }, { status: 400 })
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

    const { error } = await serviceClient
      .from('evidence_suggestions')
      .update({ status: 'rejected' })
      .eq('id', rejectSuggestionId)
      .eq('organization_id', organizationId)
      .eq('evidence_document_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[evidence-library/link PATCH] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const organizationId = request.nextUrl.searchParams.get('organizationId')
    const linkId = request.nextUrl.searchParams.get('linkId')
    if (!organizationId || !linkId) {
      return NextResponse.json({ error: 'organizationId and linkId required' }, { status: 400 })
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

    const { error } = await serviceClient
      .from('certification_evidence_links')
      .delete()
      .eq('id', linkId)
      .eq('organization_id', organizationId)
      .eq('source_module', 'evidence_library')
      .eq('source_record_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[evidence-library/link DELETE] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
