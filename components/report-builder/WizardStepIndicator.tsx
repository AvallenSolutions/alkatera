'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WizardStep, WIZARD_STEPS } from '@/types/report-builder';

interface WizardStepIndicatorProps {
  currentStep: WizardStep;
  onStepClick: (step: WizardStep) => void;
}

export function WizardStepIndicator({ currentStep, onStepClick }: WizardStepIndicatorProps) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-between mb-8">
      {WIZARD_STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = step.id === currentStep;

        return (
          <div key={step.id} className="flex items-center flex-1">
            <button
              onClick={() => onStepClick(step.id)}
              className={cn(
                'flex items-center gap-3 group cursor-pointer',
                !isCompleted && !isCurrent && 'opacity-50'
              )}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors',
                  isCompleted && 'bg-primary border-primary text-primary-foreground',
                  isCurrent && 'border-primary text-primary bg-primary/10',
                  !isCompleted && !isCurrent && 'border-muted-foreground/30 text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : index + 1}
              </div>
              <div className="hidden sm:block text-left">
                <p
                  className={cn(
                    'text-sm font-medium',
                    isCurrent && 'text-primary',
                    !isCurrent && !isCompleted && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </button>
            {index < WIZARD_STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-4',
                  index < currentIndex ? 'bg-primary' : 'bg-muted-foreground/20'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
