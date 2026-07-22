'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization } from '@/lib/organizationContext'
import { useEPRWizard } from '@/hooks/data/useEPRWizard'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { X, ArrowLeft, ArrowRight, SkipForward, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/studio/panel'
import { PillButton } from '@/components/studio/pill-button'
import { Statement } from '@/components/studio/statement'
import { RosaGuide } from '@/components/epr/wizard/RosaGuide'
import {
  EPR_WIZARD_STEPS,
  EPR_WIZARD_PHASE_CONFIG,
  EPR_WIZARD_PHASES,
  getEPRWizardStepConfig,
} from '@/lib/epr/wizard-types'

// Step components
import { WelcomeStep } from '@/components/epr/wizard/steps/WelcomeStep'
import { RegistrationStep } from '@/components/epr/wizard/steps/RegistrationStep'
import { CompanyDetailsStep } from '@/components/epr/wizard/steps/CompanyDetailsStep'
import { PackagingActivitiesStep } from '@/components/epr/wizard/steps/PackagingActivitiesStep'
import { ObligationStep } from '@/components/epr/wizard/steps/ObligationStep'
import { NationSplitStep } from '@/components/epr/wizard/steps/NationSplitStep'
import { AddressesStep } from '@/components/epr/wizard/steps/AddressesStep'
import { ContactsStep } from '@/components/epr/wizard/steps/ContactsStep'
import { BrandsStep } from '@/components/epr/wizard/steps/BrandsStep'
import { PartnersStep } from '@/components/epr/wizard/steps/PartnersStep'
import { DefaultsStep } from '@/components/epr/wizard/steps/DefaultsStep'
import { DataReviewStep } from '@/components/epr/wizard/steps/DataReviewStep'
import { ValidationStep } from '@/components/epr/wizard/steps/ValidationStep'
import { GenerateStep } from '@/components/epr/wizard/steps/GenerateStep'
import { ExportCompleteStep } from '@/components/epr/wizard/steps/ExportCompleteStep'

const STEP_COMPONENTS: Record<string, React.ComponentType<{ onComplete: () => void; onBack: () => void; onSkip?: () => void }>> = {
  'welcome': WelcomeStep,
  'registration': RegistrationStep,
  'company-details': CompanyDetailsStep,
  'packaging-activities': PackagingActivitiesStep,
  'obligation': ObligationStep,
  'nation-split': NationSplitStep,
  'addresses': AddressesStep,
  'contacts': ContactsStep,
  'brands': BrandsStep,
  'partners': PartnersStep,
  'defaults': DefaultsStep,
  'data-review': DataReviewStep,
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
      <Skeleton className="h-12 w-64 rounded-[6px]" />
      <Skeleton className="h-16 w-full rounded-[6px]" />
      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <Skeleton className="h-64 rounded-[6px] hidden lg:block" />
        <Skeleton className="h-96 rounded-[6px]" />
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
      {/* Statement header */}
      <div className="flex items-start justify-between gap-4">
        <Statement eyebrow="THE WIRING · EPR" headline="The setup wizard." />
        {!isLast && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
            aria-label="Exit wizard"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Phase stepper + progress */}
      <Panel className="p-4">
        <div className="max-w-3xl mx-auto">
          {/* Phase stepper */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {EPR_WIZARD_PHASES.map((phase, i) => {
              const pConfig = EPR_WIZARD_PHASE_CONFIG[phase]
              const isActive = phase === currentPhase
              const phaseSteps = EPR_WIZARD_STEPS.filter((s) => s.phase === phase)
              const isComplete = phaseSteps.every((s) => state.completedSteps.includes(s.id))
              const isPast = EPR_WIZARD_PHASES.indexOf(phase) < EPR_WIZARD_PHASES.indexOf(currentPhase)
              const isDone = isPast || isComplete

              return (
                <div key={phase} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono border',
                        isActive
                          ? 'bg-studio-ink border-studio-ink text-studio-cream'
                          : isDone
                          ? 'border-studio-ink/40 text-studio-ink'
                          : 'border-studio-hairline text-muted-foreground'
                      )}
                    >
                      {isDone && !isActive ? <Check className="w-3 h-3" /> : i + 1}
                    </span>
                    <span
                      className={cn(
                        'hidden sm:inline',
                        isActive ? 'text-foreground font-medium' : 'text-studio-dim'
                      )}
                    >
                      {pConfig.label}
                    </span>
                  </div>
                  {i < EPR_WIZARD_PHASES.length - 1 && (
                    <div className="w-6 h-px bg-studio-hairline" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Progress bar */}
          <Progress value={progress} indicatorClassName="bg-studio-ink" className="h-1 bg-muted" />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-muted-foreground">
              {currentStepConfig.title} · {phaseConfig.duration}
            </p>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
              Step {currentStepConfig.index + 1} of {EPR_WIZARD_STEPS.length}
            </p>
          </div>
        </div>
      </Panel>

      {/* Two-column layout: Rosa + Step content */}
      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Rosa panel — side on desktop, top on mobile */}
        <div className="lg:order-first order-first">
          <Panel flush>
            <RosaGuide step={state.currentStep} />
          </Panel>
        </div>

        {/* Step content */}
        <Panel className="p-6 min-h-[400px] flex flex-col">
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
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-studio-hairline">
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
                <PillButton variant="ink" onClick={completeStep}>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </PillButton>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
