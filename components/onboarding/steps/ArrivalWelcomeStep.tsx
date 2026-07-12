'use client'

import { useOnboarding } from '@/lib/onboarding'
import { Eyebrow, PillButton } from '@/components/studio'
import { ArrowRight } from 'lucide-react'

/**
 * Screen 1 of 5 in the arrival ritual: one sentence on what alkatera does,
 * one button. No form fields, no chrome beyond the mark — the studio's
 * front door, not a government form.
 */
export function ArrivalWelcomeStep() {
  const { completeStep } = useOnboarding()

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 text-center animate-in fade-in duration-700">
      <div className="w-full max-w-lg space-y-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-studio-hairline bg-studio-cream">
          <span className="font-display text-lg font-bold text-studio-forest">a</span>
        </div>

        <div className="space-y-3">
          <Eyebrow tone="dim" className="justify-center flex">Welcome</Eyebrow>
          <h1 className="font-display text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1.05] tracking-[-0.03em] text-foreground">
            alka<strong>tera</strong> turns what your business already does into a real sustainability picture.
          </h1>
        </div>

        <PillButton onClick={completeStep} variant="ink" size="md" className="px-6">
          Let&apos;s begin
          <ArrowRight className="h-4 w-4" />
        </PillButton>
      </div>
    </div>
  )
}
