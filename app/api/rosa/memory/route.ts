import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { deleteMemory, listMemories, saveMemory } from '@/lib/rosa/memory'

const MAX_VALUE_LEN = 1000

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

  const result = await saveMemory(ctx.service, ctx.organizationId, ctx.userId, scope, key, value)
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
