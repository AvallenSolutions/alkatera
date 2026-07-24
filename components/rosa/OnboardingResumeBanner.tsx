'use client'

import { useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { getStepsForFlow, type OnboardingStepConfig } from '@/lib/onboarding/types'
import { ArrowRight, X } from 'lucide-react'

/**
 * Resumable banner shown on /rosa/ when the user dismissed onboarding without
 * completing it. One-click reopens the wizard at the step they were on.
 *
 * The banner can be dismissed for the current page-load (X button) but it
 * reappears on the next visit until onboarding is either completed or
 * permanently dismissed via the wizard chrome again.
 */
export function OnboardingResumeBanner() {
  const { state, isLoading, onboardingFlow, resumeOnboarding } = useOnboarding()
  const [hiddenForSession, setHiddenForSession] = useState(false)

  if (isLoading || hiddenForSession) return null
  if (state.completed || !state.dismissed) return null

  const steps = getStepsForFlow(onboardingFlow)

  const total = steps.length
  const currentIndex = Math.max(0, steps.findIndex((s: OnboardingStepConfig) => s.id === state.currentStep))
  // Show 1-based progress: "step 4 of 8".
  const stepNumber = currentIndex + 1

  return (
    <div
      role="region"
      aria-label="Resume onboarding"
      className="mb-4 flex items-center justify-between gap-3 rounded-[6px] border border-studio-hairline border-l-2 border-l-studio-forest bg-studio-cream px-4 py-3 sm:px-5 sm:py-4"
    >
      <div className="min-w-0">
        <p className="font-display text-sm font-semibold text-foreground">
          Finish setting up: step {stepNumber} of {total}.
        </p>
        <p className="truncate text-xs text-muted-foreground">
          Rosa has more for you once your starter data is in.
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={resumeOnboarding}
          className="inline-flex items-center gap-1.5 rounded-full bg-studio-ink px-3.5 py-1.5 text-xs font-medium text-studio-cream hover:bg-studio-ink/85 transition-colors duration-200 ease-studio"
        >
          Resume
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setHiddenForSession(true)}
          aria-label="Hide for this session"
          className="rounded-full p-1.5 text-studio-dim transition-colors duration-150 ease-studio hover:bg-studio-ink/5 hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
