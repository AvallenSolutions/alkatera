import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'

// /api/ingest/stash?path=<orgId>/<userId>/<file>
//
// Owner-only retrieval and cleanup for files uploaded via the Universal
// Dropzone that are waiting to be picked up by a target page. The stash "id"
// is the storage path itself; we validate that the path is prefixed with
// `{orgId}/{userId}/` where userId matches the requesting user, and that
// the caller is a member of the org.
//
// Kept narrow on purpose: uploads happen inside /api/ingest/auto; this route
// only handles the signed-URL GET and the post-pickup DELETE.

const BUCKET = 'ingest-staging'

function parsePathPrefix(path: string): { orgId: string; userId: string } | null {
  const parts = path.split('/')
  if (parts.length < 3) return null
  const [orgId, userId] = parts
  if (!orgId || !userId) return null
  return { orgId, userId }
}

async function verifyOwnership(
  path: string,
  userId: string,
): Promise<{ ok: boolean; orgId?: string; status?: number; error?: string }> {
  const prefix = parsePathPrefix(path)
  if (!prefix) return { ok: false, status: 400, error: 'Invalid stash path' }
  if (prefix.userId !== userId) return { ok: false, status: 403, error: 'Not your stash' }

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: membership } = await serviceClient
    .from('organization_members')
    .select('id')
    .eq('organization_id', prefix.orgId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!membership) return { ok: false, status: 403, error: 'Access denied' }
  return { ok: true, orgId: prefix.orgId }
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const path = request.nextUrl.searchParams.get('path')
    if (!path) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 })
    }

    const check = await verifyOwnership(path, user.id)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data, error } = await serviceClient.storage
      .from(BUCKET)
      .createSignedUrl(path, 300) // 5 minutes is plenty for pickup
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'Stashed file not found' }, { status: 404 })
    }

    // Parse a friendly filename for display.
    const fileName = path.split('/').pop() || 'file'
    return NextResponse.json({ signedUrl: data.signedUrl, fileName })
  } catch (err: any) {
    console.error('[ingest/stash GET] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const path = request.nextUrl.searchParams.get('path')
    if (!path) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 })
    }

    const check = await verifyOwnership(path, user.id)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { error } = await serviceClient.storage.from(BUCKET).remove([path])
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[ingest/stash DELETE] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
