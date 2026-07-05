'use client'

import { useEffect, useState } from 'react'
import { Wrench, Calculator, Compass, Leaf, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackRosa } from '@/lib/rosa/track'
import type { RosaPersona } from '@/lib/rosa/useUserRole'

const STORAGE_KEY = 'rosa_persona_prompted_v1'

interface PersonaOption {
  value: Exclude<RosaPersona, 'unknown'>
  label: string
  description: string
  Icon: React.ComponentType<{ className?: string }>
}

const OPTIONS: PersonaOption[] = [
  {
    value: 'operator',
    label: 'Operator',
    description: 'You enter data, run the day-to-day, work with suppliers.',
    Icon: Wrench,
  },
  {
    value: 'finance',
    label: 'Finance',
    description: 'You think about cost, spend, and what this all means for the books.',
    Icon: Calculator,
  },
  {
    value: 'leadership',
    label: 'Leadership',
    description: 'Founder, GM, owner. You want the headline story and where to act.',
    Icon: Compass,
  },
  {
    value: 'sustainability',
    label: 'Sustainability lead',
    description: 'Methodology, frameworks, reporting, the technical detail.',
    Icon: Leaf,
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
    <div
      className={cn(
        'relative overflow-hidden rounded-[6px] border border-border bg-card p-5 sm:p-6',
      )}
    >
      <button
        onClick={dismissWithoutChoosing}
        aria-label="Skip for now"
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        disabled={saving !== null}
      >
        <X className="h-4 w-4" />
      </button>

      <div>
        <h3 className="text-base font-semibold">
          What&apos;s your day-to-day at alka<strong>tera</strong>?
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          One quick choice. I&apos;ll tailor what I show you and how I explain things. You can change this any time.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {OPTIONS.map(({ value, label, description, Icon }) => {
          const isSaving = saving === value
          return (
            <button
              key={value}
              onClick={() => handlePick(value)}
              disabled={saving !== null}
              className={cn(
                'group flex items-start gap-3 rounded-[6px] border border-border bg-background/40 p-3 text-left transition',
                'hover:border-studio-forest/40 hover:bg-secondary',
                'disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-background/40',
              )}
            >
              <span className="flex-shrink-0 rounded-lg bg-muted/40 p-2 text-foreground group-hover:text-studio-forest">
                {isSaving ? (
                  <Icon className="h-4 w-4 text-studio-forest" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {description}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <p className="mt-3 text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
