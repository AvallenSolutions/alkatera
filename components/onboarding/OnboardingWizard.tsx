'use client'

import { useEffect, useRef } from 'react'
import { useOnboarding, ONBOARDING_STEPS, MEMBER_ONBOARDING_STEPS, FAST_TRACK_STEPS, ADVISOR_ONBOARDING_STEPS, ARRIVAL_STEPS, FAST_TRACK_PHASES, PHASE_CONFIG, MEMBER_PHASES, ADVISOR_PHASES, getStepConfig } from '@/lib/onboarding'
import { trackOnboarding } from '@/lib/onboarding/telemetry'
import type { OnboardingPhase } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WarmthMeter } from './WarmthMeter'

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

// Step components — advisor flow
import { AdvisorWelcomeScreen } from './steps/AdvisorWelcomeScreen'
import { AdvisorCapabilitiesStep } from './steps/AdvisorCapabilitiesStep'
import { AdvisorOrgOverview } from './steps/AdvisorOrgOverview'
import { AdvisorCompletionStep } from './steps/AdvisorCompletionStep'

// Step components — fast track flow
import { FastTrackSetupStep } from './steps/FastTrackSetupStep'
import { FastTrackRevealStep } from './steps/FastTrackRevealStep'
import { FastTrackImportStep } from './steps/FastTrackImportStep'
import { FastTrackProductsStep } from './steps/FastTrackProductsStep'
import { FastTrackFacilityStep } from './steps/FastTrackFacilityStep'
import { FastTrackEstimateStep } from './steps/FastTrackEstimateStep'
import { FastTrackTargetStep } from './steps/FastTrackTargetStep'
import { FastTrackCompletionStep } from './steps/FastTrackCompletionStep'

// Step components — arrival flow (the 6-screen studio-language ritual that
// is now the front door itself; confirm + reveal reuse the fast-track step
// components directly). ArrivalWelcomeStep is retired from the flow — the
// website question (ArrivalWebsiteStep) carries its one welcome sentence
// instead — but the file is kept for the compat step-id it might still be
// referenced from in old telemetry/analytics.
import { ArrivalWebsiteStep } from './steps/ArrivalWebsiteStep'
import { ArrivalPersonaStep } from './steps/ArrivalPersonaStep'
import { ArrivalFacilityStep } from './steps/ArrivalFacilityStep'
import { ArrivalEstimateStep } from './steps/ArrivalEstimateStep'
import { ArrivalPlanStep } from './steps/ArrivalPlanStep'

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
  // Advisor steps
  'advisor-welcome': AdvisorWelcomeScreen,
  'advisor-capabilities': AdvisorCapabilitiesStep,
  'advisor-org-overview': AdvisorOrgOverview,
  'advisor-completion': AdvisorCompletionStep,
  // Fast Track steps
  'fast-track-setup': FastTrackSetupStep,
  'fast-track-reveal': FastTrackRevealStep,
  'fast-track-import': FastTrackImportStep,
  'fast-track-products': FastTrackProductsStep,
  'fast-track-facility': FastTrackFacilityStep,
  'fast-track-estimate': FastTrackEstimateStep,
  'fast-track-target': FastTrackTargetStep,
  'fast-track-completion': FastTrackCompletionStep,
  // Arrival steps — confirm and reveal reuse the fast-track internals
  // directly rather than re-implementing the same data logic.
  'arrival-website': ArrivalWebsiteStep,
  'arrival-persona': ArrivalPersonaStep,
  'arrival-confirm': FastTrackSetupStep,
  'arrival-reveal': FastTrackRevealStep,
  'arrival-facility': ArrivalFacilityStep,
  'arrival-estimate': ArrivalEstimateStep,
  'arrival-plan': ArrivalPlanStep,
}

const OWNER_PHASES: OnboardingPhase[] = ['welcome', 'quick-wins', 'core-setup', 'first-insights', 'power-features']

export function OnboardingWizard() {
  const {
    state, shouldShowOnboarding, isLoading, progress, dismissOnboarding, onboardingFlow,
    saveStatus, canGoBack, previousStep,
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

  const currentStepConfig = getStepConfig(state.currentStep)
  const CurrentStepComponent = STEP_COMPONENTS[state.currentStep]
  const currentPhase = currentStepConfig.phase
  const phaseConfig = PHASE_CONFIG[currentPhase]

  // Use flow-appropriate phases and steps for the top bar
  const isMemberFlow = onboardingFlow === 'member'
  const isFastTrack = onboardingFlow === 'fast_track'
  const isAdvisorFlow = onboardingFlow === 'advisor'
  const isArrivalFlow = onboardingFlow === 'arrival'
  const phases = isMemberFlow ? MEMBER_PHASES : isFastTrack ? FAST_TRACK_PHASES : isAdvisorFlow ? ADVISOR_PHASES : OWNER_PHASES
  const flowSteps = isMemberFlow ? MEMBER_ONBOARDING_STEPS : isFastTrack ? FAST_TRACK_STEPS : isAdvisorFlow ? ADVISOR_ONBOARDING_STEPS : ONBOARDING_STEPS

  const isWelcome = state.currentStep === 'welcome-screen' || state.currentStep === 'member-welcome' || state.currentStep === 'advisor-welcome'
  const isCompletion = state.currentStep === 'completion' || state.currentStep === 'member-completion' || state.currentStep === 'fast-track-completion' || state.currentStep === 'advisor-completion'

  // The arrival ritual's quiet mono step counter (cream ground, no phase
  // bar, no chunky progress bar) now covers the member and advisor flows
  // too — all three are short, linear rituals rather than the owner's
  // multi-phase build-out, so they share the same quiet chrome.
  const isQuietFlow = isArrivalFlow || isMemberFlow || isAdvisorFlow
  const quietFlowSteps = isArrivalFlow ? ARRIVAL_STEPS : isMemberFlow ? MEMBER_ONBOARDING_STEPS : isAdvisorFlow ? ADVISOR_ONBOARDING_STEPS : []
  const quietStepNumber = isQuietFlow ? Math.max(0, quietFlowSteps.findIndex(s => s.id === state.currentStep)) + 1 : 0

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" role="dialog" aria-label="Onboarding wizard">
      {/* Full-screen ground, fixed so it stays during scroll. It is opaque
          on purpose: it does the scrim's job of screening the app behind
          the wizard. The quiet rituals (arrival, member, advisor) sit on
          the studio's own paper cream; the owner and fast-track flows
          keep the gallery-grey background. */}
      <div className={cn('fixed inset-0 z-0', isQuietFlow ? 'bg-studio-cream' : 'bg-background')} />

      {/* Top bar — the quiet flows get a mono step counter, no phase bar and
          no chunky progress bar; the owner/fast-track flows keep the phase
          chrome. */}
      {!isWelcome && isQuietFlow && (
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
      {!isWelcome && !isQuietFlow && (
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border px-4 py-3">
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
                        'flex items-center gap-1.5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] transition-all',
                        isActive
                          ? 'text-studio-forest font-bold'
                          : isPast || isComplete
                          ? 'text-muted-foreground'
                          : 'text-muted-foreground/50'
                      )}
                    >
                      <div
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          isActive ? 'bg-studio-forest' : isPast || isComplete ? 'bg-muted-foreground' : 'bg-border'
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
                      saveStatus === 'error' ? 'text-studio-stale' : 'text-muted-foreground',
                    )}
                    aria-live="polite"
                  >
                    {saveStatus === 'saving' && (<>Saving…</>)}
                    {saveStatus === 'saved' && (<><Check className="w-3 h-3" />Saved</>)}
                    {saveStatus === 'error' && (<><AlertCircle className="w-3 h-3" />Couldn't save</>)}
                  </span>
                )}
                {!isCompletion && canGoBack && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={previousStep}
                    className="text-muted-foreground hover:text-foreground hover:bg-secondary"
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
                    className="text-muted-foreground hover:text-foreground hover:bg-secondary -mr-2"
                    aria-label="Skip onboarding"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <Progress value={progress} indicatorClassName="bg-studio-forest" className="h-1 bg-secondary" />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">
                {currentStepConfig.title} &middot; {isAdvisorFlow ? '~1 min' : isMemberFlow ? '~3 min' : phaseConfig.duration}
              </p>
              <p className="text-xs text-muted-foreground">{progress}%</p>
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
            className={cn('text-muted-foreground hover:text-foreground', isQuietFlow ? 'hover:bg-studio-ink/5' : 'hover:bg-secondary')}
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
