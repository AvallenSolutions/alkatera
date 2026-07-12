'use client';

import React from 'react';
import { cn } from '@/lib/utils';
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
// QUIET MONO STEP RAIL
// ============================================================================

interface StepLabelProps {
  step: WizardStep;
  status: 'completed' | 'current' | 'upcoming';
  onClick?: () => void;
}

/**
 * One step as a quiet mono label. Current takes the room accent with an
 * underline; done steps dim; upcoming steps dimmer and disabled. No circles,
 * no connectors, no icons.
 */
function StepLabel({ step, status, onClick }: StepLabelProps) {
  const isClickable = status === 'completed' || status === 'current';

  return (
    <button
      onClick={onClick}
      disabled={!isClickable}
      className={cn(
        'shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-150 ease-studio',
        status === 'current' &&
          'text-room-accent underline decoration-room-accent decoration-2 underline-offset-4',
        status === 'completed' && 'text-studio-dim hover:text-foreground',
        status === 'upcoming' && 'cursor-default text-studio-dim/45',
      )}
    >
      {step.shortTitle}
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface WizardProgressProps {
  className?: string;
}

export function WizardProgress({ className }: WizardProgressProps) {
  const { progress, goToStep, formData, showGuide, totalSteps } = useWizardContext();

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
    <div className={cn('space-y-3', className)}>
      {/* The mono position line: STEP N OF M · NAME */}
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-room-accent">
        Step {progress.currentStep} of {totalSteps}
        {currentStepInfo ? <span className="text-studio-dim"> · {currentStepInfo.title}</span> : null}
      </div>

      {/* Quiet mono step rail: current accented + underlined, done dim, upcoming dimmer */}
      <TooltipProvider delayDuration={300}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {steps.map((step) => {
            const status = getStepStatus(step.number);
            const label = (
              <StepLabel
                step={step}
                status={status}
                onClick={() => {
                  if (status !== 'upcoming') {
                    goToStep(step.number);
                  }
                }}
              />
            );

            if (status === 'upcoming') {
              return (
                <Tooltip key={step.id}>
                  <TooltipTrigger asChild>
                    <span>{label}</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="font-mono text-[10px] uppercase tracking-[0.15em]">
                    Complete step {progress.currentStep} first
                  </TooltipContent>
                </Tooltip>
              );
            }

            if (status === 'completed') {
              return (
                <Tooltip key={step.id}>
                  <TooltipTrigger asChild>
                    <span>{label}</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="font-mono text-[10px] uppercase tracking-[0.15em]">
                    Jump to {step.title}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <React.Fragment key={step.id}>{label}</React.Fragment>;
          })}
        </div>
      </TooltipProvider>

      {/* Quiet supporting line for the current step */}
      {currentStepInfo?.description ? (
        <p className="text-sm text-studio-dim">{currentStepInfo.description}</p>
      ) : null}
    </div>
  );
}

// ============================================================================
// COMPACT PROGRESS (for mobile)
// ============================================================================

interface CompactProgressProps {
  className?: string;
}

export function CompactProgress({ className }: CompactProgressProps) {
  const { progress, totalSteps, formData, showGuide } = useWizardContext();
  const steps = React.useMemo(
    () => getWizardSteps(formData.systemBoundary || 'cradle-to-gate', showGuide),
    [formData.systemBoundary, showGuide]
  );
  const currentStepInfo = steps.find((s) => s.number === progress.currentStep);
  const completedCount = progress.completedSteps.length;
  const percentage = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-room-accent">
        Step {progress.currentStep} of {totalSteps}
        {currentStepInfo ? <span className="text-studio-dim"> · {currentStepInfo.title}</span> : null}
      </div>
      {/* One hairline progress line, no spinner, no percentage chrome */}
      <div className="h-px w-full bg-studio-hairline">
        <div
          className="h-px bg-room-accent transition-all duration-300 ease-studio"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
