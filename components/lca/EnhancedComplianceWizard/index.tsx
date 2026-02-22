'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';

// Step components
import { MaterialValidationStep } from './steps/MaterialValidationStep';
import { FacilityAllocationStep } from './steps/FacilityAllocationStep';
import { CalculationStep } from './steps/CalculationStep';
import { GoalStep } from './steps/GoalStep';
import { BoundaryStep } from './steps/BoundaryStep';
import { UsePhaseStep } from './steps/UsePhaseStep';
import { EndOfLifeStep } from './steps/EndOfLifeStep';
import { CutoffStep } from './steps/CutoffStep';
import { DataQualityStep } from './steps/DataQualityStep';
import { InterpretationStep } from './steps/InterpretationStep';
import { ReviewStep } from './steps/ReviewStep';
import { SummaryStep } from './steps/SummaryStep';
import { GuideStep } from './steps/GuideStep';

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

/**
 * Maps step IDs to React components.
 * This allows dynamic step insertion (use-phase, end-of-life)
 * without hardcoding step numbers.
 */
const STEP_COMPONENT_MAP: Record<string, React.ComponentType> = {
  'materials': MaterialValidationStep,
  'facilities': FacilityAllocationStep,
  'calculate': CalculationStep,
  'goal': GoalStep,
  'boundary': BoundaryStep,
  'use-phase': UsePhaseStep,
  'end-of-life': EndOfLifeStep,
  'cutoff': CutoffStep,
  'data-quality': DataQualityStep,
  'interpretation': InterpretationStep,
  'review': ReviewStep,
  'summary': SummaryStep,
};

/**
 * Context for guide step state — shared between StepContent and the outer wrapper.
 * This avoids prop-drilling through WizardLayout.
 */
const GuideStateContext = React.createContext<{
  skipGuide: boolean;
  onToggleSkip: (skip: boolean) => void;
}>({ skipGuide: false, onToggleSkip: () => {} });

function StepContent() {
  const { progress, getStepId } = useWizardContext();
  const guideState = React.useContext(GuideStateContext);
  const stepId = getStepId(progress.currentStep);

  // Guide step is special — it has props for the skip toggle
  if (stepId === 'guide') {
    return (
      <GuideStep
        skipGuide={guideState.skipGuide}
        onToggleSkip={guideState.onToggleSkip}
      />
    );
  }

  const Component = STEP_COMPONENT_MAP[stepId] || MaterialValidationStep;
  return <Component />;
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
    formData,
    totalSteps,
    getStepId,
    prevStep,
    nextStep,
    markStepComplete,
    saveProgress,
    finishWizard,
  } = useWizardContext();

  const isFirstStep = progress.currentStep === 1;
  const isLastStep = progress.currentStep === totalSteps;
  const currentStepCompleted = progress.completedSteps.includes(
    progress.currentStep
  );
  const currentStepId = getStepId(progress.currentStep);

  // Calculate step has its own button — hide Next
  if (currentStepId === 'calculate') {
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

  // Determine if Next should be disabled based on step ID
  let nextDisabled = saving;
  if (currentStepId === 'materials') {
    nextDisabled = saving || !preCalcState.canCalculate;
  } else if (currentStepId === 'facilities') {
    const hasFacilitiesMissingVolumes =
      preCalcState.linkedFacilities.length > 0 &&
      preCalcState.facilityAllocations.some(
        (a) => !a.productionVolume || !a.facilityTotalProduction
      );
    nextDisabled = saving || hasFacilitiesMissingVolumes;
  } else if (currentStepId === 'goal') {
    nextDisabled =
      saving ||
      !formData.intendedApplication.trim() ||
      !formData.reasonsForStudy.trim() ||
      formData.intendedAudience.length === 0;
  } else if (currentStepId === 'boundary') {
    nextDisabled =
      saving ||
      !formData.functionalUnit.trim() ||
      !formData.systemBoundary;
  } else if (currentStepId === 'cutoff') {
    nextDisabled =
      saving ||
      !formData.cutoffCriteria.trim() ||
      formData.assumptions.length === 0;
  } else if (currentStepId === 'data-quality') {
    nextDisabled =
      saving ||
      !formData.dataQuality.temporal_coverage.trim() ||
      !formData.dataQuality.geographic_coverage.trim() ||
      !formData.dataQuality.technological_coverage.trim();
  } else if (currentStepId === 'review') {
    nextDisabled = saving || !formData.criticalReviewType;
  } else if (currentStepId === 'end-of-life') {
    // Validate EoL pathway percentages sum to 100
    const eolConfig = formData.eolConfig;
    if (eolConfig?.pathways) {
      const hasInvalid = Object.values(eolConfig.pathways).some((p) => {
        const sum = p.recycling + p.landfill + p.incineration + p.composting;
        return Math.abs(sum - 100) > 1;
      });
      nextDisabled = saving || hasInvalid;
    }
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
  const [showGuide, setShowGuide] = useState(false);
  const [skipGuide, setSkipGuide] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Fetch user's guide preference on mount
  useEffect(() => {
    async function loadPreference() {
      try {
        const sb = getSupabaseBrowserClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) { setPrefsLoaded(true); return; }

        const { data: profile } = await sb
          .from('profiles')
          .select('ui_preferences')
          .eq('id', user.id)
          .maybeSingle();

        const prefs = profile?.ui_preferences as Record<string, unknown> | null;
        const shouldSkip = prefs?.skip_lca_guide === true;
        setSkipGuide(shouldSkip);
        setShowGuide(!shouldSkip);
      } catch {
        // On error, default to showing the guide
        setShowGuide(true);
      } finally {
        setPrefsLoaded(true);
      }
    }
    loadPreference();
  }, []);

  // Handle the "Don't show again" toggle
  const handleToggleSkip = useCallback(async (skip: boolean) => {
    setSkipGuide(skip);
    try {
      const sb = getSupabaseBrowserClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;

      // Read current preferences, merge, and update
      const { data: profile } = await sb
        .from('profiles')
        .select('ui_preferences')
        .eq('id', user.id)
        .maybeSingle();

      const currentPrefs = (profile?.ui_preferences as Record<string, unknown>) || {};
      await sb
        .from('profiles')
        .update({ ui_preferences: { ...currentPrefs, skip_lca_guide: skip } })
        .eq('id', user.id);
    } catch (err) {
      console.error('[LCAWizard] Failed to save guide preference:', err);
    }
  }, []);

  // Wait for preferences to load before rendering
  if (!prefsLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <GuideStateContext.Provider value={{ skipGuide, onToggleSkip: handleToggleSkip }}>
      <WizardProvider productId={productId} pcfId={pcfId} onComplete={onComplete} showGuide={showGuide}>
        <WizardLayout onClose={onClose} />
      </WizardProvider>
    </GuideStateContext.Provider>
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

export { WizardProvider, useWizardContext, getTotalSteps, getStepIdsForBoundary } from './WizardContext';
export { WizardProgress, CompactProgress, WIZARD_STEPS, getWizardSteps } from './WizardProgress';
export type { WizardFormData, WizardProgress as WizardProgressType } from './WizardContext';
