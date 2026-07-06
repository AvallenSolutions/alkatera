'use client'

import { usePathname } from 'next/navigation'
import {
  useSupplierOnboarding,
  SUPPLIER_ONBOARDING_STEPS,
  SUPPLIER_PHASE_CONFIG,
  SUPPLIER_PHASES,
  getSupplierStepConfig,
} from '@/lib/supplier-onboarding'
import type { SupplierOnboardingPhase } from '@/lib/supplier-onboarding'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Step components
import { SupplierWelcome } from './steps/SupplierWelcome'
import { SupplierHowItWorks } from './steps/SupplierHowItWorks'
import { SupplierCompanyIdentity } from './steps/SupplierCompanyIdentity'
import { SupplierCompanyDetails } from './steps/SupplierCompanyDetails'
import { SupplierDataRequests } from './steps/SupplierDataRequests'
import { SupplierAllSet } from './steps/SupplierAllSet'

const STEP_COMPONENTS: Record<string, React.ComponentType> = {
  'supplier-welcome': SupplierWelcome,
  'supplier-how-it-works': SupplierHowItWorks,
  'supplier-company-identity': SupplierCompanyIdentity,
  'supplier-company-details': SupplierCompanyDetails,
  'supplier-data-requests': SupplierDataRequests,
  'supplier-all-set': SupplierAllSet,
}

export function SupplierOnboardingWizard() {
  const { state, shouldShowOnboarding, isLoading, progress, dismissOnboarding } = useSupplierOnboarding()
  const pathname = usePathname()

  if (isLoading || !shouldShowOnboarding) {
    return null
  }

  // ESG survey invitees go straight to the survey — its "About your business" step
  // is their onboarding. Don't overlay the welcome wizard on that route (the survey
  // page also marks onboarding complete, so it won't reappear elsewhere).
  if (pathname?.startsWith('/supplier-portal/esg-assessment')) {
    return null
  }

  const currentStepConfig = getSupplierStepConfig(state.currentStep)
  const CurrentStepComponent = STEP_COMPONENTS[state.currentStep]
  const currentPhase = currentStepConfig.phase
  const phaseConfig = SUPPLIER_PHASE_CONFIG[currentPhase]

  const isWelcome = state.currentStep === 'supplier-welcome'
  const isCompletion = state.currentStep === 'supplier-all-set'

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background" role="dialog" aria-label="Supplier onboarding wizard">
      {/* Top bar — cream band on paper, hidden on welcome */}
      {!isWelcome && (
        <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
          <div className="max-w-2xl mx-auto">
            {/* Phase indicators */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                {SUPPLIER_PHASES.map((phase) => {
                  const pConfig = SUPPLIER_PHASE_CONFIG[phase]
                  const isActive = phase === currentPhase
                  const phaseSteps = SUPPLIER_ONBOARDING_STEPS.filter(s => s.phase === phase)
                  const isComplete = phaseSteps.every(s => state.completedSteps.includes(s.id))
                  const isPast = SUPPLIER_PHASES.indexOf(phase) < SUPPLIER_PHASES.indexOf(currentPhase as SupplierOnboardingPhase)

                  return (
                    <div
                      key={phase}
                      className={cn(
                        'flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition-colors',
                        isActive
                          ? 'text-studio-forest'
                          : isPast || isComplete
                          ? 'text-foreground/60'
                          : 'text-muted-foreground/60'
                      )}
                    >
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full',
                          isActive ? 'bg-studio-forest' : isPast || isComplete ? 'bg-foreground/40' : 'bg-border'
                        )}
                      />
                      <span className="hidden sm:inline">{pConfig.label}</span>
                    </div>
                  )
                })}
              </div>

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
            <Progress value={progress} indicatorClassName="bg-studio-forest" className="h-1 bg-secondary" />
            <div className="flex items-center justify-between mt-1">
              <p className="font-mono text-[10px] text-muted-foreground">
                {currentStepConfig.title}
              </p>
              <p className="font-mono text-[10px] tabular-nums text-muted-foreground">{progress}%</p>
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
      <div className="relative max-w-2xl mx-auto py-8 px-4">
        {CurrentStepComponent ? <CurrentStepComponent /> : null}
      </div>
    </div>
  )
}
