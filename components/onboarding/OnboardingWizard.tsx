'use client'

import { useOnboarding, ONBOARDING_STEPS, PHASE_CONFIG, getStepConfig } from '@/lib/onboarding'
import type { OnboardingPhase } from '@/lib/onboarding'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Step components
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

const STEP_COMPONENTS: Record<string, React.ComponentType> = {
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
}

export function OnboardingWizard() {
  const { state, shouldShowOnboarding, isLoading, progress, dismissOnboarding } = useOnboarding()

  if (isLoading || !shouldShowOnboarding) {
    return null
  }

  const currentStepConfig = getStepConfig(state.currentStep)
  const CurrentStepComponent = STEP_COMPONENTS[state.currentStep]
  const currentPhase = currentStepConfig.phase
  const phaseConfig = PHASE_CONFIG[currentPhase]

  // Determine unique phases for the phase indicator
  const phases: OnboardingPhase[] = ['welcome', 'quick-wins', 'core-setup', 'first-insights', 'power-features']

  // Hide chrome on welcome screen for immersive feel
  const isWelcome = state.currentStep === 'welcome-screen'
  const isCompletion = state.currentStep === 'completion'

  return (
    <div className="fixed inset-0 z-[60] bg-background overflow-y-auto" role="dialog" aria-label="Onboarding wizard">
      {/* Top bar - hidden on welcome */}
      {!isWelcome && (
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
          <div className="max-w-2xl mx-auto">
            {/* Phase indicators */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1">
                {phases.map((phase) => {
                  const pConfig = PHASE_CONFIG[phase]
                  const isActive = phase === currentPhase
                  const phaseSteps = ONBOARDING_STEPS.filter(s => s.phase === phase)
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
                          ? 'text-muted-foreground/70'
                          : 'text-muted-foreground/40'
                      )}
                    >
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full',
                          isActive ? 'bg-[#ccff00]' : isPast || isComplete ? 'bg-muted-foreground/50' : 'bg-muted'
                        )}
                      />
                      <span className="hidden sm:inline">{pConfig.label}</span>
                    </div>
                  )
                })}
              </div>

              {/* Dismiss button */}
              {!isCompletion && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dismissOnboarding}
                  className="text-muted-foreground hover:text-foreground -mr-2"
                  aria-label="Skip onboarding"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Progress bar */}
            <Progress value={progress} indicatorColor="lime" className="h-1" />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">
                {currentStepConfig.title} &mdash; {phaseConfig.duration}
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
            className="text-muted-foreground hover:text-foreground"
            aria-label="Skip onboarding"
          >
            <X className="w-4 h-4 mr-1" />
            Skip
          </Button>
        </div>
      )}

      {/* Step content */}
      <div className="max-w-2xl mx-auto py-8 px-4">
        {CurrentStepComponent ? <CurrentStepComponent /> : null}
      </div>
    </div>
  )
}
