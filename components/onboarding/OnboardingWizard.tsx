'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { useOnboarding, ONBOARDING_STEPS, MEMBER_ONBOARDING_STEPS, FAST_TRACK_STEPS, FAST_TRACK_PHASES, PHASE_CONFIG, MEMBER_PHASES, getStepConfig } from '@/lib/onboarding'
import { trackOnboarding } from '@/lib/onboarding/telemetry'
import type { OnboardingPhase } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft, Check, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Step components — owner flow
import { WelcomeScreen } from './steps/WelcomeScreen'
import { MeetRosa } from './steps/MeetRosa'
import { PersonalizationStep } from './steps/PersonalizationStep'
import { CompanyBasics } from './steps/CompanyBasics'
import { RoadmapStep } from './steps/RoadmapStep'
import { PreviewDashboard } from './steps/PreviewDashboard'
import { FirstProductStep } from './steps/FirstProductStep'
import { FacilitiesSetup } from './steps/FacilitiesSetup'
import { CoreMetricsStep } from './steps/CoreMetricsStep'
import { DataEntryMethodStep } from './steps/DataEntryMethodStep'
import { FoundationComplete } from './steps/FoundationComplete'
import { FeatureShowcase } from './steps/FeatureShowcase'
import { InviteTeamStep } from './steps/InviteTeamStep'
import { CompletionStep } from './steps/CompletionStep'

// Step components — member flow
import { MemberWelcomeScreen } from './steps/MemberWelcomeScreen'
import { MemberOrgOverview } from './steps/MemberOrgOverview'
import { MemberPlatformTour } from './steps/MemberPlatformTour'
import { MemberCompletionStep } from './steps/MemberCompletionStep'

// Step components — fast track flow
import { FastTrackSetupStep } from './steps/FastTrackSetupStep'
import { FastTrackImportStep } from './steps/FastTrackImportStep'
import { FastTrackProductsStep } from './steps/FastTrackProductsStep'
import { FastTrackFacilityStep } from './steps/FastTrackFacilityStep'
import { FastTrackEstimateStep } from './steps/FastTrackEstimateStep'
import { FastTrackTargetStep } from './steps/FastTrackTargetStep'
import { FastTrackCompletionStep } from './steps/FastTrackCompletionStep'

const STEP_COMPONENTS: Record<string, React.ComponentType> = {
  // Owner steps
  'welcome-screen': WelcomeScreen,
  'meet-rosa': MeetRosa,
  'personalization': PersonalizationStep,
  'company-basics': CompanyBasics,
  'roadmap': RoadmapStep,
  'preview-dashboard': PreviewDashboard,
  'first-product': FirstProductStep,
  'facilities-setup': FacilitiesSetup,
  'core-metrics': CoreMetricsStep,
  'data-entry-method': DataEntryMethodStep,
  'foundation-complete': FoundationComplete,
  'feature-showcase': FeatureShowcase,
  'invite-team': InviteTeamStep,
  'completion': CompletionStep,
  // Member steps
  'member-welcome': MemberWelcomeScreen,
  'member-org-overview': MemberOrgOverview,
  'member-platform-tour': MemberPlatformTour,
  'member-completion': MemberCompletionStep,
  // Fast Track steps
  'fast-track-setup': FastTrackSetupStep,
  'fast-track-import': FastTrackImportStep,
  'fast-track-products': FastTrackProductsStep,
  'fast-track-facility': FastTrackFacilityStep,
  'fast-track-estimate': FastTrackEstimateStep,
  'fast-track-target': FastTrackTargetStep,
  'fast-track-completion': FastTrackCompletionStep,
}

const OWNER_PHASES: OnboardingPhase[] = ['welcome', 'quick-wins', 'core-setup', 'first-insights', 'power-features']

export function OnboardingWizard() {
  const {
    state, shouldShowOnboarding, isLoading, progress, dismissOnboarding, onboardingFlow,
    saveStatus, canGoBack, previousStep,
  } = useOnboarding()
  const { currentOrganization } = useOrganization()

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
    if (!shouldShowOnboarding) return
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
  }, [shouldShowOnboarding, dismissOnboarding])

  if (isLoading || !shouldShowOnboarding) {
    return null
  }

  const currentStepConfig = getStepConfig(state.currentStep)
  const CurrentStepComponent = STEP_COMPONENTS[state.currentStep]
  const currentPhase = currentStepConfig.phase
  const phaseConfig = PHASE_CONFIG[currentPhase]

  // Use flow-appropriate phases and steps for the top bar
  const isMemberFlow = onboardingFlow === 'member'
  const isFastTrack = onboardingFlow === 'fast_track'
  const phases = isMemberFlow ? MEMBER_PHASES : isFastTrack ? FAST_TRACK_PHASES : OWNER_PHASES
  const flowSteps = isMemberFlow ? MEMBER_ONBOARDING_STEPS : isFastTrack ? FAST_TRACK_STEPS : ONBOARDING_STEPS

  const isWelcome = state.currentStep === 'welcome-screen' || state.currentStep === 'member-welcome'
  const isCompletion = state.currentStep === 'completion' || state.currentStep === 'member-completion' || state.currentStep === 'fast-track-completion'

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" role="dialog" aria-label="Onboarding wizard">
      {/* Full-screen background image + dark overlay — fixed so they stay during scroll */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/images/starry-night-bg3.jpg"
          alt=""
          fill
          className="object-cover"
          priority
          quality={85}
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* Top bar - glassmorphic, hidden on welcome */}
      {!isWelcome && (
        <div className="sticky top-0 z-10 bg-black/40 backdrop-blur-md border-b border-white/10 px-4 py-3">
          <div className="max-w-2xl mx-auto">
            {/* Phase indicators */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1">
                {phases.map((phase) => {
                  const pConfig = PHASE_CONFIG[phase]
                  const isActive = phase === currentPhase
                  const phaseSteps = flowSteps.filter(s => s.phase === phase)
                  const isComplete = phaseSteps.every(s => state.completedSteps.includes(s.id))
                  const isPast = phases.indexOf(phase) < phases.indexOf(currentPhase)

                  return (
                    <div
                      key={phase}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all',
                        isActive
                          ? 'bg-[#ccff00]/10 text-[#ccff00] font-medium'
                          : isPast || isComplete
                          ? 'text-white/50'
                          : 'text-white/25'
                      )}
                    >
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full',
                          isActive ? 'bg-[#ccff00]' : isPast || isComplete ? 'bg-white/40' : 'bg-white/15'
                        )}
                      />
                      <span className="hidden sm:inline">{pConfig.label}</span>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center gap-1">
                {/* Saved indicator — surfaces the debounced persistence so
                    users know their progress is durable. Hidden on the
                    completion step where it'd be noise. */}
                {!isCompletion && (
                  <span
                    className={cn(
                      'hidden sm:inline-flex items-center gap-1 text-[11px] mr-1 transition-opacity',
                      saveStatus === 'idle' && 'opacity-0',
                      saveStatus !== 'idle' && 'opacity-100',
                      saveStatus === 'error' ? 'text-red-300' : 'text-white/40',
                    )}
                    aria-live="polite"
                  >
                    {saveStatus === 'saving' && (<><Loader2 className="w-3 h-3 animate-spin" />Saving…</>)}
                    {saveStatus === 'saved' && (<><Check className="w-3 h-3" />Saved</>)}
                    {saveStatus === 'error' && (<><AlertCircle className="w-3 h-3" />Couldn't save</>)}
                  </span>
                )}
                {!isCompletion && canGoBack && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={previousStep}
                    className="text-white/40 hover:text-white hover:bg-white/10"
                    aria-label="Go back to previous step"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                )}
                {!isCompletion && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={dismissOnboarding}
                    className="text-white/40 hover:text-white hover:bg-white/10 -mr-2"
                    aria-label="Skip onboarding"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <Progress value={progress} indicatorColor="lime" className="h-1 bg-white/10" />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-white/40">
                {currentStepConfig.title} &mdash; {isMemberFlow ? '~3 min' : phaseConfig.duration}
              </p>
              <p className="text-xs text-white/40">{progress}%</p>
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
            className="text-white/40 hover:text-white hover:bg-white/10"
            aria-label="Skip onboarding"
          >
            <X className="w-4 h-4 mr-1" />
            Skip
          </Button>
        </div>
      )}

      {/* Step content */}
      <div className="relative z-[1] max-w-2xl mx-auto py-8 px-4">
        {CurrentStepComponent ? <CurrentStepComponent /> : null}
      </div>
    </div>
  )
}
