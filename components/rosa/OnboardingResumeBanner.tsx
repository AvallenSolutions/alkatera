'use client'

import { useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { getStepsForFlow, type OnboardingStepConfig } from '@/lib/onboarding/types'
import { ArrowRight, X, Sparkles } from 'lucide-react'

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
      className="rounded-[6px] border border-border border-l-2 border-l-studio-forest bg-card px-4 py-3 sm:px-5 sm:py-4 mb-4 flex items-center justify-between gap-3"
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <Sparkles className="w-4 h-4 text-studio-forest shrink-0 mt-0.5 sm:mt-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            Finish setting up: step {stepNumber} of {total}.
          </p>
          <p className="text-xs text-muted-foreground truncate">
            Rosa has more for you once your starter data is in.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={resumeOnboarding}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background hover:bg-foreground/90 transition-colors duration-200 ease-studio"
        >
          Resume
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setHiddenForSession(true)}
          aria-label="Hide for this session"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
