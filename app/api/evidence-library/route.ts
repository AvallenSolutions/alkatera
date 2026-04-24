import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'

// GET  /api/evidence-library?organizationId=…  → list the org's library
// POST /api/evidence-library                  → multipart upload
//
// Upload body: FormData { file, organizationId, title, description?, tags? }
// Rejects non-PDF / non-image files; 20 MB cap.

const BUCKET = 'evidence-library'
const MAX_FILE_SIZE = 20 * 1024 * 1024
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export async function GET(request: NextRequest) {
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

    // Load docs + link counts in two cheap queries.
    const { data: docs, error } = await serviceClient
      .from('evidence_documents')
      .select('id, title, description, tags, document_name, mime_type, file_size_bytes, created_at, updated_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const docIds = (docs || []).map((d) => d.id)
    let linkCounts: Record<string, number> = {}
    if (docIds.length > 0) {
      const { data: links } = await serviceClient
        .from('certification_evidence_links')
        .select('source_record_id')
        .eq('organization_id', organizationId)
        .eq('source_module', 'evidence_library')
        .in('source_record_id', docIds)
      for (const l of (links || [])) {
        const key = (l as any).source_record_id
        if (key) linkCounts[key] = (linkCounts[key] || 0) + 1
      }
    }

    return NextResponse.json({
      data: (docs || []).map((d) => ({ ...d, linked_count: linkCounts[d.id] || 0 })),
    })
  } catch (err: any) {
    console.error('[evidence-library GET] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
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
    const title = (formData.get('title') as string | null)?.trim()
    const description = (formData.get('description') as string | null)?.trim() || null
    const tagsRaw = formData.get('tags') as string | null
    const tags = tagsRaw
      ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : []

    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })
    if (!organizationId) return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File must be under 20 MB' }, { status: 400 })
    }
    if (!ALLOWED_MIMES.includes(file.type)) {
      return NextResponse.json({ error: 'Upload a PDF or image (JPEG/PNG/WebP)' }, { status: 400 })
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

    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
    const storagePath = `${organizationId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadErr } = await serviceClient.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })
    if (uploadErr) {
      console.error('[evidence-library POST] Upload error:', uploadErr)
      return NextResponse.json({ error: 'File upload failed' }, { status: 500 })
    }

    const { data, error } = await serviceClient
      .from('evidence_documents')
      .insert({
        organization_id: organizationId,
        title,
        description,
        tags,
        document_name: file.name,
        storage_object_path: storagePath,
        mime_type: file.type,
        file_size_bytes: file.size,
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('[evidence-library POST] Insert error:', error)
      await serviceClient.storage.from(BUCKET).remove([storagePath])
      return NextResponse.json({ error: 'Could not save document' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err: any) {
    console.error('[evidence-library POST] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
