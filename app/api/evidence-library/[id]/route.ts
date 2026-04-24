import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'

// GET    /api/evidence-library/[id]?organizationId=…
//   → document + signed URL + linked requirements + pending/rejected suggestions
// DELETE /api/evidence-library/[id]?organizationId=…
//   → removes from DB (links + suggestions cascade) + storage bucket

const BUCKET = 'evidence-library'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const organizationId = request.nextUrl.searchParams.get('organizationId')
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
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

    const { data: doc, error: docErr } = await serviceClient
      .from('evidence_documents')
      .select('*')
      .eq('id', params.id)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (docErr || !doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Signed URL (1 hour) for PDF preview
    const { data: signed } = await serviceClient.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_object_path, 3600)

    // Links → join through requirement + framework
    const { data: links } = await serviceClient
      .from('certification_evidence_links')
      .select(`
        id,
        requirement_id,
        evidence_type,
        evidence_description,
        verification_status,
        created_at,
        framework_requirements:requirement_id (
          id, requirement_code, requirement_name, framework_id,
          certification_frameworks:framework_id ( framework_code, framework_name )
        )
      `)
      .eq('organization_id', organizationId)
      .eq('source_module', 'evidence_library')
      .eq('source_record_id', params.id)
      .order('created_at', { ascending: false })

    // Suggestions (pending + rejected). Frontend filters to pending.
    const { data: suggestions } = await serviceClient
      .from('evidence_suggestions')
      .select(`
        id, requirement_id, confidence, reasoning, status, created_at,
        framework_requirements:requirement_id (
          id, requirement_code, requirement_name, framework_id,
          certification_frameworks:framework_id ( framework_code, framework_name )
        )
      `)
      .eq('evidence_document_id', params.id)
      .order('confidence', { ascending: false })

    return NextResponse.json({
      data: {
        ...doc,
        signed_url: signed?.signedUrl || null,
        links: links || [],
        suggestions: suggestions || [],
      },
    })
  } catch (err: any) {
    console.error('[evidence-library/[id] GET] Error:', err)
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
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
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

    const { data: doc } = await serviceClient
      .from('evidence_documents')
      .select('storage_object_path')
      .eq('id', params.id)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Kill any certification_evidence_links pointing at this doc.
    await serviceClient
      .from('certification_evidence_links')
      .delete()
      .eq('organization_id', organizationId)
      .eq('source_module', 'evidence_library')
      .eq('source_record_id', params.id)

    // Drop the storage object. Errors here are non-fatal — orphans are cleared by bucket TTL if we ever add one.
    await serviceClient.storage.from(BUCKET).remove([doc.storage_object_path])

    // Cascade-delete suggestions + the document row itself.
    const { error: delErr } = await serviceClient
      .from('evidence_documents')
      .delete()
      .eq('id', params.id)
      .eq('organization_id', organizationId)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[evidence-library/[id] DELETE] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
