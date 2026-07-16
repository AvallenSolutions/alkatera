/**
 * Per-message feedback for Rosa's studio conversation.
 * POST /api/rosa/feedback   body: { message_id, verdict }
 *
 * One tap stores a verdict against a gaia_messages row; a second tap on a
 * different option replaces it (unique(message_id, user_id), upserted).
 * Fire-and-forget from the UI (components/rosa/RosaConversation.tsx) -- a
 * dropped request just means one missed data point, never a blocked chat.
 *
 * Auth pattern cribbed from /api/rosa/memory: verify the caller, resolve
 * their accessible org, then use the service-role client for the actual
 * write (RLS on rosa_message_feedback only covers direct reads).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'

export const runtime = 'nodejs'

const VERDICTS = new Set(['helpful', 'not_right', 'too_vague'])

interface PostBody {
  message_id?: string
  verdict?: string
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

  const organizationId = await resolveAccessibleOrg(service, user)
  if (!organizationId) {
    return { error: NextResponse.json({ error: 'No organisation' }, { status: 403 }) }
  }

  return { userId: user.id, organizationId, service }
}

export async function POST(req: NextRequest) {
  let body: PostBody
  try {
    body = (await req.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const messageId = (body.message_id ?? '').trim()
  const verdict = (body.verdict ?? '').trim()
  if (!messageId) {
    return NextResponse.json({ error: 'message_id is required' }, { status: 400 })
  }
  if (!VERDICTS.has(verdict)) {
    return NextResponse.json(
      { error: `verdict must be one of ${Array.from(VERDICTS).join(', ')}` },
      { status: 400 },
    )
  }

  const ctx = await resolveContext()
  if ('error' in ctx) return ctx.error

  // The message must belong to a conversation the caller owns, in their
  // accessible org -- feedback can only be given on your own Rosa thread.
  const { data: message } = await ctx.service
    .from('gaia_messages')
    .select('id, role, conversation_id')
    .eq('id', messageId)
    .maybeSingle()
  if (!message || (message as any).role !== 'assistant') {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  const { data: conversation } = await ctx.service
    .from('gaia_conversations')
    .select('id, organization_id, user_id')
    .eq('id', (message as any).conversation_id)
    .maybeSingle()
  if (
    !conversation ||
    (conversation as any).organization_id !== ctx.organizationId ||
    (conversation as any).user_id !== ctx.userId
  ) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  const { error } = await (ctx.service as SupabaseClient)
    .from('rosa_message_feedback')
    .upsert(
      {
        message_id: messageId,
        conversation_id: (conversation as any).id,
        organization_id: ctx.organizationId,
        user_id: ctx.userId,
        verdict,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'message_id,user_id' },
    )
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
