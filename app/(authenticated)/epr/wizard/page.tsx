'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization } from '@/lib/organizationContext'
import { useEPRWizard } from '@/hooks/data/useEPRWizard'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { X, ArrowLeft, ArrowRight, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RosaGuide } from '@/components/epr/wizard/RosaGuide'
import {
  EPR_WIZARD_STEPS,
  EPR_WIZARD_PHASE_CONFIG,
  EPR_WIZARD_PHASES,
  getEPRWizardStepConfig,
  type EPRWizardPhase,
} from '@/lib/epr/wizard-types'

// Step components
import { WelcomeStep } from '@/components/epr/wizard/steps/WelcomeStep'
import { RegistrationStep } from '@/components/epr/wizard/steps/RegistrationStep'
import { ObligationStep } from '@/components/epr/wizard/steps/ObligationStep'
import { NationSplitStep } from '@/components/epr/wizard/steps/NationSplitStep'
import { DefaultsStep } from '@/components/epr/wizard/steps/DefaultsStep'
import { DataReviewStep } from '@/components/epr/wizard/steps/DataReviewStep'
import { BulkEditStep } from '@/components/epr/wizard/steps/BulkEditStep'
import { ValidationStep } from '@/components/epr/wizard/steps/ValidationStep'
import { GenerateStep } from '@/components/epr/wizard/steps/GenerateStep'
import { ExportCompleteStep } from '@/components/epr/wizard/steps/ExportCompleteStep'

const STEP_COMPONENTS: Record<string, React.ComponentType<{ onComplete: () => void; onBack: () => void; onSkip?: () => void }>> = {
  'welcome': WelcomeStep,
  'registration': RegistrationStep,
  'obligation': ObligationStep,
  'nation-split': NationSplitStep,
  'defaults': DefaultsStep,
  'data-review': DataReviewStep,
  'bulk-edit': BulkEditStep,
  'validation': ValidationStep,
  'generate': GenerateStep,
  'export-complete': ExportCompleteStep,
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function WizardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <Skeleton className="h-64 rounded-xl hidden lg:block" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  )
}

// =============================================================================
// Main Wizard Page
// =============================================================================

export default function EPRWizardPage() {
  const { currentOrganization } = useOrganization()
  const router = useRouter()
  const {
    state,
    loading,
    progress,
    nextStep,
    previousStep,
    completeStep,
    skipStep,
    dismissWizard,
  } = useEPRWizard()

  // Mark wizard as started on first visit
  useEffect(() => {
    if (!loading && !state.startedAt) {
      // The first nextStep/completeStep call will trigger the startedAt
    }
  }, [loading, state.startedAt])

  if (!currentOrganization || loading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <WizardSkeleton />
      </div>
    )
  }

  const currentStepConfig = getEPRWizardStepConfig(state.currentStep)
  const CurrentStepComponent = STEP_COMPONENTS[state.currentStep]
  const currentPhase = currentStepConfig.phase
  const phaseConfig = EPR_WIZARD_PHASE_CONFIG[currentPhase]
  const isWelcome = state.currentStep === 'welcome'
  const isLast = state.currentStep === 'export-complete'

  const handleDismiss = () => {
    dismissWizard()
    router.push('/epr')
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top bar — phase indicators + progress */}
      <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-4">
        <div className="max-w-3xl mx-auto">
          {/* Phase indicators */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1 flex-wrap">
              {EPR_WIZARD_PHASES.map((phase) => {
                const pConfig = EPR_WIZARD_PHASE_CONFIG[phase]
                const isActive = phase === currentPhase
                const phaseSteps = EPR_WIZARD_STEPS.filter((s) => s.phase === phase)
                const isComplete = phaseSteps.every((s) => state.completedSteps.includes(s.id))
                const isPast = EPR_WIZARD_PHASES.indexOf(phase) < EPR_WIZARD_PHASES.indexOf(currentPhase)

                return (
                  <div
                    key={phase}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all',
                      isActive
                        ? 'bg-neon-lime/10 text-neon-lime font-medium'
                        : isPast || isComplete
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/60'
                    )}
                  >
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        isActive ? 'bg-neon-lime' : isPast || isComplete ? 'bg-muted-foreground/40' : 'bg-muted-foreground/20'
                      )}
                    />
                    <span className="hidden sm:inline">{pConfig.label}</span>
                  </div>
                )
              })}
            </div>

            {!isLast && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground hover:bg-muted -mr-1"
                aria-label="Exit wizard"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Progress bar */}
          <Progress value={progress} indicatorColor="lime" className="h-1 bg-muted" />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-muted-foreground">
              {currentStepConfig.title} &mdash; {phaseConfig.duration}
            </p>
            <p className="text-xs text-muted-foreground">
              Step {currentStepConfig.index + 1} of {EPR_WIZARD_STEPS.length}
            </p>
          </div>
        </div>
      </div>

      {/* Two-column layout: Rosa + Step content */}
      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Rosa panel — side on desktop, top on mobile */}
        <div className="lg:order-first order-first">
          <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl overflow-hidden">
            <RosaGuide step={state.currentStep} />
          </div>
        </div>

        {/* Step content */}
        <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6 min-h-[400px] flex flex-col">
          <div className="flex-1">
            {CurrentStepComponent ? (
              <CurrentStepComponent
                onComplete={completeStep}
                onBack={previousStep}
                onSkip={currentStepConfig.skippable ? skipStep : undefined}
              />
            ) : null}
          </div>

          {/* Navigation footer (hidden on welcome and export-complete — they have their own buttons) */}
          {!isWelcome && !isLast && (
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-border">
              <Button
                variant="ghost"
                onClick={previousStep}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                {currentStepConfig.skippable && (
                  <Button
                    variant="ghost"
                    onClick={skipStep}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted text-sm"
                  >
                    <SkipForward className="w-4 h-4 mr-1" />
                    Skip
                  </Button>
                )}
                <Button
                  onClick={completeStep}
                  className="bg-neon-lime text-black hover:bg-neon-lime/80 font-medium rounded-xl"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
