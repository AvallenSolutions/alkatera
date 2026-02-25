'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Check, Clock, AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useWizardContext, getStepIdsForBoundary } from './WizardContext';

// ============================================================================
// STEP CONFIGURATION
// ============================================================================

export interface WizardStep {
  id: string;
  number: number;
  title: string;
  shortTitle: string;
  description: string;
  estimatedMinutes: number;
}

/**
 * Base step definitions keyed by step ID.
 * Dynamic steps (use-phase, end-of-life) are included here and
 * filtered based on the system boundary.
 */
const STEP_DEFINITIONS: Record<string, Omit<WizardStep, 'number' | 'id'>> = {
  'guide': { title: 'LCA Guide', shortTitle: 'Guide', description: 'Learn about lifecycle assessment', estimatedMinutes: 3 },
  'materials': { title: 'Materials', shortTitle: 'Materials', description: 'Verify emission data for all materials', estimatedMinutes: 1 },
  'facilities': { title: 'Facilities', shortTitle: 'Facilities', description: 'Assign production volumes', estimatedMinutes: 1 },
  'boundary': { title: 'System Boundary', shortTitle: 'Boundary', description: 'Define scope before running calculation', estimatedMinutes: 2 },
  'distribution': { title: 'Distribution', shortTitle: 'Distribution', description: 'Configure outbound transport to point of sale', estimatedMinutes: 2 },
  'calculate': { title: 'Calculate', shortTitle: 'Calculate', description: 'Run the lifecycle assessment', estimatedMinutes: 2 },
  'goal': { title: 'Goal & Purpose', shortTitle: 'Goal', description: 'Define why this LCA is being conducted', estimatedMinutes: 2 },
  'use-phase': { title: 'Use Phase', shortTitle: 'Use', description: 'Configure consumer use parameters', estimatedMinutes: 2 },
  'end-of-life': { title: 'End of Life', shortTitle: 'End of Life', description: 'Set disposal pathway assumptions', estimatedMinutes: 2 },
  'cutoff': { title: 'Cut-off Criteria', shortTitle: 'Cut-off', description: 'Specify what is excluded and why', estimatedMinutes: 2 },
  'data-quality': { title: 'Data Quality', shortTitle: 'Quality', description: 'Assess the quality of your data sources', estimatedMinutes: 1 },
  'interpretation': { title: 'Interpretation', shortTitle: 'Analysis', description: 'Review analysis results and findings', estimatedMinutes: 1 },
  'review': { title: 'Critical Review', shortTitle: 'Review', description: 'Determine review requirements', estimatedMinutes: 1 },
  'summary': { title: 'Report', shortTitle: 'Report', description: 'Review compliance and generate PDF report', estimatedMinutes: 2 },
};

/**
 * Generate the ordered wizard steps for a given system boundary.
 * Use-phase and end-of-life steps are dynamically inserted.
 */
export function getWizardSteps(systemBoundary: string, showGuide: boolean = false): WizardStep[] {
  const stepIds = getStepIdsForBoundary(systemBoundary, showGuide);
  return stepIds.map((id, index) => ({
    id,
    number: index + 1,
    ...(STEP_DEFINITIONS[id] || { title: id, shortTitle: id, description: '', estimatedMinutes: 1 }),
  }));
}

// Keep a static export for backward compatibility (10-step gate)
export const WIZARD_STEPS = getWizardSteps('cradle-to-gate');

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
  const { progress, goToStep, formData, showGuide } = useWizardContext();

  // Dynamic steps based on boundary (includes guide step when shown)
  const steps = React.useMemo(
    () => getWizardSteps(formData.systemBoundary || 'cradle-to-gate', showGuide),
    [formData.systemBoundary, showGuide]
  );

  const getStepStatus = (stepNumber: number): 'completed' | 'current' | 'upcoming' => {
    if (progress.completedSteps.includes(stepNumber)) return 'completed';
    if (stepNumber === progress.currentStep) return 'current';
    return 'upcoming';
  };

  const currentStepInfo = steps.find((s) => s.number === progress.currentStep);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Progress bar with steps */}
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const status = getStepStatus(step.number);
            const indicator = (
              <StepIndicator
                step={step}
                status={status}
                onClick={() => {
                  if (status !== 'upcoming') {
                    goToStep(step.number);
                  }
                }}
              />
            );

            return (
              <React.Fragment key={step.id}>
                {status === 'upcoming' ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>{indicator}</div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      Complete Step {progress.currentStep} first
                    </TooltipContent>
                  </Tooltip>
                ) : status === 'completed' ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>{indicator}</div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      Jump to {step.title}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  indicator
                )}
                {index < steps.length - 1 && (
                  <ConnectorLine
                    completed={progress.completedSteps.includes(step.number)}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </TooltipProvider>

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
  const { progress, totalSteps } = useWizardContext();
  const completedCount = progress.completedSteps.length;
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
