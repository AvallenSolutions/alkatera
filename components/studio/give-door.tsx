'use client'

/**
 * The give door — Pillar 1 of the data-revolution plan ("the give
 * affordance everywhere", tasks/data-revolution-plan.md): giving alkatera
 * data must be one gesture from anywhere. A quiet studio panel offering the
 * same three doors wherever it is mounted — drop a file (the shared
 * UniversalDropzone classifier, one classifier for every channel), paste a
 * link (the website-import job FastTrackSetupStep already uses), or tell
 * Rosa — so no room is more than a glance from "just give it to us".
 *
 * "Drop a file." reuses UniversalDropzone's own trigger prop rather than
 * a separate global opener: there is no app-wide drag layer or open event
 * today (checked AppLayout and RosaContextProvider) — every existing
 * mount (SmartUploadButton, FastTrackSetupStep, RosaInputBar) owns its own
 * dialog the same way, so this door does too.
 */

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Panel } from './panel'
import { Eyebrow } from './eyebrow'
import { PillButton } from './pill-button'
import { Input } from '@/components/ui/input'
import { UniversalDropzone } from '@/components/layouts/UniversalDropzone'
import { useRosaContext } from '@/lib/rosa/RosaContextProvider'

const QUIET_LINK =
  'font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim underline-offset-2 hover:text-foreground hover:underline'

interface GiveDoorProps {
  /** One room-flavoured sentence about what lands here, e.g. "Bills and
   *  meter readings land here." Shown quietly beneath the standing line. */
  hint?: string
  className?: string
}

/**
 * Give us anything: the desk and every data-taking room mount this once.
 * Three quiet actions, one destination — the ingest pipeline every channel
 * already shares (lib/ingest/classify-document.ts).
 */
export function GiveDoor({ hint, className }: GiveDoorProps) {
  const { askRosa } = useRosaContext()
  const [linkOpen, setLinkOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [watching, setWatching] = useState(false)

  const submitLink = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/products/import-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.jobId) {
        throw new Error(body?.error || 'Could not read that link.')
      }
      setWatching(true)
      setUrl('')
    } catch (err: any) {
      toast.error(err.message || 'Could not read that link.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Panel className={className ?? 'mb-8'}>
      <Eyebrow tone="dim">Give us anything</Eyebrow>
      <p className="mt-2 font-display text-sm font-semibold text-foreground">
        Drop a document, paste a link, or tell Rosa. We will read it and file it.
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <UniversalDropzone
          trigger={
            <button type="button" className={QUIET_LINK}>
              Drop a file.
            </button>
          }
        />
        <button type="button" onClick={() => setLinkOpen((v) => !v)} className={QUIET_LINK}>
          Paste a link.
        </button>
        <button
          type="button"
          onClick={() => askRosa('I have some data to give you.')}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent underline-offset-2 hover:underline"
        >
          Tell Rosa.
        </button>
      </div>

      {linkOpen && (
        <form onSubmit={submitLink} className="mt-3 flex items-center gap-2">
          <Input
            type="url"
            inputMode="url"
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-8 max-w-xs text-sm"
            disabled={submitting}
          />
          <PillButton type="submit" size="sm" disabled={submitting || !url.trim()}>
            {submitting ? 'Reading…' : 'Go.'}
          </PillButton>
        </form>
      )}

      {watching ? (
        <p className="mt-2 text-xs text-muted-foreground">
          <Link href="/uploads/" className="underline-offset-2 hover:text-foreground hover:underline">
            Watching it in your uploads.
          </Link>
        </p>
      ) : null}
    </Panel>
  )
}
