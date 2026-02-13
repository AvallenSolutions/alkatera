import { useState, useCallback, useEffect, useRef } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import { toast } from 'sonner';
import {
  EPRWizardState,
  EPRWizardStep,
  INITIAL_EPR_WIZARD_STATE,
  getNextEPRWizardStep,
  getPreviousEPRWizardStep,
  getEPRWizardStepConfig,
  getEPRWizardProgress,
} from '@/lib/epr/wizard-types';

interface UseEPRWizardResult {
  /** Current wizard state */
  state: EPRWizardState;
  /** Whether the wizard state is loading */
  loading: boolean;
  /** Progress percentage (0-100) */
  progress: number;
  /** Go to next step */
  nextStep: () => void;
  /** Go to previous step */
  previousStep: () => void;
  /** Go to a specific step */
  goToStep: (step: EPRWizardStep) => void;
  /** Mark the current step as completed and advance */
  completeStep: () => void;
  /** Skip the current step (if skippable) and advance */
  skipStep: () => void;
  /** Dismiss the wizard (saves progress) */
  dismissWizard: () => void;
  /** Complete the entire wizard */
  completeWizard: () => void;
  /** Reset the wizard to the beginning */
  resetWizard: () => void;
}

export function useEPRWizard(): UseEPRWizardResult {
  const { currentOrganization } = useOrganization();
  const [state, setState] = useState<EPRWizardState>(INITIAL_EPR_WIZARD_STATE);
  const [loading, setLoading] = useState(true);

  // Ref for current org ID to keep save stable
  const orgIdRef = useRef<string | null>(null);
  useEffect(() => {
    orgIdRef.current = currentOrganization?.id ?? null;
  }, [currentOrganization?.id]);

  // Save wizard state to the API
  const saveState = useCallback(async (newState: EPRWizardState) => {
    const orgId = orgIdRef.current;
    if (!orgId) return;

    try {
      await fetch('/api/epr/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          wizard_state: newState,
        }),
      });
    } catch (err) {
      console.error('Failed to save EPR wizard state:', err);
    }
  }, []);

  // Fetch wizard state from settings
  useEffect(() => {
    const orgId = currentOrganization?.id;
    if (!orgId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/epr/settings?organizationId=${orgId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.settings?.wizard_state) {
            setState(data.settings.wizard_state);
          }
        }
      } catch (err) {
        console.error('Failed to fetch EPR wizard state:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentOrganization?.id]);

  // Helper: update state and persist
  const updateState = useCallback(
    (updater: (prev: EPRWizardState) => EPRWizardState) => {
      setState((prev) => {
        const next = updater(prev);
        saveState(next);
        return next;
      });
    },
    [saveState]
  );

  const nextStep = useCallback(() => {
    updateState((prev) => {
      const next = getNextEPRWizardStep(prev.currentStep);
      if (!next) return prev;
      return { ...prev, currentStep: next };
    });
  }, [updateState]);

  const previousStep = useCallback(() => {
    updateState((prev) => {
      const prevStep = getPreviousEPRWizardStep(prev.currentStep);
      if (!prevStep) return prev;
      return { ...prev, currentStep: prevStep };
    });
  }, [updateState]);

  const goToStep = useCallback(
    (step: EPRWizardStep) => {
      updateState((prev) => ({ ...prev, currentStep: step }));
    },
    [updateState]
  );

  const completeStep = useCallback(() => {
    updateState((prev) => {
      const completedSteps = prev.completedSteps.includes(prev.currentStep)
        ? prev.completedSteps
        : [...prev.completedSteps, prev.currentStep];

      const next = getNextEPRWizardStep(prev.currentStep);

      // If this is the last step, mark as completed
      if (!next) {
        return {
          ...prev,
          completedSteps,
          completed: true,
          completedAt: new Date().toISOString(),
        };
      }

      return {
        ...prev,
        completedSteps,
        currentStep: next,
      };
    });
  }, [updateState]);

  const skipStep = useCallback(() => {
    updateState((prev) => {
      const config = getEPRWizardStepConfig(prev.currentStep);
      if (!config.skippable) return prev;
      const next = getNextEPRWizardStep(prev.currentStep);
      if (!next) return prev;
      return { ...prev, currentStep: next };
    });
  }, [updateState]);

  const dismissWizard = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      dismissed: true,
    }));
    toast.info('EPR wizard progress saved. You can resume anytime from the EPR Dashboard.');
  }, [updateState]);

  const completeWizard = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      completed: true,
      completedAt: new Date().toISOString(),
      completedSteps: prev.completedSteps.includes('export-complete')
        ? prev.completedSteps
        : [...prev.completedSteps, 'export-complete' as EPRWizardStep],
    }));
    toast.success('EPR setup complete! Your data is ready for submission.');
  }, [updateState]);

  const resetWizard = useCallback(() => {
    const fresh: EPRWizardState = {
      ...INITIAL_EPR_WIZARD_STATE,
      startedAt: new Date().toISOString(),
    };
    setState(fresh);
    saveState(fresh);
  }, [saveState]);

  const progress = getEPRWizardProgress(state.currentStep);

  return {
    state,
    loading,
    progress,
    nextStep,
    previousStep,
    goToStep,
    completeStep,
    skipStep,
    dismissWizard,
    completeWizard,
    resetWizard,
  };
}
