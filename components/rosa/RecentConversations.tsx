'use client'

import { useCallback, useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { useRosaContext } from '@/lib/rosa/RosaContextProvider'
import { useRealtimeRefresh } from '@/lib/rosa/useRealtimeRefresh'

interface Conversation {
  id: string
  title: string | null
  message_count: number
  last_message_at: string | null
  created_at: string
}

/**
 * Recent chat threads with Rosa, as quiet one-line rows for the page
 * margins. Pulls from gaia_conversations. Renders nothing while loading
 * and nothing when there is nothing to say: an empty margins row is noise.
 *
 * Clicking a thread resumes that conversation via the Rosa context.
 */
export function RecentConversations() {
  const { currentOrganization } = useOrganization()
  const { resumeConversation } = useRosaContext()
  const orgId = currentOrganization?.id
  const [conversations, setConversations] = useState<Conversation[] | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    const { data } = await supabase
      .from('gaia_conversations')
      .select('id, title, message_count, last_message_at, created_at')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(5)
    setConversations(data || [])
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    load().catch(() => setConversations([]))
  }, [orgId, load])

  // Live: when a conversation is created or its last_message_at updates,
  // surface the freshness immediately.
  useRealtimeRefresh(['gaia_conversations'], load)

  if (conversations === null || conversations.length === 0) return null

  return (
    <div>
      {conversations.map(c => (
        <button
          key={c.id}
          type="button"
          onClick={() => resumeConversation(c.id)}
          className="block w-full text-left transition-colors duration-150 ease-studio hover:bg-studio-ink/[0.03]"
        >
          <div className="flex items-baseline justify-between gap-4 border-b border-studio-hairline py-3">
            <div className="min-w-0 truncate text-sm">
              <span className="font-display font-semibold text-foreground">
                {c.title || 'Untitled conversation'}
              </span>
              <span className="text-studio-dim">
                {' '}· {c.message_count} {c.message_count === 1 ? 'message' : 'messages'}
              </span>
            </div>
            {c.last_message_at ? (
              <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
                {fmtRelative(c.last_message_at)}
              </div>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  )
}

function fmtRelative(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  if (d.toDateString() === yesterday.toDateString()) return 'yesterday'
  const days = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000))
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
