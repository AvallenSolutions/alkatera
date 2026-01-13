"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  validate?: () => boolean | Promise<boolean>;
  optional?: boolean;
}

interface WizardContainerProps {
  title: string;
  description?: string;
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onComplete: () => void | Promise<void>;
  onCancel?: () => void;
  persistKey?: string;
  showProgress?: boolean;
  allowSkip?: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'dialog' | 'inline';
  dialogOpen?: boolean;
  onDialogOpenChange?: (open: boolean) => void;
}

interface WizardStepProps {
  step: string;
  children: React.ReactNode;
  className?: string;
}

export function WizardStep({ children, className }: WizardStepProps) {
  return (
    <div className={cn('animate-in fade-in-0 slide-in-from-right-4 duration-300', className)}>
      {children}
    </div>
  );
}

export function WizardContainer({
  title,
  description,
  steps,
  currentStep,
  onStepChange,
  onComplete,
  onCancel,
  persistKey,
  showProgress = true,
  allowSkip = false,
  isLoading = false,
  children,
  className,
  variant = 'default',
  dialogOpen,
  onDialogOpenChange,
}: WizardContainerProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (persistKey) {
      const saved = localStorage.getItem(`wizard-${persistKey}-step`);
      if (saved) {
        const savedStep = parseInt(saved, 10);
        if (!isNaN(savedStep) && savedStep >= 0 && savedStep < steps.length) {
          onStepChange(savedStep);
        }
      }
    }
  }, [persistKey]);

  useEffect(() => {
    if (persistKey) {
      localStorage.setItem(`wizard-${persistKey}-step`, currentStep.toString());
    }
  }, [currentStep, persistKey]);

  const clearPersistence = useCallback(() => {
    if (persistKey) {
      localStorage.removeItem(`wizard-${persistKey}-step`);
    }
  }, [persistKey]);

  const handleNext = async () => {
    setValidationError(null);
    const currentStepConfig = steps[currentStep];

    if (currentStepConfig.validate) {
      try {
        const isValid = await currentStepConfig.validate();
        if (!isValid) {
          setValidationError('Please complete all required fields before continuing.');
          return;
        }
      } catch (error) {
        setValidationError('An error occurred during validation.');
        return;
      }
    }

    if (currentStep < steps.length - 1) {
      onStepChange(currentStep + 1);
    } else {
      await onComplete();
      clearPersistence();
    }
  };

  const handleBack = () => {
    setValidationError(null);
    if (currentStep > 0) {
      onStepChange(currentStep - 1);
    }
  };

  const handleCancel = () => {
    clearPersistence();
    onCancel?.();
  };

  const handleStepClick = (index: number) => {
    if (index < currentStep) {
      setValidationError(null);
      onStepChange(index);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  const wizardContent = (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {onCancel && (
            <Button variant="ghost" size="icon" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <WizardStepper
          steps={steps}
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />

        {showProgress && (
          <Progress value={progress} className="h-1 mt-4" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {validationError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{validationError}</span>
          </div>
        )}

        {React.Children.map(children, (child, index) => {
          if (React.isValidElement<WizardStepProps>(child)) {
            const stepId = child.props.step;
            const stepIndex = steps.findIndex(s => s.id === stepId);
            if (stepIndex === currentStep) {
              return child;
            }
          }
          return null;
        })}
      </div>

      <div className="flex-shrink-0 px-6 py-4 border-t bg-muted/30">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0 || isLoading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {allowSkip && !isLastStep && steps[currentStep]?.optional && (
              <Button
                variant="ghost"
                onClick={() => onStepChange(currentStep + 1)}
                disabled={isLoading}
              >
                Skip
              </Button>
            )}

            <Button
              onClick={handleNext}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Processing...
                </>
              ) : isLastStep ? (
                <>
                  Complete
                  <Check className="h-4 w-4 ml-1" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  if (variant === 'dialog') {
    return (
      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col">
          {wizardContent}
        </DialogContent>
      </Dialog>
    );
  }

  if (variant === 'inline') {
    return wizardContent;
  }

  return (
    <Card className="overflow-hidden">
      {wizardContent}
    </Card>
  );
}

interface WizardStepperProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

export function WizardStepper({
  steps,
  currentStep,
  onStepClick,
  className,
}: WizardStepperProps) {
  return (
    <div className={cn('flex items-center', className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isClickable = index < currentStep && onStepClick;
        const Icon = step.icon;

        return (
          <React.Fragment key={step.id}>
            <button
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
              className={cn(
                'flex items-center gap-2 group',
                isClickable && 'cursor-pointer hover:opacity-80',
                !isClickable && 'cursor-default'
              )}
            >
              <div className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                isCompleted && 'bg-primary text-primary-foreground',
                isCurrent && 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2',
                !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
              )}>
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : Icon ? (
                  <Icon className="h-4 w-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              <div className="hidden sm:block">
                <p className={cn(
                  'text-sm font-medium',
                  (isCompleted || isCurrent) ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {step.title}
                </p>
                {step.description && (
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>
                )}
              </div>
            </button>

            {index < steps.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-3',
                index < currentStep ? 'bg-primary' : 'bg-muted'
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

interface ReviewSummaryProps {
  sections: Array<{
    title: string;
    items: Array<{
      label: string;
      value: string | number;
      unit?: string;
    }>;
    onEdit?: () => void;
  }>;
  className?: string;
}

export function ReviewSummary({ sections, className }: ReviewSummaryProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="text-center pb-4 border-b">
        <h3 className="text-lg font-semibold">Review Your Data</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Please review the information below before submitting.
        </p>
      </div>

      {sections.map((section, sectionIndex) => (
        <Card key={sectionIndex} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">{section.title}</h4>
            {section.onEdit && (
              <Button variant="ghost" size="sm" onClick={section.onEdit}>
                Edit
              </Button>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-3">
            {section.items.map((item, itemIndex) => (
              <div key={itemIndex}>
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="text-sm font-medium">
                  {item.value}
                  {item.unit && <span className="text-muted-foreground ml-1">{item.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}
    </div>
  );
}
