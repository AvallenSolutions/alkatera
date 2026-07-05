'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Dog,
  X,
  Pin,
  PinOff,
  Sparkles,
  Inbox,
  Upload,
  MessageSquare,
  ArrowRight,
  History,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
      {/* Overlay backdrop — only when not pinned. */}
      {!isPinned && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* The drawer panel itself. */}
      <aside
        className={cn(
          'flex flex-col bg-card border-l border-border',
          isPinned
            ? 'h-full flex-shrink-0 relative'
            : 'fixed right-0 top-0 bottom-0 z-50 animate-in slide-in-from-right duration-200',
        )}
        style={{ width: isPinned ? width : Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width)) }}
        role="dialog"
        aria-label="Rosa drawer"
      >
        {/* Resize handle on the left edge — only meaningful when pinned. */}
        {isPinned && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-studio-forest/40 active:bg-studio-forest/60 transition-colors z-10"
            onMouseDown={onResizeMouseDown}
            aria-label="Resize drawer"
          />
        )}

        {/* Header */}
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
          <div className="rounded-md bg-secondary p-1.5">
            <Dog className="h-4 w-4 text-studio-forest" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Rosa</p>
            {headlineSlice && (
              <p className="text-xs text-muted-foreground truncate" title={headlineSlice.label}>
                {headlineSlice.label}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Recent conversations"
                title="Recent conversations"
              >
                <History className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                Recent conversations
              </DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => conv.reset()}
                className="gap-2"
              >
                <Plus className="h-4 w-4 text-studio-forest" />
                <span>New chat</span>
              </DropdownMenuItem>
              {conv.recentConversations.length > 0 && <DropdownMenuSeparator />}
              {conv.recentConversations.map(c => (
                <DropdownMenuItem
                  key={c.id}
                  onSelect={() => conv.loadConversation(c.id)}
                  className="flex flex-col items-start gap-0.5 py-2"
                >
                  <span className="text-sm font-medium leading-snug line-clamp-1 w-full">
                    {c.title || 'Untitled conversation'}
                  </span>
                  <span className="text-xs text-muted-foreground">
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPinned(!isPinned)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label={isPinned ? 'Unpin drawer' : 'Pin drawer'}
            title={isPinned ? 'Unpin drawer' : 'Pin drawer'}
          >
            {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={close}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </Button>
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
        <div className="px-3 py-3 border-t border-border bg-card flex-shrink-0">
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
    <div className="space-y-5">
      {/* One-time persona picker. Self-gating: returns null unless the
          user has no stated persona and hasn't dismissed the prompt. */}
      <RosaPersonaPrompt />

      {/* Proactive nudges — surfaces queue items, anomalies, deadlines
          Rosa thinks the user should see right now. Hidden when nothing
          urgent is open. */}
      <NudgeRail />

      <div className="rounded-[6px] bg-secondary border border-border p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-studio-forest" />
          Hi, I&apos;m Rosa
        </h3>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          I see what you&apos;re looking at and can help directly. Ask me about
          this page, drop a document, or pick a starter below.
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Try asking
        </p>
        <ul className="space-y-1">
          {QUICK_PROMPTS.map(p => (
            <li key={p.label}>
              <button
                onClick={() => onAsk(p.prompt)}
                className="group w-full text-left text-sm py-2 px-2 -mx-2 rounded-md hover:bg-muted transition-colors flex items-center justify-between gap-3"
              >
                <span className="leading-snug">{p.label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-studio-forest transition-colors flex-shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-dashed border-border p-3">
        <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
          <Upload className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          Tip: drop any utility bill, supplier doc, or sustainability report
          into the input below and I&apos;ll classify it and queue it for your
          sign-off.
        </p>
      </div>
    </div>
  )
}
