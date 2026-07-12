'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { PillButton } from '@/components/studio/pill-button';
import { StateChip } from '@/components/studio/state-chip';
import { PageLoader } from '@/components/ui/page-loader';
import { WizardProvider, useWizardContext } from './WizardContext';
import { WizardProgress, CompactProgress, WIZARD_STEPS } from './WizardProgress';
import { WizardSidebar, WizardStepHelpRosaBridge } from './WizardSidebar';
import { ApplyTemplateDialog } from './ApplyTemplateDialog';
import { SaveAsTemplateDialog } from './SaveAsTemplateDialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';

// Step components
import { MaterialValidationStep } from './steps/MaterialValidationStep';
import { FacilityAllocationStep } from './steps/FacilityAllocationStep';
import { CalculationStep } from './steps/CalculationStep';
import { GoalStep } from './steps/GoalStep';
import { BoundaryStep } from './steps/BoundaryStep';
import { UsePhaseStep } from './steps/UsePhaseStep';
import { DistributionStep } from './steps/DistributionStep';
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
  'distribution': DistributionStep,
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
      <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-studio-hairline bg-studio-paper px-6 py-4">
        <PillButton variant="outline" onClick={prevStep} disabled={saving}>
          <ChevronLeft className="h-4 w-4" />
          Back
        </PillButton>
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
  } else if (currentStepId === 'distribution') {
    // Require at least one valid leg with a transport mode and positive distance
    const distConfig = formData.distributionConfig;
    const hasValidLeg = distConfig?.legs?.some(
      (leg) => leg.transportMode && leg.distanceKm > 0
    );
    nextDisabled = saving || !hasValidLeg;
  } else if (currentStepId === 'end-of-life') {
    // Validate EoL pathway percentages sum to 100
    const eolConfig = formData.eolConfig;
    if (eolConfig?.pathways) {
      const hasInvalid = Object.values(eolConfig.pathways).some((p) => {
        const sum = p.recycling + p.landfill + p.incineration + p.composting + (p.anaerobic_digestion || 0);
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
    <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-studio-hairline bg-studio-paper px-6 py-4">
      {/* Left side: Back button */}
      <PillButton
        variant="outline"
        onClick={prevStep}
        disabled={isFirstStep || saving}
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </PillButton>

      {/* Centre: Save status indicator */}
      <div className="hidden items-center sm:flex">
        <FooterSaveStatus />
      </div>

      {/* Right side: Save + Next/Finish */}
      <div className="flex items-center gap-3">
        {/* Save button only visible when pcfId exists (post-calculation) */}
        {pcfId && (
          <PillButton
            variant="ghost"
            onClick={saveProgress}
            disabled={saving}
          >
            {saving ? 'SAVING' : 'Save progress'}
          </PillButton>
        )}

        {isLastStep ? null : (
          <PillButton variant="room" onClick={handleNext} disabled={nextDisabled}>
            {currentStepCompleted ? 'Next' : 'Mark complete & continue'}
            <ChevronRight className="h-4 w-4" />
          </PillButton>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// FOOTER SAVE STATUS
// ============================================================================

function FooterSaveStatus() {
  const { saving, progress, error, pcfId } = useWizardContext();

  if (!pcfId) return null;

  if (error) {
    return <StateChip tone="stale">Save failed</StateChip>;
  }

  if (saving) {
    return <StateChip tone="quiet">Saving</StateChip>;
  }

  if (progress.lastSavedAt) {
    return <StateChip tone="good">Saved</StateChip>;
  }

  return null;
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

function ErrorDisplay() {
  const { error, resetError, loading } = useWizardContext();

  if (loading) {
    return (
      <div className="px-6 py-10">
        <PageLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-stale">
          Could not load the wizard
        </div>
        <p className="text-sm text-foreground">{error}</p>
        <PillButton variant="outline" onClick={resetError}>
          Try again
        </PillButton>
      </div>
    );
  }

  return null;
}

// ============================================================================
// TEMPLATE PROMPT DIALOGS
// ============================================================================

/**
 * Mounts the two auto-opened template dialogs:
 *
 *  - ApplyTemplateDialog: opens on wizard load if the product has no prior
 *    last_wizard_settings, so the user can pick a template or skip before
 *    filling anything in. Shown as a radio list of org-scoped templates.
 *
 *  - SaveAsTemplateDialog: opens after a successful finishWizard(), so the
 *    user is prompted to save their now-complete Goal & Scope config as a
 *    reusable template. Intentionally only runs at the end of the flow —
 *    this avoids the "Save as template" button on the Goal step that could
 *    only capture partial data.
 *
 * Both dialogs are controlled by context state (showTemplatePicker /
 * showSaveTemplatePrompt) so any step or button can also open them.
 */
function TemplatePromptDialogs() {
  const {
    preCalcState,
    showTemplatePicker,
    dismissTemplatePicker,
    templatePickerAutoDismissOnEmpty,
    showSaveTemplatePrompt,
    dismissSaveTemplatePrompt,
  } = useWizardContext();

  const organizationId = preCalcState.product?.organization_id ?? null;

  return (
    <>
      <ApplyTemplateDialog
        open={showTemplatePicker}
        onOpenChange={(next) => {
          if (!next) dismissTemplatePicker();
        }}
        organizationId={organizationId}
        autoDismissOnEmpty={templatePickerAutoDismissOnEmpty}
      />
      <SaveAsTemplateDialog
        open={showSaveTemplatePrompt}
        onOpenChange={(next) => {
          if (!next) dismissSaveTemplatePrompt();
        }}
      />
    </>
  );
}

// ============================================================================
// MAIN WIZARD LAYOUT
// ============================================================================

function WizardLayout({ onClose }: { onClose?: () => void }) {
  const { loading, error, resumeAvailable, resumeStep, dismissResume, goToStep, getStepId, totalSteps } = useWizardContext();

  if (loading || error) {
    return <ErrorDisplay />;
  }

  const resumeStepId = getStepId(Math.min(resumeStep, totalSteps));
  const resumeStepTitle =
    WIZARD_STEPS.find((s) => s.id === resumeStepId)?.title || `Step ${resumeStep}`;

  return (
    <div className="flex h-full flex-col bg-studio-paper">
      {/* Hands the current step's tips + glossary to the ambient Rosa drawer.
          The wizard has ONE assistant; there is no second on-screen panel. */}
      <WizardStepHelpRosaBridge />

      {/* Resume notice: quiet mono, no decorated banner */}
      {resumeAvailable && (
        <div className="border-b border-studio-hairline bg-studio-paper px-6 py-3">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-studio-dim">
              <span className="mr-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-room-accent">
                Saved progress
              </span>
              Resume from step {resumeStep} ({resumeStepTitle})?
            </p>
            <div className="flex items-center gap-2">
              <PillButton variant="ghost" size="sm" onClick={dismissResume}>
                Start from beginning
              </PillButton>
              <PillButton
                variant="room"
                size="sm"
                onClick={() => {
                  goToStep(resumeStep);
                  dismissResume();
                }}
              >
                Resume
              </PillButton>
            </div>
          </div>
        </div>
      )}

      {/* Header with the quiet mono step rail */}
      <header className="border-b border-studio-hairline bg-studio-paper px-6 py-4">
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
            {/* Main form area, on a cream panel with a hairline */}
            <div className="lg:col-span-2">
              <div className="rounded-[6px] border border-studio-hairline bg-studio-cream p-6">
                <StepContent />
              </div>
            </div>

            {/* Quiet static HELP aside (not a second assistant) */}
            <div className="hidden lg:block">
              <WizardSidebar />
            </div>
          </div>
        </div>
      </div>

      {/* Footer with navigation */}
      <WizardFooter />

      {/* Auto-opened template prompts (pick on open, save on finish) */}
      <TemplatePromptDialogs />

      {/* Mobile help drawer */}
      <Drawer>
        <DrawerTrigger asChild>
          <button
            aria-label="Help"
            className="fixed bottom-20 right-4 z-20 inline-flex h-10 items-center gap-2 rounded-full border border-studio-ink/25 bg-studio-cream px-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground shadow-sm transition-colors duration-200 ease-studio hover:border-studio-ink/60 lg:hidden"
          >
            <HelpCircle className="h-4 w-4" />
            Help
          </button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>Help</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-auto px-4 pb-6">
            <WizardSidebar />
          </div>
        </DrawerContent>
      </Drawer>
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
      <div className="px-6 py-10">
        <PageLoader />
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
// ROSA ASSISTANCE BADGE
// ============================================================================

export function AiAssistanceBadge() {
  return (
    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent">
      Rosa-assisted
    </span>
  );
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { WizardProvider, useWizardContext, getTotalSteps, getStepIdsForBoundary } from './WizardContext';
export { WizardProgress, CompactProgress, WIZARD_STEPS, getWizardSteps } from './WizardProgress';
export type { WizardFormData, WizardProgress as WizardProgressType } from './WizardContext';
