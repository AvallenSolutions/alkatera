'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { sendRosaQueryStreamV2 } from '@/lib/gaia'
import { useOrganization } from '@/lib/organizationContext'
import type { RosaContextSlice } from './RosaContextProvider'

export interface RosaTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** True while streaming; flips to false on done/error. */
  streaming?: boolean
  /**
   * The persisted gaia_messages.id, set from the stream's done event. Absent
   * while streaming and on turns that errored before being saved. Feedback
   * needs it, so the rating controls only render once it arrives.
   */
  messageId?: string
  /** True if the turn errored mid-stream. */
  errored?: boolean
  /**
   * Chart payload Rosa attached to this turn (Phase B). Rendered by
   * RosaConversation under the message text via GaiaChartRenderer.
   */
  chart?: any
  /**
   * Action proposals that streamed alongside this turn (Phase B/C). Each
   * entry is a pending action from rosa_pending_actions; RosaConversation
   * renders them as ActionProposalCards under the message.
   */
  actionProposals?: Array<{
    id: string
    tool_name?: string
    preview: string
  }>
  /**
   * Tool result chips Rosa wants visible (Phase B): downloads, exports,
   * etc. Each carries the data needed to render an inline chip.
   */
  attachments?: Array<{
    kind: 'download' | 'link'
    label: string
    url: string
    filename?: string
    expires_at?: string | null
  }>
  createdAt: string
}

interface RecentConversation {
  id: string
  title: string | null
  message_count: number | null
  last_message_at: string | null
  created_at: string
}

interface UseRosaConversationResult {
  turns: RosaTurn[]
  conversationId: string | null
  isStreaming: boolean
  error: string | null
  /** Recent threads for the history dropdown (last 14 days, max 20). */
  recentConversations: RecentConversation[]
  /** True while we're hydrating from the server (auto-resume or switch). */
  isLoadingHistory: boolean
  /** Send a new message; returns once the stream completes. */
  sendMessage: (text: string, pageContext?: RosaContextSlice[]) => Promise<void>
  /** Reset to an empty conversation (no auto-resume on next mount). */
  reset: () => void
  /** Switch to a specific past conversation, hydrating its turns. */
  loadConversation: (id: string) => Promise<void>
  /** Refresh the recent-conversations list for the dropdown. */
  refreshRecent: () => Promise<void>
}

const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000 // 24h

/**
 * Conversation hook for Rosa's drawer. Owns:
 *
 *   - The streaming send loop (sendRosaQueryStreamV2)
 *   - Auto-resume of the user's most recent thread on mount, if it
 *     falls inside the 24h window. Older threads are reachable from the
 *     history dropdown but never auto-loaded.
 *   - Hydration of past turns (with their chart payloads) when the user
 *     switches to a past conversation.
 *   - Capture of `chart`, `action_proposal`, and tool-result events from
 *     the stream so RosaConversation can render rich outputs (Phase B).
 *
 * Persistence remains server-side; this hook just keeps a local mirror.
 */
export function useRosaConversation(): UseRosaConversationResult {
  const { currentOrganization } = useOrganization()
  const [turns, setTurns] = useState<RosaTurn[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const inFlightRef = useRef(false)
  /**
   * If the user explicitly clicks "New chat" we want to skip the
   * auto-resume logic for the rest of this session, even if the previous
   * thread is still inside the 24h window.
   */
  const explicitlyResetRef = useRef(false)

  /**
   * Hydrate `turns` from a server-side message list. Each row maps to one
   * RosaTurn; chart_data, if present, attaches to the assistant turn it
   * belongs to. Streaming/error flags are always false on hydrated turns.
   */
  const hydrateTurns = useCallback((messages: any[]) => {
    const out: RosaTurn[] = []
    for (const m of messages) {
      out.push({
        id: m.id,
        role: m.role,
        content: m.content || '',
        chart: m.chart_data ?? undefined,
        createdAt: m.created_at,
      })
    }
    setTurns(out)
  }, [])

  const refreshRecent = useCallback(async () => {
    if (!currentOrganization?.id) return
    try {
      const res = await fetch('/api/rosa/conversations/recent')
      if (!res.ok) return
      const body = await res.json()
      setRecentConversations(body.conversations || [])
    } catch {
      // non-critical; the dropdown just won't have items
    }
  }, [currentOrganization?.id])

  const loadConversation = useCallback(
    async (id: string) => {
      if (!currentOrganization?.id) return
      setIsLoadingHistory(true)
      setError(null)
      try {
        const res = await fetch(`/api/rosa/conversations/recent?id=${encodeURIComponent(id)}`)
        if (!res.ok) throw new Error('Could not load conversation')
        const body = await res.json()
        setConversationId(body.conversation?.id ?? id)
        hydrateTurns(body.messages || [])
      } catch (err: any) {
        setError(err?.message || 'Could not load conversation')
      } finally {
        setIsLoadingHistory(false)
      }
    },
    [currentOrganization?.id, hydrateTurns],
  )

  // Auto-resume on mount: pull the most recent thread (with messages) in
  // a single round-trip and hydrate if it's within the 24h window.
  useEffect(() => {
    if (!currentOrganization?.id) return
    let cancelled = false
    setIsLoadingHistory(true)
    fetch('/api/rosa/conversations/recent?with_messages=1')
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        if (cancelled || !body) return
        setRecentConversations(body.conversations || [])
        if (explicitlyResetRef.current) return
        const top = body.most_recent
        if (!top) return
        const lastAt = top.conversation?.last_message_at
          ? new Date(top.conversation.last_message_at).getTime()
          : 0
        if (Date.now() - lastAt < RESUME_WINDOW_MS) {
          setConversationId(top.conversation.id)
          hydrateTurns(top.messages || [])
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentOrganization?.id, hydrateTurns])

  const sendMessage = useCallback(
    async (text: string, pageContext?: RosaContextSlice[]) => {
      const trimmed = text.trim()
      if (!trimmed || inFlightRef.current) return
      if (!currentOrganization?.id) {
        setError('No organisation context.')
        return
      }
      inFlightRef.current = true
      setError(null)

      const userTurn: RosaTurn = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      }
      const assistantTurn: RosaTurn = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: '',
        streaming: true,
        createdAt: new Date().toISOString(),
      }
      setTurns(prev => [...prev, userTurn, assistantTurn])
      setIsStreaming(true)

      try {
        let acc = ''
        for await (const event of sendRosaQueryStreamV2({
          message: trimmed,
          conversation_id: conversationId ?? undefined,
          organization_id: currentOrganization.id,
          page_context: pageContext && pageContext.length > 0 ? pageContext : undefined,
        })) {
          if (event.type === 'text' && event.content) {
            acc += event.content
            setTurns(prev =>
              prev.map(t =>
                t.id === assistantTurn.id ? { ...t, content: acc } : t,
              ),
            )
          } else if (event.type === 'chart' && (event as any).chart_data) {
            // Attach the chart payload to the active assistant turn.
            const chart = (event as any).chart_data
            setTurns(prev =>
              prev.map(t => (t.id === assistantTurn.id ? { ...t, chart } : t)),
            )
          } else if (event.type === 'action_proposal') {
            const proposal = {
              id: (event as any).action_id as string,
              tool_name: (event as any).tool_name as string | undefined,
              preview: ((event as any).action_preview as string) || '',
            }
            setTurns(prev =>
              prev.map(t =>
                t.id === assistantTurn.id
                  ? { ...t, actionProposals: [...(t.actionProposals || []), proposal] }
                  : t,
              ),
            )
          } else if (event.type === 'tool_result') {
            // Phase B: tool results that carry an attachment (e.g.
            // generate_export) get rendered as a chip. Wired when the
            // generate_export tool ships.
            const preview = (event as any).tool_preview
            if (
              preview &&
              typeof preview === 'object' &&
              (preview as any).download_url
            ) {
              const att = preview as any
              setTurns(prev =>
                prev.map(t =>
                  t.id === assistantTurn.id
                    ? {
                        ...t,
                        attachments: [
                          ...(t.attachments || []),
                          {
                            kind: 'download' as const,
                            label: att.filename || 'Download',
                            url: att.download_url,
                            filename: att.filename,
                            expires_at: att.expires_at ?? null,
                          },
                        ],
                      }
                    : t,
                ),
              )
            }
          } else if (event.type === 'done') {
            if (event.conversation_id) setConversationId(event.conversation_id)
            // Carry the persisted gaia_messages.id onto the turn so the UI can
            // offer feedback on it. Without this the drawer has no way to name
            // which answer a thumbs-down refers to.
            if (event.message_id) {
              const persistedId = event.message_id
              setTurns(prev =>
                prev.map(t =>
                  t.id === assistantTurn.id ? { ...t, messageId: persistedId } : t,
                ),
              )
            }
          } else if (event.type === 'error') {
            throw new Error(event.error || 'Rosa hit an error.')
          }
        }
      } catch (err: any) {
        const msg = err?.message || 'Something went wrong talking to Rosa.'
        setError(msg)
        setTurns(prev =>
          prev.map(t =>
            t.id === assistantTurn.id
              ? { ...t, errored: true, streaming: false, content: t.content || msg }
              : t,
          ),
        )
      } finally {
        setTurns(prev =>
          prev.map(t =>
            t.id === assistantTurn.id ? { ...t, streaming: false } : t,
          ),
        )
        setIsStreaming(false)
        inFlightRef.current = false
        // Refresh the dropdown so the latest activity shows up at the
        // top — non-blocking.
        void refreshRecent()
      }
    },
    [conversationId, currentOrganization?.id, refreshRecent],
  )

  const reset = useCallback(() => {
    setTurns([])
    setConversationId(null)
    setError(null)
    explicitlyResetRef.current = true
  }, [])

  return {
    turns,
    conversationId,
    isStreaming,
    error,
    recentConversations,
    isLoadingHistory,
    sendMessage,
    reset,
    loadConversation,
    refreshRecent,
  }
}
