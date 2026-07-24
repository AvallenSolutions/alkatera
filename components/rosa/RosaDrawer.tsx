'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Pin, PinOff, History, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Eyebrow, Panel } from '@/components/studio'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRosaContext } from '@/lib/rosa/RosaContextProvider'
import { useRosaConversation } from '@/lib/rosa/useRosaConversation'
import { RosaConversation } from './RosaConversation'
import { RosaInputBar } from './RosaInputBar'
import { NudgeRail } from './NudgeRail'
import { RosaPersonaPrompt } from './RosaPersonaPrompt'

const MIN_WIDTH = 320
const MAX_WIDTH = 600

/** The drawer's quiet header controls: a glyph, no chrome until hovered. */
const ICON_BUTTON =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-studio-dim transition-colors duration-150 ease-studio hover:bg-studio-ink/5 hover:text-foreground'

/**
 * Right-side ambient drawer for Rosa. Mounted at the AppLayout level so
 * it's available on every authenticated page. Two modes:
 *
 *   - Overlay (default): fixed positioning, slides in over the page,
 *     backdrop dims the rest. Click outside or press Esc to dismiss.
 *
 *   - Pinned: docked. The drawer takes a slice of horizontal space; the
 *     AppLayout's main content reflows so it isn't hidden. Width is
 *     resizable via a drag handle on the drawer's left edge. Pinned and
 *     width are persisted (RosaContextProvider handles localStorage).
 *
 * The conversation lives inside the drawer (no chat takeover, no route
 * change). Page context contributed via useRosaPageContext is forwarded
 * to Rosa on every send so she can answer page-specific questions.
 */
export function RosaDrawer() {
  const { isOpen } = useRosaContext()
  // Only mount the body (and therefore useRosaConversation, which fetches
  // recent conversation history on mount) when the drawer is actually open.
  // The drawer is mounted on every authenticated page, so gating here stops
  // a /api/rosa/conversations/recent fetch firing on every page load while
  // the drawer is invisible. Pinned implies isOpen=true (RosaContextProvider),
  // so auto-open + auto-resume for pinned users is preserved.
  if (!isOpen) return null
  return <RosaDrawerBody />
}

function RosaDrawerBody() {
  const {
    isPinned,
    width,
    close,
    setPinned,
    setWidth,
    slices,
    pendingPrompt,
    consumePendingPrompt,
    pendingConversationId,
    consumePendingConversationId,
  } = useRosaContext()
  const conv = useRosaConversation()

  // Pick up a prompt seeded from outside the drawer (hub chips, deep
  // links). Fires once whenever a new pending prompt arrives.
  useEffect(() => {
    if (pendingPrompt && pendingPrompt.length > 0) {
      conv.sendMessage(pendingPrompt, slices)
      consumePendingPrompt()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt])

  // Pick up a conversation id requested from outside the drawer (the hub's
  // "Recent conversations" card). Hydrates that thread; clears the signal.
  useEffect(() => {
    if (pendingConversationId) {
      conv.loadConversation(pendingConversationId)
      consumePendingConversationId()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingConversationId])

  // Drag-to-resize on the left edge while pinned.
  const draggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartWidthRef = useRef(width)

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isPinned) return
      draggingRef.current = true
      dragStartXRef.current = e.clientX
      dragStartWidthRef.current = width
      e.preventDefault()
    },
    [isPinned, width],
  )

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const delta = dragStartXRef.current - e.clientX
      const next = dragStartWidthRef.current + delta
      setWidth(next)
    }
    const onUp = () => {
      draggingRef.current = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [setWidth])

  const handleSubmit = useCallback(
    (prompt: string) => {
      conv.sendMessage(prompt, slices)
    },
    [conv, slices],
  )

  const headlineSlice = useMemo(() => {
    if (slices.length === 0) return null
    const sorted = [...slices].sort((a, b) => b.priority - a.priority)
    return sorted[0]
  }, [slices])

  const isConversing = conv.turns.length > 0

  return (
    <>
      {/* Overlay backdrop — only when not pinned. Studio ink at a low
          opacity rather than pure black: the paper behind stays warm. */}
      {!isPinned && (
        <div
          className="fixed inset-0 z-40 bg-studio-ink/30 transition-opacity"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* The drawer panel itself. */}
      <aside
        className={cn(
          'flex flex-col border-l border-studio-hairline bg-studio-cream',
          isPinned
            ? 'h-full flex-shrink-0 relative'
            : 'fixed right-0 top-0 bottom-0 z-50 motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-200 motion-safe:ease-studio',
        )}
        style={{ width: isPinned ? width : Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width)) }}
        role="dialog"
        aria-label="Rosa drawer"
      >
        {/* Resize handle on the left edge — only meaningful when pinned. */}
        {isPinned && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize transition-colors duration-150 ease-studio hover:bg-studio-ink/20 active:bg-studio-ink/40 z-10"
            onMouseDown={onResizeMouseDown}
            aria-label="Resize drawer"
          />
        )}

        {/* Header. The ring is the studio's signature for Rosa, the same
            one that opens the ink band; her name is a mono eyebrow, not a
            heading, because the drawer is chrome and not a page. */}
        <header className="flex flex-shrink-0 items-center gap-3 border-b border-studio-hairline px-4 py-3">
          <span
            aria-hidden="true"
            className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-[3.5px] border-studio-ink"
          />
          <div className="min-w-0 flex-1">
            <Eyebrow tone="dim">Rosa</Eyebrow>
            {headlineSlice && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground" title={headlineSlice.label}>
                {headlineSlice.label}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={ICON_BUTTON}
                aria-label="Recent conversations"
                title="Recent conversations"
              >
                <History className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Recent conversations
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => conv.reset()} className="gap-2">
                <Plus className="h-4 w-4 text-studio-dim" />
                <span>New conversation</span>
              </DropdownMenuItem>
              {conv.recentConversations.length > 0 && <DropdownMenuSeparator />}
              {conv.recentConversations.map(c => (
                <DropdownMenuItem
                  key={c.id}
                  onSelect={() => conv.loadConversation(c.id)}
                  className="flex flex-col items-start gap-0.5 py-2"
                >
                  <span className="line-clamp-1 w-full font-display text-sm font-semibold leading-snug">
                    {c.title || 'Untitled conversation'}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {c.message_count ?? 0}{' '}
                    {(c.message_count ?? 0) === 1 ? 'message' : 'messages'}
                    {c.last_message_at && ' · ' + fmtRelative(c.last_message_at)}
                  </span>
                </DropdownMenuItem>
              ))}
              {conv.recentConversations.length === 0 && (
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  No recent conversations yet.
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => setPinned(!isPinned)}
            className={ICON_BUTTON}
            aria-label={isPinned ? 'Unpin drawer' : 'Pin drawer'}
            title={isPinned ? 'Unpin drawer' : 'Pin drawer'}
          >
            {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={close}
            className={ICON_BUTTON}
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          {isConversing ? (
            <RosaConversation
              turns={conv.turns}
              isStreaming={conv.isStreaming}
              error={conv.error}
              onReset={conv.reset}
            />
          ) : (
            <DrawerEmptyState onAsk={handleSubmit} />
          )}
        </div>

        {/* Sticky input at bottom */}
        <div className="flex-shrink-0 border-t border-studio-hairline bg-studio-cream px-3 py-3">
          <RosaInputBar
            onSubmit={handleSubmit}
            placeholder={
              isConversing
                ? 'Reply to Rosa…'
                : headlineSlice
                  ? `Ask Rosa about this page…`
                  : 'Ask Rosa anything…'
            }
          />
        </div>
      </aside>
    </>
  )
}

const QUICK_PROMPTS: Array<{ label: string; prompt: string }> = [
  { label: 'What needs me today?', prompt: 'What are the three things I should focus on right now, given everything in my queue and upcoming deadlines?' },
  { label: 'Show my carbon footprint', prompt: 'Summarise my carbon footprint by scope and category for this year.' },
  { label: 'Help with this page', prompt: 'Help me with what I\'m looking at right now. Walk me through the key choices and what you\'d recommend.' },
  { label: 'What\'s coming up?', prompt: 'List my upcoming regulatory deadlines and how prepared I am for each.' },
]

/**
 * Drawer's empty state — what the user sees when they open Rosa for the
 * first time on a page (no conversation yet). Compact reuse of the
 * welcome chips + suggested prompts so users always see what they can do.
 */
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

function DrawerEmptyState({ onAsk }: { onAsk: (prompt: string) => void }) {
  return (
    <div className="space-y-6">
      {/* One-time persona picker. Self-gating: returns null unless the
          user has no stated persona and hasn't dismissed the prompt. */}
      <RosaPersonaPrompt />

      {/* Proactive nudges — surfaces queue items, anomalies, deadlines
          Rosa thinks the user should see right now. Hidden when nothing
          urgent is open. */}
      <NudgeRail />

      {/* Rosa introduces herself in her own voice, on paper, with no box
          around her: a statement, the way every room opens. */}
      <div>
        <Eyebrow tone="dim">Rosa</Eyebrow>
        <p className="mt-2 font-display text-lg font-semibold leading-snug tracking-[-0.01em] text-foreground">
          I can see what you are looking at.
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Ask me about this page, drop a document in below, or start with one of these.
        </p>
      </div>

      {/* The starters as hairline rows: the house list rhythm, the same one
          the desk and every room landing use. */}
      <div>
        <Eyebrow tone="dim">Try asking</Eyebrow>
        <ul className="mt-2 border-t border-studio-hairline">
          {QUICK_PROMPTS.map((p) => (
            <li key={p.label}>
              <button
                type="button"
                onClick={() => onAsk(p.prompt)}
                className="w-full border-b border-studio-hairline py-2.5 text-left text-sm leading-snug text-foreground transition-colors duration-150 ease-studio hover:text-room-accent"
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Panel className="p-4">
        <Eyebrow tone="dim">Give us anything</Eyebrow>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Drop a utility bill, a supplier document or a sustainability report into the box below.
          I will read it, work out what it is, and queue it for your sign-off.
        </p>
      </Panel>
    </div>
  )
}
