'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Check, Clock, AlertCircle } from 'lucide-react';
import { useWizardContext } from './WizardContext';

// ============================================================================
// STEP CONFIGURATION
// ============================================================================

export interface WizardStep {
  number: number;
  title: string;
  shortTitle: string;
  description: string;
  estimatedMinutes: number;
}

export const WIZARD_STEPS: WizardStep[] = [
  {
    number: 1,
    title: 'Goal & Purpose',
    shortTitle: 'Goal',
    description: 'Define why this LCA is being conducted',
    estimatedMinutes: 2,
  },
  {
    number: 2,
    title: 'System Boundary',
    shortTitle: 'Boundary',
    description: 'Define what is included in the assessment',
    estimatedMinutes: 2,
  },
  {
    number: 3,
    title: 'Cut-off Criteria',
    shortTitle: 'Cut-off',
    description: 'Specify what is excluded and why',
    estimatedMinutes: 2,
  },
  {
    number: 4,
    title: 'Data Quality',
    shortTitle: 'Quality',
    description: 'Assess the quality of your data sources',
    estimatedMinutes: 1,
  },
  {
    number: 5,
    title: 'Interpretation',
    shortTitle: 'Analysis',
    description: 'Review analysis results and findings',
    estimatedMinutes: 1,
  },
  {
    number: 6,
    title: 'Critical Review',
    shortTitle: 'Review',
    description: 'Determine review requirements',
    estimatedMinutes: 1,
  },
  {
    number: 7,
    title: 'Summary',
    shortTitle: 'Summary',
    description: 'Review and complete the wizard',
    estimatedMinutes: 1,
  },
];

// ============================================================================
// PROGRESS TIMER
// ============================================================================

interface ProgressTimerProps {
  estimatedMinutes: number;
}

function ProgressTimer({ estimatedMinutes }: ProgressTimerProps) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Clock className="h-4 w-4" />
      <span>
        ~{estimatedMinutes} {estimatedMinutes === 1 ? 'minute' : 'minutes'} remaining
      </span>
    </div>
  );
}

// ============================================================================
// STEP INDICATOR
// ============================================================================

interface StepIndicatorProps {
  step: WizardStep;
  status: 'completed' | 'current' | 'upcoming';
  onClick?: () => void;
}

function StepIndicator({ step, status, onClick }: StepIndicatorProps) {
  const isClickable = status === 'completed' || status === 'current';

  return (
    <button
      onClick={onClick}
      disabled={!isClickable}
      className={cn(
        'group flex flex-col items-center gap-1.5 transition-all',
        isClickable && 'cursor-pointer hover:opacity-80',
        !isClickable && 'cursor-default'
      )}
    >
      {/* Circle indicator */}
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
          status === 'completed' && 'border-primary bg-primary text-primary-foreground',
          status === 'current' && 'border-primary bg-background text-primary',
          status === 'upcoming' && 'border-muted-foreground/30 bg-muted text-muted-foreground'
        )}
      >
        {status === 'completed' ? (
          <Check className="h-5 w-5" />
        ) : (
          <span className="text-sm font-medium">{step.number}</span>
        )}
      </div>

      {/* Label */}
      <span
        className={cn(
          'text-xs font-medium transition-colors',
          status === 'current' && 'text-primary',
          status === 'completed' && 'text-foreground',
          status === 'upcoming' && 'text-muted-foreground'
        )}
      >
        {step.shortTitle}
      </span>
    </button>
  );
}

// ============================================================================
// CONNECTOR LINE
// ============================================================================

interface ConnectorLineProps {
  completed: boolean;
}

function ConnectorLine({ completed }: ConnectorLineProps) {
  return (
    <div className="flex-1 px-2">
      <div
        className={cn(
          'h-0.5 w-full transition-colors',
          completed ? 'bg-primary' : 'bg-muted-foreground/30'
        )}
      />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface WizardProgressProps {
  className?: string;
}

export function WizardProgress({ className }: WizardProgressProps) {
  const { progress, goToStep } = useWizardContext();

  const getStepStatus = (stepNumber: number): 'completed' | 'current' | 'upcoming' => {
    if (progress.completedSteps.includes(stepNumber)) return 'completed';
    if (stepNumber === progress.currentStep) return 'current';
    return 'upcoming';
  };

  const currentStepInfo = WIZARD_STEPS.find((s) => s.number === progress.currentStep);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Progress bar with steps */}
      <div className="flex items-center justify-between">
        {WIZARD_STEPS.map((step, index) => (
          <React.Fragment key={step.number}>
            <StepIndicator
              step={step}
              status={getStepStatus(step.number)}
              onClick={() => {
                // Only allow navigation to completed steps or current step
                if (getStepStatus(step.number) !== 'upcoming') {
                  goToStep(step.number);
                }
              }}
            />
            {index < WIZARD_STEPS.length - 1 && (
              <ConnectorLine
                completed={progress.completedSteps.includes(step.number)}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Current step info + time estimate */}
      <div className="flex items-center justify-between border-t pt-4">
        <div>
          <h2 className="text-lg font-semibold">
            Step {progress.currentStep}: {currentStepInfo?.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {currentStepInfo?.description}
          </p>
        </div>
        <ProgressTimer estimatedMinutes={progress.estimatedTimeRemaining} />
      </div>

      {/* Auto-save indicator */}
      <AutoSaveIndicator />
    </div>
  );
}

// ============================================================================
// AUTO-SAVE INDICATOR
// ============================================================================

function AutoSaveIndicator() {
  const { saving, progress, error } = useWizardContext();

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span>Error saving progress</span>
      </div>
    );
  }

  if (saving) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        <span>Saving...</span>
      </div>
    );
  }

  if (progress.lastSavedAt) {
    return (
      <div className="text-sm text-muted-foreground">
        Last saved: {formatTime(progress.lastSavedAt)}
      </div>
    );
  }

  return null;
}

function formatTime(date: Date): string {
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 10) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ============================================================================
// COMPACT PROGRESS (for mobile)
// ============================================================================

interface CompactProgressProps {
  className?: string;
}

export function CompactProgress({ className }: CompactProgressProps) {
  const { progress } = useWizardContext();
  const completedCount = progress.completedSteps.length;
  const totalSteps = WIZARD_STEPS.length;
  const percentage = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          Step {progress.currentStep} of {totalSteps}
        </span>
        <span className="text-muted-foreground">{percentage}% complete</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
