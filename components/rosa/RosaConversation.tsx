'use client'

import React, { Fragment, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Dog, RotateCcw, AlertTriangle, Download, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RosaTurn } from '@/lib/rosa/useRosaConversation'
import { RosaThinking, RosaStreamingCursor } from './RosaThinking'
import { ActionProposalCard } from '@/components/gaia/ActionProposalCard'

// Lazy-load the chart renderer (Recharts ~200KB) so the drawer's first
// open doesn't pull it in. Only fetched when Rosa actually returns a
// chart. SSR off because Recharts is browser-only.
const RosaChartRenderer = dynamic(
  () =>
    import('@/components/gaia/GaiaChartRenderer').then(m => ({
      default: m.RosaChartRenderer,
    })),
  { ssr: false },
)

interface Props {
  turns: RosaTurn[]
  isStreaming: boolean
  error: string | null
  onReset: () => void
}

/**
 * In-canvas Rosa conversation. Shares the same shell as the home cards:
 * same canvas width, same dark cards, same lime accents, same sticky
 * input bar at the bottom of the parent (RosaCanvas).
 *
 * No left sidebar. No welcome screen. No suggestion pills. No "Online"
 * badge. The user came here from the canvas; the input bar at the bottom
 * is the same input bar they were just typing into. The only header is a
 * tiny "New chat" affordance so they can clear the thread.
 */
export function RosaConversation({ turns, isStreaming, error, onReset }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Keep the scroll position pinned to the latest turn while Rosa is
  // streaming, so users see the answer being written. We scroll the
  // AppLayout's main element (the actual scroll container).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns.length, turns[turns.length - 1]?.content])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Dog className="h-6 w-6 text-studio-forest" />
          Conversation with Rosa
        </h1>
        {turns.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            New chat
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {turns.map((turn, i) => (
          <Turn key={turn.id} turn={turn} isLast={i === turns.length - 1} />
        ))}
        {error && (
          <div className="rounded-lg border border-studio-stale/30 bg-card p-3 flex items-start gap-2 text-sm text-studio-stale">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function Turn({ turn, isLast }: { turn: RosaTurn; isLast: boolean }) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-[6px] bg-secondary border border-border px-4 py-2.5">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{turn.content}</p>
        </div>
      </div>
    )
  }

  // Assistant turn. Feedback is only offerable once the turn's client-side
  // placeholder id (`asst-...`, set in useRosaConversation.ts) has been
  // swapped for the persisted gaia_messages id on the stream's "done"
  // event -- posting feedback needs a real message to attach to.
  const canGiveFeedback = !turn.streaming && !turn.errored && !turn.id.startsWith('asst-')

  return (
    <div className="group flex gap-3 items-start">
      <div className="flex-shrink-0 rounded-[6px] bg-secondary p-2 mt-0.5">
        <Dog className="h-5 w-5 text-studio-forest" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div
          className={cn(
            'rounded-[6px] border bg-card px-4 py-3',
            turn.errored ? 'border-studio-stale/40' : 'border-border',
          )}
        >
          {turn.content ? (
            <AssistantBody content={turn.content} streaming={turn.streaming} />
          ) : (
            <ThinkingDots />
          )}
        </div>

        {/* Inline chart attached to this turn (Phase B). */}
        {turn.chart && (
          <div className="rounded-[6px] border border-border bg-card/60 p-3">
            <RosaChartRenderer chartData={turn.chart} />
          </div>
        )}

        {/* Download / link chips Rosa attached (Phase B). */}
        {turn.attachments && turn.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {turn.attachments.map((a, i) => (
              <AttachmentChip key={`${a.url}-${i}`} attachment={a} />
            ))}
          </div>
        )}

        {/* Action proposals streamed alongside this turn (Phase B/C).
            Each is a propose-then-confirm card; user must click Confirm
            for the underlying write to fire. */}
        {turn.actionProposals && turn.actionProposals.length > 0 && (
          <div className="space-y-2">
            {turn.actionProposals.map(p => (
              <ActionProposalCard
                key={p.id}
                proposal={{
                  id: p.id,
                  tool_name: p.tool_name,
                  preview: p.preview,
                }}
              />
            ))}
          </div>
        )}

        {/* Per-message feedback (Pillar 4 step 1 "Capture"). Quiet by
            design: always visible on the last message so it's easy to
            find, otherwise only on hover so the thread doesn't turn into
            a wall of buttons. */}
        {canGiveFeedback && (
          <div
            className={cn(
              'pl-1 transition-opacity',
              isLast ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
            )}
          >
            <MessageFeedback messageId={turn.id} />
          </div>
        )}
      </div>
    </div>
  )
}

const FEEDBACK_OPTIONS: Array<{ verdict: 'helpful' | 'not_right' | 'too_vague'; label: string }> = [
  { verdict: 'helpful', label: 'Helpful.' },
  { verdict: 'not_right', label: 'Not right.' },
  { verdict: 'too_vague', label: 'Too vague.' },
]

/**
 * Three tiny mono verdicts under an assistant message. One tap stores it;
 * tapping a different option replaces it (POST /api/rosa/feedback upserts
 * on unique(message_id, user_id)). Fire-and-forget -- a dropped request
 * just costs one data point, never blocks the chat.
 */
function MessageFeedback({ messageId }: { messageId: string }) {
  const [verdict, setVerdict] = useState<string | null>(null)

  const choose = (next: 'helpful' | 'not_right' | 'too_vague') => {
    if (next === verdict) return
    setVerdict(next)
    fetch('/api/rosa/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: messageId, verdict: next }),
    }).catch(() => {
      // Best-effort. Losing an occasional feedback tap is fine.
    })
  }

  return (
    <div className="flex items-center gap-3">
      {FEEDBACK_OPTIONS.map(opt => (
        <button
          key={opt.verdict}
          type="button"
          onClick={() => choose(opt.verdict)}
          className={cn(
            'font-mono text-[10px] uppercase tracking-[0.15em] transition-colors',
            verdict === opt.verdict ? 'text-studio-forest' : 'text-studio-dim hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function AttachmentChip({
  attachment,
}: {
  attachment: NonNullable<RosaTurn['attachments']>[number]
}) {
  const expiresLabel = attachment.expires_at
    ? `expires ${new Date(attachment.expires_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })}`
    : null
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.filename}
      className="group inline-flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 hover:border-studio-forest/40 hover:bg-card transition-colors"
    >
      <Download className="h-4 w-4 text-studio-forest" />
      <div className="text-left">
        <p className="text-xs font-medium leading-tight">{attachment.label}</p>
        {expiresLabel && (
          <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1 mt-0.5">
            <Clock className="h-2.5 w-2.5" /> {expiresLabel}
          </p>
        )}
      </div>
    </a>
  )
}

/**
 * Light-touch markdown rendering for Rosa's responses. Handles:
 *  - Paragraphs (double newlines)
 *  - Bullet lists (lines starting with "- " or "* ")
 *  - Numbered lists (lines starting with "1. ")
 *  - Inline **bold** and *italic*
 *
 * Stays deliberately simple — no full Markdown parser, no HTML, no XSS
 * surface. If we need rich rendering (tables, headings, code blocks)
 * later, swap in `react-markdown` here.
 */
function AssistantBody({ content, streaming }: { content: string; streaming?: boolean }) {
  const blocks = parseBlocks(content)
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, i) => {
        if (block.kind === 'ul') {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          )
        }
        if (block.kind === 'ol') {
          return (
            <ol key={i} className="list-decimal pl-5 space-y-1">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ol>
          )
        }
        if (block.kind !== 'p') return null
        return (
          <p key={i}>
            {renderInline(block.text)}
            {streaming && i === blocks.length - 1 && <RosaStreamingCursor />}
          </p>
        )
      })}
    </div>
  )
}

type Block = { kind: 'p'; text: string } | { kind: 'ul' | 'ol'; items: string[] }

function parseBlocks(content: string): Block[] {
  const lines = content.split('\n')
  const blocks: Block[] = []
  let buffer: string[] = []
  let listKind: 'ul' | 'ol' | null = null
  let listItems: string[] = []

  const flushParagraph = () => {
    if (buffer.length) {
      blocks.push({ kind: 'p', text: buffer.join(' ') })
      buffer = []
    }
  }
  const flushList = () => {
    if (listItems.length && listKind) {
      blocks.push({ kind: listKind, items: listItems })
      listItems = []
      listKind = null
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }
    const ulMatch = line.match(/^[-*]\s+(.*)$/)
    const olMatch = line.match(/^\d+\.\s+(.*)$/)
    if (ulMatch) {
      flushParagraph()
      if (listKind && listKind !== 'ul') flushList()
      listKind = 'ul'
      listItems.push(ulMatch[1])
    } else if (olMatch) {
      flushParagraph()
      if (listKind && listKind !== 'ol') flushList()
      listKind = 'ol'
      listItems.push(olMatch[1])
    } else {
      flushList()
      buffer.push(line)
    }
  }
  flushParagraph()
  flushList()
  return blocks
}

/**
 * Inline tokenizer for Rosa's responses. Handles, in order of precedence:
 *
 *   1. Markdown images:  `![alt](https://…)` → <img>
 *   2. Markdown links:   `[text](https://…)` → <a target="_blank">
 *   3. Bare image URLs:  any URL ending in .jpg/.png/.gif/.webp/.svg, or
 *                        a supabase storage URL → <img>. This is what
 *                        makes "who is Rosa?" still show her photo when
 *                        Rosa pastes the URL inline.
 *   4. Bare URLs:        any other http(s) URL → <a target="_blank">
 *   5. **bold** / *italic*: typographic emphasis
 *
 * Order matters because patterns can overlap (a markdown image contains a
 * URL); we match the most specific patterns first using a single combined
 * regex with named alternation, and skip any matches inside an earlier
 * one's range.
 */
const IMAGE_URL_RE = /(https?:\/\/[^\s)]+?\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?[^\s)]*)?|https?:\/\/[^\s)]*supabase[^\s)]*\/storage\/[^\s)]+)/gi
const MD_IMAGE_RE = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g
// Markdown links — accept absolute (http/https) or relative (starting with /).
// Relative URLs are common when Rosa returns generated_export download paths.
const MD_LINK_RE = /(?<!!)\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g
const URL_RE = /https?:\/\/[^\s)]+/g
const BOLD_RE = /\*\*([^*]+)\*\*/g
const ITALIC_RE = /\*([^*]+)\*/g
// Brand auto-styling: any case-insensitive "alkatera" mention outside another
// matched token gets `tera` bolded so the brand reads correctly even when the
// AI emits plain lowercase text.
const BRAND_RE = /alkatera/gi

interface Token {
  start: number
  end: number
  node: React.ReactNode
}

function renderInline(text: string): React.ReactNode {
  const tokens: Token[] = []
  let key = 0

  const collect = (re: RegExp, makeNode: (m: RegExpExecArray) => React.ReactNode) => {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const start = m.index
      const end = m.index + m[0].length
      // Skip if any existing token already covers this range; first-match
      // (most specific) wins.
      if (tokens.some(t => start < t.end && end > t.start)) continue
      tokens.push({ start, end, node: makeNode(m) })
    }
  }

  collect(MD_IMAGE_RE, m => (
    <RosaImage key={key++} src={m[2]} alt={m[1] || 'Rosa image'} />
  ))
  collect(MD_LINK_RE, m => (
    <RosaLink key={key++} href={m[2]}>{m[1]}</RosaLink>
  ))
  collect(IMAGE_URL_RE, m => <RosaImage key={key++} src={m[0]} alt="Rosa image" />)
  collect(URL_RE, m => <RosaLink key={key++} href={m[0]}>{m[0]}</RosaLink>)
  collect(BOLD_RE, m => <strong key={key++}>{m[1]}</strong>)
  collect(ITALIC_RE, m => <em key={key++}>{m[1]}</em>)
  collect(BRAND_RE, m => {
    const matched = m[0]
    const head = matched.slice(0, 4)
    const tail = matched.slice(4)
    return (
      <Fragment key={key++}>
        {head}
        <strong>{tail}</strong>
      </Fragment>
    )
  })

  if (tokens.length === 0) return text

  tokens.sort((a, b) => a.start - b.start)

  const out: React.ReactNode[] = []
  let cursor = 0
  for (const t of tokens) {
    if (t.start > cursor) out.push(text.slice(cursor, t.start))
    out.push(t.node)
    cursor = t.end
  }
  if (cursor < text.length) out.push(text.slice(cursor))
  return out
}

function RosaImage({ src, alt }: { src: string; alt: string }) {
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="block my-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-72 rounded-lg border border-border shadow-sm hover:opacity-90 transition-opacity"
        onError={e => {
          // Fall back to showing the raw URL as a link when the image
          // fails to load (404, blocked content, etc.).
          const target = e.currentTarget
          target.style.display = 'none'
          const parent = target.parentElement
          if (parent && !parent.querySelector('.rosa-img-fallback')) {
            const link = document.createElement('span')
            link.textContent = src
            link.className = 'rosa-img-fallback text-studio-cobalt underline break-all'
            parent.appendChild(link)
          }
        }}
      />
    </a>
  )
}

function RosaLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-studio-forest hover:underline break-all"
    >
      {children}
    </a>
  )
}

function ThinkingDots() {
  return <RosaThinking size="small" label="Thinking…" className="py-1" />
}
