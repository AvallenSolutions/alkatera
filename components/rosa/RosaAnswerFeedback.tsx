'use client'

import React, { useState } from 'react'
import { ThumbsUp, ThumbsDown, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  /** Persisted gaia_messages.id. The control does not render without one. */
  messageId: string
}

type Rating = 'positive' | 'negative'

/**
 * Thumbs up/down on one of Rosa's answers, with an optional note on what was
 * wrong.
 *
 * Feedback controls already existed in GaiaChat, but that component is only
 * mounted at /admin/rosa. Every real user talks to Rosa through this drawer,
 * which had no way to report a bad answer, so the one signal that could tell
 * us whether Rosa is any good was only ever collected from the admin page.
 *
 * Thumbs up submits immediately: making someone write a sentence to say "that
 * was right" is how you collect no positive signal at all. Thumbs down opens a
 * note box, because a negative rating with no reason cannot be acted on.
 */
export function RosaAnswerFeedback({ messageId }: Props) {
  const [rating, setRating] = useState<Rating | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [remember, setRemember] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)

  async function submit(value: Rating, text?: string, rememberIt?: boolean) {
    setSubmitting(true)
    setFailed(false)
    try {
      const res = await fetch('/api/rosa/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message_id: messageId,
          rating: value,
          feedback_text: text || undefined,
          remember: Boolean(rememberIt),
        }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setRating(value)
      setDone(true)
      setNoteOpen(false)
    } catch {
      // Never block the conversation on a failed rating. Surface it quietly
      // and let them try again.
      setFailed(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5 text-[#ccff00]" />
        {rating === 'positive' ? 'Thanks, noted.' : 'Thanks, that helps Rosa improve.'}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">Was this useful?</span>
        <button
          type="button"
          aria-label="This answer was useful"
          disabled={submitting}
          onClick={() => submit('positive')}
          className={cn(
            'rounded p-1 text-muted-foreground transition-colors',
            'hover:text-[#ccff00] hover:bg-white/5 disabled:opacity-50',
          )}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="This answer was not useful"
          disabled={submitting}
          onClick={() => setNoteOpen(v => !v)}
          className={cn(
            'rounded p-1 text-muted-foreground transition-colors',
            'hover:text-red-400 hover:bg-white/5 disabled:opacity-50',
            noteOpen && 'text-red-400 bg-white/5',
          )}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
        {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {failed && (
        <p className="text-xs text-red-300">That did not save. Try again in a moment.</p>
      )}

      {noteOpen && (
        <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <label htmlFor={`rosa-note-${messageId}`} className="text-xs text-muted-foreground">
            What was wrong?
          </label>
          <textarea
            id={`rosa-note-${messageId}`}
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="For example: we report to VSME, not CSRD."
            className="w-full rounded-md border border-white/10 bg-black/30 p-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-[#ccff00]/50"
          />
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              className="mt-0.5 accent-[#ccff00]"
            />
            <span>
              Remember this for my organisation, so Rosa applies it in future answers.
            </span>
          </label>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={submitting}
              onClick={() => submit('negative', note.trim(), remember)}
            >
              Send
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={submitting}
              onClick={() => setNoteOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
