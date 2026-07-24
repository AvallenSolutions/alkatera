'use client'

import { useEffect, useRef } from 'react'
import { useOnboarding, MEMBER_ONBOARDING_STEPS, ADVISOR_ONBOARDING_STEPS, ARRIVAL_STEPS } from '@/lib/onboarding'
import { trackOnboarding } from '@/lib/onboarding/telemetry'
import { useOrganization } from '@/lib/organizationContext'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WarmthMeter } from './WarmthMeter'

// Step components — the legacy owner flow's 14 screens are gone; the member
// flow still opens with Rosa and the personalization step, so those two stay.
import { MeetRosa } from './steps/MeetRosa'
import { PersonalizationStep } from './steps/PersonalizationStep'

// Step components — member flow
import { MemberWelcomeScreen } from './steps/MemberWelcomeScreen'
import { MemberOrgOverview } from './steps/MemberOrgOverview'
import { MemberPlatformTour } from './steps/MemberPlatformTour'
import { MemberCompletionStep } from './steps/MemberCompletionStep'

// Step components — advisor flow
import { AdvisorWelcomeScreen } from './steps/AdvisorWelcomeScreen'
import { AdvisorCapabilitiesStep } from './steps/AdvisorCapabilitiesStep'
import { AdvisorOrgOverview } from './steps/AdvisorOrgOverview'
import { AdvisorCompletionStep } from './steps/AdvisorCompletionStep'

// Fast-track survivors — the arrival flow's confirm and reveal screens reuse
// these two step components directly (see STEP_COMPONENTS below); the rest of
// the 8-step fast-track flow is gone.
import { FastTrackSetupStep } from './steps/FastTrackSetupStep'
import { FastTrackRevealStep } from './steps/FastTrackRevealStep'

// Step components — arrival flow (the 6-screen studio-language ritual that
// is now the front door itself; confirm + reveal reuse the fast-track step
// components directly). ArrivalWelcomeStep is retired from the flow — the
// website question (ArrivalWebsiteStep) carries its one welcome sentence
// instead — but the file is kept for the compat step-id it might still be
// referenced from in old telemetry/analytics.
import { ArrivalWebsiteStep } from './steps/ArrivalWebsiteStep'
import { ArrivalPersonaStep } from './steps/ArrivalPersonaStep'
import { ArrivalFacilityStep } from './steps/ArrivalFacilityStep'
import { ArrivalModulesStep } from './steps/ArrivalModulesStep'
import { ArrivalEstimateStep } from './steps/ArrivalEstimateStep'
import { ArrivalPlanStep } from './steps/ArrivalPlanStep'

const STEP_COMPONENTS: Record<string, React.ComponentType> = {
  // Shared by the member flow's opening
  'meet-rosa': MeetRosa,
  'personalization': PersonalizationStep,
  // Member steps
  'member-welcome': MemberWelcomeScreen,
  'member-org-overview': MemberOrgOverview,
  'member-platform-tour': MemberPlatformTour,
  'member-completion': MemberCompletionStep,
  // Advisor steps
  'advisor-welcome': AdvisorWelcomeScreen,
  'advisor-capabilities': AdvisorCapabilitiesStep,
  'advisor-org-overview': AdvisorOrgOverview,
  'advisor-completion': AdvisorCompletionStep,
  // Arrival steps — confirm and reveal reuse the fast-track internals
  // directly rather than re-implementing the same data logic.
  'arrival-website': ArrivalWebsiteStep,
  'arrival-persona': ArrivalPersonaStep,
  'arrival-confirm': FastTrackSetupStep,
  'arrival-reveal': FastTrackRevealStep,
  'arrival-facility': ArrivalFacilityStep,
  'arrival-modules': ArrivalModulesStep,
  'arrival-estimate': ArrivalEstimateStep,
  'arrival-plan': ArrivalPlanStep,
}

export function OnboardingWizard() {
  const {
    state, shouldShowOnboarding, isLoading, dismissOnboarding, onboardingFlow,
    canGoBack, previousStep,
  } = useOnboarding()
  const { currentOrganization } = useOrganization()
  // Pre-org (arrival-website, before the org exists): there is nowhere to
  // dismiss TO — the wizard IS the front door. Suppress every dismiss
  // control while org-less rather than risk a blank page.
  const isPreOrg = !currentOrganization

  // Fire a 'view' telemetry event whenever the visible step changes. Tracked
  // via ref so we don't double-fire on the cosmetic re-renders that the
  // wizard does for things like progress updates.
  const lastViewedStepRef = useRef<string | null>(null)
  useEffect(() => {
    if (!shouldShowOnboarding || isLoading || !currentOrganization?.id) return
    if (lastViewedStepRef.current === state.currentStep) return
    lastViewedStepRef.current = state.currentStep
    trackOnboarding({
      organizationId: currentOrganization.id,
      flow: onboardingFlow,
      step: state.currentStep,
      event: 'view',
    })
  }, [shouldShowOnboarding, isLoading, currentOrganization?.id, state.currentStep, onboardingFlow])

  // a11y: keyboard dismiss via Escape. Matches what users expect from any
  // full-screen modal; previously they had to find the X button.
  useEffect(() => {
    if (!shouldShowOnboarding || isPreOrg) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Don't dismiss if an inner dialog (Radix Dialog) is open — its own
      // Escape handler should win. Detect by checking for an open dialog
      // anywhere in the DOM.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return
      dismissOnboarding()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shouldShowOnboarding, isPreOrg, dismissOnboarding])

  if (isLoading || !shouldShowOnboarding) {
    return null
  }

  const CurrentStepComponent = STEP_COMPONENTS[state.currentStep]

  // Every surviving flow (arrival, member, advisor — plus the legacy labels,
  // which the context retires as completed before this can render) uses the
  // quiet chrome: cream ground, mono step counter, no phase bar.
  const isMemberFlow = onboardingFlow === 'member'
  const isAdvisorFlow = onboardingFlow === 'advisor'
  const isArrivalFlow = !isMemberFlow && !isAdvisorFlow

  const isWelcome = state.currentStep === 'member-welcome' || state.currentStep === 'advisor-welcome'

  const quietFlowSteps = isMemberFlow ? MEMBER_ONBOARDING_STEPS : isAdvisorFlow ? ADVISOR_ONBOARDING_STEPS : ARRIVAL_STEPS
  const quietStepNumber = Math.max(0, quietFlowSteps.findIndex(s => s.id === state.currentStep)) + 1

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" role="dialog" aria-label="Onboarding wizard">
      {/* Full-screen ground, fixed so it stays during scroll. It is opaque
          on purpose: it does the scrim's job of screening the app behind
          the wizard. Every flow sits on the studio's own paper cream. */}
      <div className="fixed inset-0 z-0 bg-studio-cream" />

      {/* Top bar — the quiet mono step counter, no phase bar, no chunky
          progress bar. This is the only chrome any flow gets now. */}
      {!isWelcome && (
        <div className="sticky top-0 z-10 bg-studio-cream/95 backdrop-blur-sm border-b border-studio-hairline px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
              {quietStepNumber} of {quietFlowSteps.length}
            </span>
            <div className="flex items-center gap-1">
              {canGoBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={previousStep}
                  className="text-muted-foreground hover:text-foreground hover:bg-studio-ink/5"
                  aria-label="Go back to previous step"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              {!isPreOrg && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dismissOnboarding}
                  className="text-muted-foreground hover:text-foreground hover:bg-studio-ink/5 -mr-2"
                  aria-label="Skip onboarding"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Dismiss button on welcome screen */}
      {isWelcome && (
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={dismissOnboarding}
            className="text-muted-foreground hover:text-foreground hover:bg-studio-ink/5"
            aria-label="Skip onboarding"
          >
            <X className="w-4 h-4 mr-1" />
            Skip
          </Button>
        </div>
      )}

      {/* Step content */}
      <div className={cn('relative z-[1] max-w-2xl mx-auto py-8 px-4', isArrivalFlow && 'pb-28')}>
        {CurrentStepComponent ? <CurrentStepComponent /> : null}
      </div>

      {/* Warmth meter — the arrival ritual's honest progress spine, pinned at
          the foot of every screen. Only the arrival flow gets it. */}
      {isArrivalFlow && <WarmthMeter />}
    </div>
  )
}
