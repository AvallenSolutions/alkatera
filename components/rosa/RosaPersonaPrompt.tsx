'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Panel, Eyebrow } from '@/components/studio'
import { trackRosa } from '@/lib/rosa/track'
import type { RosaPersona } from '@/lib/rosa/useUserRole'

const STORAGE_KEY = 'rosa_persona_prompted_v1'

interface PersonaOption {
  value: Exclude<RosaPersona, 'unknown'>
  label: string
  description: string
}

/**
 * The same four choices the arrival ritual offers, worded as statements the
 * way that screen words them (components/onboarding/steps/ArrivalPersonaStep
 * .tsx). One question, one vocabulary, wherever it is asked.
 */
const OPTIONS: PersonaOption[] = [
  {
    value: 'operator',
    label: 'I run operations.',
    description: 'Day-to-day production, data and suppliers.',
  },
  {
    value: 'finance',
    label: 'I look after the numbers.',
    description: 'Cost, spend and reporting.',
  },
  {
    value: 'leadership',
    label: 'I lead the business.',
    description: 'The whole picture, and what to say about it.',
  },
  {
    value: 'sustainability',
    label: 'Sustainability is my job.',
    description: 'Footprints, targets and certifications.',
  },
]

interface Props {
  /** Called after a persona is saved so the parent can refresh useUserRole. */
  onSaved?: (value: PersonaOption['value']) => void
}

/**
 * One-time persona picker shown in the Rosa drawer's empty state.
 * Sets rosa_memory(scope='user', key='persona') so useUserRole returns the
 * stated value forever after, instead of falling back to org role.
 *
 * Self-gating on two signals (we ignore the proxied-from-org-role persona,
 * since that would silently skip the prompt for owners/admins who happen
 * to map to a default bucket without ever stating a preference):
 *   1. localStorage flag rosa_persona_prompted_v1 — user dismissed
 *   2. /api/rosa/memory?key=persona — they've already stated a persona
 *
 * Returns null until both signals resolve. Safe to mount unconditionally.
 */
export function RosaPersonaPrompt({ onSaved }: Props) {
  const [saving, setSaving] = useState<PersonaOption['value'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  const [hasStatedPersona, setHasStatedPersona] = useState<boolean | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setDismissed(localStorage.getItem(STORAGE_KEY) === 'true')
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/rosa/memory?key=persona', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : { entries: [] }))
      .then(json => {
        if (cancelled) return
        const entries = (json?.entries ?? []) as Array<{ key: string; scope: string }>
        setHasStatedPersona(entries.some(e => e.key === 'persona'))
      })
      .catch(() => {
        if (!cancelled) setHasStatedPersona(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handlePick = async (value: PersonaOption['value']) => {
    setSaving(value)
    setError(null)
    try {
      const res = await fetch('/api/rosa/memory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: 'persona', value, scope: 'user' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Save failed (${res.status})`)
      }
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, 'true')
      setDismissed(true)
      trackRosa('persona.set', { persona: value })
      onSaved?.(value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your choice')
      setSaving(null)
    }
  }

  const dismissWithoutChoosing = () => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, 'true')
    setDismissed(true)
  }

  // Hide while either gating signal is still resolving, after the user has
  // dismissed it, or once they've stated a persona.
  if (dismissed === null || hasStatedPersona === null) return null
  if (dismissed) return null
  if (hasStatedPersona) return null

  return (
    <Panel>
      <Eyebrow tone="dim">You</Eyebrow>
      <p className="mt-2 font-display text-base font-semibold tracking-[-0.01em] text-foreground">
        What do you do here?
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        One quick choice, so I show you the right things first. You can change it any time.
      </p>

      <div className="mt-4 space-y-2">
        {OPTIONS.map(({ value, label, description }) => (
          <button
            key={value}
            type="button"
            onClick={() => handlePick(value)}
            disabled={saving !== null}
            className={cn(
              'w-full rounded-[6px] border border-studio-hairline bg-studio-paper/60 p-3 text-left transition-colors duration-150 ease-studio',
              'hover:border-studio-ink/25 hover:bg-secondary',
              saving === value && 'border-studio-forest bg-secondary',
              'disabled:opacity-60',
            )}
          >
            <span className="block font-display text-sm font-semibold text-foreground">{label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-xs text-studio-stale">{error}</p>}

      {/* A quiet way past, in the studio's own words: no close glyph in the
          corner, which reads as dismissing an advert. */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={dismissWithoutChoosing}
          disabled={saving !== null}
          className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-studio-dim transition-colors duration-150 ease-studio hover:text-foreground"
        >
          I&apos;d rather not say
        </button>
      </div>
    </Panel>
  )
}
