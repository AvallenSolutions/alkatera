'use client'

import { useCallback, useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageSquare, ArrowRight } from 'lucide-react'
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
 * Recent chat threads with Rosa. Pulls from gaia_conversations.
 *
 * Clicking a thread takes the user to the chat view; today this lands them
 * on the chat with the conversations sidebar where they can pick the right
 * one. A future Phase D enhancement will deep-link the specific
 * conversation via a query param Rosa Chat picks up on mount.
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

  if (conversations === null) {
    return (
      <div className="rounded-[6px] border border-border bg-card p-5 sm:p-6 h-full">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">
          Recent conversations
        </h2>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-[6px] border border-border bg-card p-5 sm:p-6 h-full">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">
          Recent conversations
        </h2>
        <p className="text-sm text-muted-foreground">
          You haven&apos;t chatted with Rosa yet. Start a conversation from the
          input bar below.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[6px] border border-border bg-card p-5 sm:p-6 h-full">
      <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-studio-forest" />
        Recent conversations
      </h2>
      <ul className="space-y-1">
        {conversations.map(c => (
          <li key={c.id}>
            <button
              onClick={() => resumeConversation(c.id)}
              className="group w-full text-left py-2 px-2 -mx-2 rounded-md hover:bg-muted transition-colors flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug truncate">
                  {c.title || 'Untitled conversation'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.message_count} {c.message_count === 1 ? 'message' : 'messages'}
                  {c.last_message_at && ` · ${fmtRelative(c.last_message_at)}`}
                </p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-studio-forest transition-colors flex-shrink-0" />
            </button>
          </li>
        ))}
      </ul>
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
