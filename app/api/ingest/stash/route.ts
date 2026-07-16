import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import { userHasOrgAccess } from '@/lib/supabase/verify-org-access'

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
  // Members OR active advisors — not members-only. The stash path is already
  // keyed to this user's own upload (userId matched above); a read+write
  // advisor who uploaded a BOM via /api/ingest/auto must be able to pick it up
  // again in the recipe editor. The old members-only check denied advisors,
  // which is why the Toby & Co BOM never reached the recipe.
  const hasAccess = await userHasOrgAccess(serviceClient, userId, prefix.orgId)
  if (!hasAccess) return { ok: false, status: 403, error: 'Access denied' }
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

    // Carry the classifier's already-extracted BOM recipe (line items + the
    // product's finished size) so the recipe editor can seed the import
    // directly instead of re-parsing the raw file — which the regex parser
    // cannot do for xlsx and cannot do with per-litre awareness.
    let bom: unknown = null
    const { data: job } = await (serviceClient as any)
      .from('ingest_jobs')
      .select('result_type, result_payload')
      .eq('stash_path', path)
      .maybeSingle()
    if (job?.result_type === 'bom' && job.result_payload?.bom) {
      const b = job.result_payload.bom
      bom = {
        line_items: Array.isArray(b.line_items) ? b.line_items : [],
        unit_size_value: b.unit_size_value ?? null,
        unit_size_unit: b.unit_size_unit ?? null,
        product_name: b.product_name ?? null,
      }
    }

    // Parse a friendly filename for display.
    const fileName = path.split('/').pop() || 'file'
    return NextResponse.json({ signedUrl: data.signedUrl, fileName, bom })
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
