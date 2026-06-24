import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { deleteMemory, listMemories } from '@/lib/rosa/memory'

const MAX_VALUE_LEN = 1000

/**
 * Upsert a rosa_memory row without using ON CONFLICT — the table's uniqueness
 * is enforced by an expression index (COALESCE on user_id), which Postgres
 * can't match for ON CONFLICT. So we do it explicitly: select, then
 * update-or-insert.
 */
async function upsertMemory(
  service: SupabaseClient,
  organizationId: string,
  userId: string,
  scope: 'user' | 'org',
  key: string,
  value: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const v = value.trim().slice(0, MAX_VALUE_LEN)
  if (!v) return { ok: false, error: 'value is required' }

  const matchUserId = scope === 'user' ? userId : null
  let lookup = service
    .from('rosa_memory')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('scope', scope)
    .eq('key', key)
  lookup = matchUserId === null ? lookup.is('user_id', null) : lookup.eq('user_id', matchUserId)
  const { data: existing, error: selectErr } = await lookup.maybeSingle()
  if (selectErr) return { ok: false, error: selectErr.message }

  if (existing) {
    const { data, error } = await service
      .from('rosa_memory')
      .update({ value: v, updated_at: new Date().toISOString() })
      .eq('id', (existing as any).id)
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, id: (data as any).id }
  }

  const { data, error } = await service
    .from('rosa_memory')
    .insert({
      organization_id: organizationId,
      user_id: matchUserId,
      scope,
      key,
      value: v,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, id: (data as any).id }
}

export const runtime = 'nodejs'

// Keys callable from the client. Anything not in this set is rejected so this
// route can't be repurposed as a generic memory write surface.
const ALLOWED_KEYS = new Set([
  'persona',
  'hub_layout',
  'focus_areas',
  'progress_tracker_v1',
])

interface PostBody {
  key?: string
  value?: string
  scope?: 'user' | 'org'
}

async function resolveContext() {
  const userSupabase = getSupabaseServerClient()
  const {
    data: { user },
    error: userErr,
  } = await userSupabase.auth.getUser()
  if (userErr || !user) {
    return { error: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }) }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { error: NextResponse.json({ error: 'Service role missing' }, { status: 500 }) }
  }
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Member OR active advisor for the caller's selected org. Honours advisor
  // reads and respects the org the user switched into (app/user metadata).
  const organizationId = await resolveAccessibleOrg(service, user)
  if (!organizationId) {
    return { error: NextResponse.json({ error: 'No organisation' }, { status: 403 }) }
  }

  return {
    userId: user.id,
    organizationId,
    service,
  }
}

export async function POST(req: NextRequest) {
  let body: PostBody
  try {
    body = (await req.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const key = (body.key ?? '').trim().toLowerCase()
  const value = (body.value ?? '').trim()
  const scope = body.scope ?? 'user'

  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: `Key '${key}' is not writable from the client` }, { status: 400 })
  }
  if (!value) {
    return NextResponse.json({ error: 'value is required' }, { status: 400 })
  }
  if (scope !== 'user' && scope !== 'org') {
    return NextResponse.json({ error: 'scope must be user or org' }, { status: 400 })
  }

  const ctx = await resolveContext()
  if ('error' in ctx) return ctx.error

  const result = await upsertMemory(ctx.service, ctx.organizationId, ctx.userId, scope, key, value)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: result.id })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const requestedKey = url.searchParams.get('key')?.trim().toLowerCase() ?? null
  if (requestedKey && !ALLOWED_KEYS.has(requestedKey)) {
    return NextResponse.json({ error: `Key '${requestedKey}' is not readable from this route` }, { status: 400 })
  }

  const ctx = await resolveContext()
  if ('error' in ctx) return ctx.error

  const entries = await listMemories(ctx.service, ctx.organizationId, ctx.userId)
  const filtered = requestedKey ? entries.filter(e => e.key === requestedKey) : entries
  return NextResponse.json({ entries: filtered })
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const key = url.searchParams.get('key')?.trim().toLowerCase()
  if (!key || !ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: 'Valid key query param required' }, { status: 400 })
  }

  const ctx = await resolveContext()
  if ('error' in ctx) return ctx.error

  const entries = await listMemories(ctx.service, ctx.organizationId, ctx.userId)
  const target = entries.find(e => e.key === key && (e as any).scope !== 'org')
  if (!target) return NextResponse.json({ ok: true, deleted: false })

  const result = await deleteMemory(ctx.service, ctx.organizationId, ctx.userId, target.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true, deleted: true })
}
