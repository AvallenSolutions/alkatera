'use client'

/**
 * The give door — Pillar 1 of the data-revolution plan ("the give
 * affordance everywhere", tasks/data-revolution-plan.md): giving alkatera
 * data must be one gesture from anywhere. Three doors — drop a file (the
 * shared UniversalDropzone classifier, one classifier for every channel),
 * paste a link (the website-import job FastTrackSetupStep already uses),
 * or tell Rosa.
 *
 * It used to be a panel each room mounted for itself, which meant six
 * copies of the same offer taking up the top of six pages, and the offer
 * was still missing from every room that did not happen to mount it. It
 * lives in the ink band now (components/studio/give-door-band.tsx),
 * alongside Ask Rosa: one place, every surface, no page real estate. The
 * shared body below is what both wear.
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
 * The three doors themselves, without any surrounding chrome, so the band
 * affordance and the panel are the same offer rather than two that drift.
 * One destination — the ingest pipeline every channel already shares
 * (lib/ingest/classify-document.ts).
 */
export function GiveDoorActions({ hint }: { hint?: string }) {
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
    <>
      <p className="font-display text-sm font-semibold text-foreground">
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
    </>
  )
}

/**
 * The panel form, kept for any surface that genuinely wants the offer
 * inline rather than in the band. No room mounts it today — the band is
 * the one place — but the composition is here if a page earns it.
 */
export function GiveDoor({ hint, className }: GiveDoorProps) {
  return (
    <Panel className={className ?? 'mb-8'}>
      <Eyebrow tone="dim">Give us anything</Eyebrow>
      <div className="mt-2">
        <GiveDoorActions hint={hint} />
      </div>
    </Panel>
  )
}
