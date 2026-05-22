import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'

export const runtime = 'nodejs'

/**
 * GET /api/rosa/conversations/recent
 *
 * Returns the requesting user's recent Rosa conversations (last 14 days,
 * max 20). Used by:
 *   1. The drawer's auto-resume logic — picks the most recent active
 *      thread and hydrates `useRosaConversation` if it falls inside the
 *      24-hour window.
 *   2. The drawer header's history dropdown — lets users switch between
 *      threads from earlier in the week.
 *
 * Each item also carries the loaded turns so the drawer can render the
 * thread without a second round-trip when the user switches.
 */
export async function GET(request: NextRequest) {
  const userSupabase = getSupabaseServerClient()
  const {
    data: { user },
    error: userErr,
  } = await userSupabase.auth.getUser()
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const { data: membership } = await userSupabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!membership) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }
  const organizationId = (membership as any).organization_id as string

  const url = new URL(request.url)
  const includeMessages = url.searchParams.get('with_messages') === '1'
  const conversationId = url.searchParams.get('id')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Service role missing' }, { status: 500 })
  }
  const service = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Single conversation fetch: for the drawer to hydrate when the user
  // picks a specific thread from the dropdown.
  if (conversationId) {
    const { data: conv, error } = await (service as any)
      .from('gaia_conversations')
      .select('id, title, message_count, last_message_at, created_at')
      .eq('id', conversationId)
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    const { data: messages } = await (service as any)
      .from('gaia_messages')
      .select('id, role, content, chart_data, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    return NextResponse.json({ conversation: conv, messages: messages || [] })
  }

  // List path: recent conversations (last 14 days, max 20).
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: conversations, error } = await (service as any)
    .from('gaia_conversations')
    .select('id, title, message_count, last_message_at, created_at, is_active')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .gte('last_message_at', since)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(20)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!includeMessages || !conversations || conversations.length === 0) {
    return NextResponse.json({ conversations: conversations || [] })
  }

  // Optionally hydrate the most recent thread's messages so the drawer
  // can auto-resume in a single round-trip.
  const top = conversations[0]
  const { data: messages } = await (service as any)
    .from('gaia_messages')
    .select('id, role, content, chart_data, created_at')
    .eq('conversation_id', top.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    conversations,
    most_recent: {
      conversation: top,
      messages: messages || [],
    },
  })
}
