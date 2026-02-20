'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ChevronLeft,
  ChevronRight,
  Save,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { WizardProvider, useWizardContext } from './WizardContext';
import { WizardProgress, CompactProgress, WIZARD_STEPS } from './WizardProgress';
import { WizardSidebar } from './WizardSidebar';

// Step components
import { MaterialValidationStep } from './steps/MaterialValidationStep';
import { FacilityAllocationStep } from './steps/FacilityAllocationStep';
import { CalculationStep } from './steps/CalculationStep';
import { GoalStep } from './steps/GoalStep';
import { BoundaryStep } from './steps/BoundaryStep';
import { CutoffStep } from './steps/CutoffStep';
import { DataQualityStep } from './steps/DataQualityStep';
import { InterpretationStep } from './steps/InterpretationStep';
import { ReviewStep } from './steps/ReviewStep';
import { SummaryStep } from './steps/SummaryStep';

// ============================================================================
// TYPES
// ============================================================================

interface EnhancedComplianceWizardProps {
  productId: string;
  pcfId?: string | null;
  onComplete?: () => void;
  onClose?: () => void;
}

// ============================================================================
// STEP RENDERER
// ============================================================================

function StepContent() {
  const { progress } = useWizardContext();

  switch (progress.currentStep) {
    case 1:
      return <MaterialValidationStep />;
    case 2:
      return <FacilityAllocationStep />;
    case 3:
      return <CalculationStep />;
    case 4:
      return <GoalStep />;
    case 5:
      return <BoundaryStep />;
    case 6:
      return <CutoffStep />;
    case 7:
      return <DataQualityStep />;
    case 8:
      return <InterpretationStep />;
    case 9:
      return <ReviewStep />;
    case 10:
      return <SummaryStep />;
    default:
      return <MaterialValidationStep />;
  }
}

// ============================================================================
// NAVIGATION FOOTER
// ============================================================================

function WizardFooter() {
  const {
    progress,
    saving,
    pcfId,
    preCalcState,
    prevStep,
    nextStep,
    markStepComplete,
    saveProgress,
    finishWizard,
  } = useWizardContext();

  const isFirstStep = progress.currentStep === 1;
  const isLastStep = progress.currentStep === WIZARD_STEPS.length;
  const currentStepCompleted = progress.completedSteps.includes(
    progress.currentStep
  );

  // Step 3 (Calculate) has its own button — hide Next
  if (progress.currentStep === 3) {
    return (
      <div className="flex items-center justify-between border-t bg-background px-6 py-4">
        <Button variant="outline" onClick={prevStep} disabled={saving}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div />
      </div>
    );
  }

  // Determine if Next should be disabled
  let nextDisabled = saving;
  if (progress.currentStep === 1) {
    // Step 1: Materials — can only proceed if all materials have data
    nextDisabled = saving || !preCalcState.canCalculate;
  } else if (progress.currentStep === 2) {
    // Step 2: Facilities — can proceed if no facilities or all have volumes
    const hasFacilitiesMissingVolumes =
      preCalcState.linkedFacilities.length > 0 &&
      preCalcState.facilityAllocations.some(
        (a) => !a.productionVolume || !a.facilityTotalProduction
      );
    nextDisabled = saving || hasFacilitiesMissingVolumes;
  }

  const handleNext = () => {
    markStepComplete(progress.currentStep);
    if (!isLastStep) {
      nextStep();
    }
  };

  const handleFinish = async () => {
    markStepComplete(progress.currentStep);
    await finishWizard();
  };

  return (
    <div className="flex items-center justify-between border-t bg-background px-6 py-4">
      {/* Left side: Back button */}
      <Button
        variant="outline"
        onClick={prevStep}
        disabled={isFirstStep || saving}
      >
        <ChevronLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      {/* Right side: Save + Next/Finish */}
      <div className="flex items-center gap-3">
        {/* Save button only visible when pcfId exists (post-calculation) */}
        {pcfId && (
          <Button
            variant="ghost"
            onClick={saveProgress}
            disabled={saving}
            className="text-muted-foreground"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Progress
          </Button>
        )}

        {isLastStep ? (
          <Button onClick={handleFinish} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Complete Wizard
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={nextDisabled}>
            {currentStepCompleted ? 'Next' : 'Mark Complete & Continue'}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

function ErrorDisplay() {
  const { error, resetError, loading } = useWizardContext();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading wizard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Wizard</AlertTitle>
        <AlertDescription className="mt-2">
          {error}
          <Button
            variant="outline"
            size="sm"
            onClick={resetError}
            className="ml-4"
          >
            Try Again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

// ============================================================================
// MAIN WIZARD LAYOUT
// ============================================================================

function WizardLayout({ onClose }: { onClose?: () => void }) {
  const { loading, error } = useWizardContext();

  if (loading || error) {
    return <ErrorDisplay />;
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header with progress */}
      <header className="border-b bg-background px-6 py-4">
        <div className="mx-auto max-w-6xl">
          {/* Desktop progress */}
          <div className="hidden lg:block">
            <WizardProgress />
          </div>
          {/* Mobile progress */}
          <div className="lg:hidden">
            <CompactProgress />
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main form area */}
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="p-6">
                  <StepContent />
                </CardContent>
              </Card>
            </div>

            {/* Sidebar with AI suggestions */}
            <div className="hidden lg:block">
              <WizardSidebar />
            </div>
          </div>
        </div>
      </div>

      {/* Footer with navigation */}
      <WizardFooter />
    </div>
  );
}

// ============================================================================
// EXPORTED COMPONENT
// ============================================================================

export function EnhancedComplianceWizard({
  productId,
  pcfId,
  onComplete,
  onClose,
}: EnhancedComplianceWizardProps) {
  return (
    <WizardProvider productId={productId} pcfId={pcfId} onComplete={onComplete}>
      <WizardLayout onClose={onClose} />
    </WizardProvider>
  );
}

// ============================================================================
// AI ASSISTANCE BADGE
// ============================================================================

export function AiAssistanceBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
      <Sparkles className="h-3 w-3" />
      <span>AI-Assisted</span>
    </div>
  );
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { WizardProvider, useWizardContext } from './WizardContext';
export { WizardProgress, CompactProgress, WIZARD_STEPS } from './WizardProgress';
export type { WizardFormData, WizardProgress as WizardProgressType } from './WizardContext';
