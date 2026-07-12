'use client'

import { useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import type { PersonaChoice } from '@/lib/onboarding'
import { Eyebrow } from '@/components/studio'
import { cn } from '@/lib/utils'
import { RosaIntro } from './RosaIntro'

const PERSONA_OPTIONS: { value: PersonaChoice; label: string; description: string }[] = [
  { value: 'operator', label: 'I run operations.', description: 'Day-to-day production, data and suppliers.' },
  { value: 'finance', label: 'I look after the numbers.', description: 'Cost, spend and reporting.' },
  { value: 'leadership', label: 'I lead the business.', description: 'The whole picture, and what to say about it.' },
  { value: 'sustainability', label: 'Sustainability is my job.', description: 'Footprints, targets and certifications.' },
]

/**
 * Screen 2 of 5: "What do you do here?" Writes the choice into the same
 * rosa_memory 'persona' key that lib/rosa/useUserRole.ts already reads, so
 * the desk re-weights via deskOrderForPersona() the moment onboarding ends.
 * Skippable — a fresh owner who'd rather not say lands on the default
 * (unweighted) desk order.
 */
export function ArrivalPersonaStep() {
  const { completeStep, skipStep, updatePersonalization } = useOnboarding()
  const [saving, setSaving] = useState<PersonaChoice | null>(null)

  const choose = async (persona: PersonaChoice) => {
    if (saving) return
    setSaving(persona)
    updatePersonalization({ persona })
    try {
      await fetch('/api/rosa/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'persona', value: persona, scope: 'user' }),
      })
    } catch (err) {
      // Don't block the ritual on a memory write failure — the choice is
      // still saved in onboarding_state and can be retried later.
      console.error('[arrival-persona] failed to write persona memory:', err)
    } finally {
      completeStep()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        <RosaIntro message="One quick question so I show you the right things first. You can change this later." />

        <div className="text-center space-y-2">
          <Eyebrow tone="dim" className="justify-center flex">You</Eyebrow>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">What do you do here?</h2>
        </div>

        <div className="space-y-2">
          {PERSONA_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => choose(opt.value)}
              disabled={!!saving}
              className={cn(
                'w-full rounded-[6px] border border-studio-hairline bg-studio-cream p-4 text-left transition-colors',
                'hover:border-studio-ink/25 hover:bg-secondary',
                saving === opt.value && 'border-studio-forest bg-secondary',
              )}
            >
              <p className="font-display text-sm font-semibold text-foreground">{opt.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
            </button>
          ))}
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={skipStep}
            disabled={!!saving}
            className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-opacity duration-150 ease-studio hover:text-foreground"
          >
            I&apos;d rather not say
          </button>
        </div>
      </div>
    </div>
  )
}
