'use client'

import Image from 'next/image'
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
import { SupplierCompleteProfile } from './steps/SupplierCompleteProfile'
import { SupplierDataRequests } from './steps/SupplierDataRequests'
import { SupplierAddProduct } from './steps/SupplierAddProduct'
import { SupplierUploadEvidence } from './steps/SupplierUploadEvidence'
import { SupplierAllSet } from './steps/SupplierAllSet'

const STEP_COMPONENTS: Record<string, React.ComponentType> = {
  'supplier-welcome': SupplierWelcome,
  'supplier-how-it-works': SupplierHowItWorks,
  'supplier-complete-profile': SupplierCompleteProfile,
  'supplier-data-requests': SupplierDataRequests,
  'supplier-add-product': SupplierAddProduct,
  'supplier-upload-evidence': SupplierUploadEvidence,
  'supplier-all-set': SupplierAllSet,
}

export function SupplierOnboardingWizard() {
  const { state, shouldShowOnboarding, isLoading, progress, dismissOnboarding } = useSupplierOnboarding()

  if (isLoading || !shouldShowOnboarding) {
    return null
  }

  const currentStepConfig = getSupplierStepConfig(state.currentStep)
  const CurrentStepComponent = STEP_COMPONENTS[state.currentStep]
  const currentPhase = currentStepConfig.phase
  const phaseConfig = SUPPLIER_PHASE_CONFIG[currentPhase]

  const isWelcome = state.currentStep === 'supplier-welcome'
  const isCompletion = state.currentStep === 'supplier-all-set'

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" role="dialog" aria-label="Supplier onboarding wizard">
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

      {/* Top bar — glassmorphic, hidden on welcome */}
      {!isWelcome && (
        <div className="sticky top-0 z-10 bg-black/40 backdrop-blur-md border-b border-white/10 px-4 py-3">
          <div className="max-w-2xl mx-auto">
            {/* Phase indicators */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1">
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

            {/* Progress bar */}
            <Progress value={progress} indicatorColor="lime" className="h-1 bg-white/10" />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-white/40">
                {currentStepConfig.title} &mdash; {phaseConfig.duration}
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
