'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import type { CriticalReviewType, DataQualityRequirements } from '@/lib/types/lca';

// ============================================================================
// TYPES
// ============================================================================

export interface WizardFormData {
  // Step 1: Goal & Purpose
  intendedApplication: string;
  reasonsForStudy: string;
  intendedAudience: string[];
  isComparativeAssertion: boolean;

  // Step 2: System Boundary
  functionalUnit: string;
  systemBoundary: string;

  // Step 3: Cut-off Criteria
  cutoffCriteria: string;
  assumptions: string[];

  // Step 4: Data Quality
  dataQuality: DataQualityRequirements;

  // Step 5: Interpretation (read-only, generated)
  hasInterpretation: boolean;
  interpretationId?: string;

  // Step 6: Critical Review
  criticalReviewType: CriticalReviewType;
  criticalReviewJustification: string;

  // Metadata
  referenceYear: number;
  dqiScore?: number;
}

export interface WizardProgress {
  currentStep: number;
  completedSteps: number[];
  lastSavedAt?: Date;
  estimatedTimeRemaining: number; // minutes
}

interface WizardContextValue {
  // State
  pcfId: string;
  formData: WizardFormData;
  progress: WizardProgress;
  loading: boolean;
  saving: boolean;
  error: string | null;

  // Actions
  setFormData: React.Dispatch<React.SetStateAction<WizardFormData>>;
  updateField: <K extends keyof WizardFormData>(
    field: K,
    value: WizardFormData[K]
  ) => void;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  markStepComplete: (step: number) => void;
  saveProgress: () => Promise<void>;
  finishWizard: () => Promise<void>;
  resetError: () => void;
}

const INITIAL_FORM_DATA: WizardFormData = {
  intendedApplication: '',
  reasonsForStudy: '',
  intendedAudience: [],
  isComparativeAssertion: false,
  functionalUnit: '',
  systemBoundary: 'Cradle-to-gate',
  cutoffCriteria: '',
  assumptions: [],
  dataQuality: {
    temporal_coverage: '',
    geographic_coverage: '',
    technological_coverage: '',
    precision: 'medium',
    completeness: 0,
  },
  hasInterpretation: false,
  criticalReviewType: 'none',
  criticalReviewJustification: '',
  referenceYear: new Date().getFullYear(),
};

const INITIAL_PROGRESS: WizardProgress = {
  currentStep: 1,
  completedSteps: [],
  estimatedTimeRemaining: 10,
};

// Time estimates per step (in minutes)
const STEP_TIME_ESTIMATES = [2, 2, 2, 1, 1, 1, 1];
const TOTAL_STEPS = 7;

// ============================================================================
// CONTEXT
// ============================================================================

const WizardContext = createContext<WizardContextValue | undefined>(undefined);

export function useWizardContext(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizardContext must be used within a WizardProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER
// ============================================================================

interface WizardProviderProps {
  pcfId: string;
  children: React.ReactNode;
  onComplete?: () => void;
}

export function WizardProvider({
  pcfId,
  children,
  onComplete,
}: WizardProviderProps) {
  const { toast } = useToast();

  // State
  const [formData, setFormData] = useState<WizardFormData>(INITIAL_FORM_DATA);
  const [progress, setProgress] = useState<WizardProgress>(INITIAL_PROGRESS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-save debounce ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');

  // ============================================================================
  // LOAD EXISTING DATA
  // ============================================================================

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch PCF data
        const { data: pcf, error: pcfError } = await supabase
          .from('product_carbon_footprints')
          .select(`
            intended_application,
            reasons_for_study,
            intended_audience,
            is_comparative_assertion,
            functional_unit,
            system_boundary,
            cutoff_criteria,
            assumptions_limitations,
            data_quality_requirements,
            critical_review_type,
            critical_review_justification,
            reference_year,
            dqi_score,
            wizard_progress,
            product_name
          `)
          .eq('id', pcfId)
          .single();

        if (pcfError) throw pcfError;

        if (pcf) {
          const productName = pcf.product_name || 'Product';

          // Update form data with smart defaults for empty fields
          setFormData({
            intendedApplication: pcf.intended_application || 'Product carbon footprint assessment to identify environmental hotspots and support sustainability reporting.',
            reasonsForStudy: pcf.reasons_for_study || 'To quantify the carbon footprint and environmental impact of this product in accordance with ISO 14044/14067.',
            intendedAudience: pcf.intended_audience?.length > 0 ? pcf.intended_audience : [],
            isComparativeAssertion: pcf.is_comparative_assertion || false,
            functionalUnit: pcf.functional_unit || `1 unit of ${productName}`,
            systemBoundary: pcf.system_boundary || 'Cradle-to-gate',
            cutoffCriteria: pcf.cutoff_criteria || 'Mass: <1% of total input mass. Energy: <1% of total energy input. Environmental significance: Any flow contributing >1% to any impact category is included regardless of mass/energy contribution.',
            assumptions: (pcf.assumptions_limitations || []).map((a: any) =>
              typeof a === 'string' ? a : a.text || ''
            ).filter(Boolean),
            dataQuality: {
              temporal_coverage: pcf.data_quality_requirements?.temporal_coverage || `${pcf.reference_year || new Date().getFullYear()}`,
              geographic_coverage: pcf.data_quality_requirements?.geographic_coverage || '',
              technological_coverage: pcf.data_quality_requirements?.technological_coverage || '',
              precision: pcf.data_quality_requirements?.precision || 'medium',
              completeness: pcf.data_quality_requirements?.completeness || 0,
            },
            hasInterpretation: false, // Will be updated below
            criticalReviewType: pcf.critical_review_type || 'none',
            criticalReviewJustification: pcf.critical_review_justification || '',
            referenceYear: pcf.reference_year || new Date().getFullYear(),
            dqiScore: pcf.dqi_score || 0,
          });

          // Restore wizard progress if saved
          if (pcf.wizard_progress) {
            setProgress({
              currentStep: pcf.wizard_progress.currentStep || 1,
              completedSteps: pcf.wizard_progress.completedSteps || [],
              lastSavedAt: pcf.wizard_progress.lastSavedAt
                ? new Date(pcf.wizard_progress.lastSavedAt)
                : undefined,
              estimatedTimeRemaining: calculateTimeRemaining(
                pcf.wizard_progress.completedSteps || []
              ),
            });
          }
        }

        // Check for interpretation
        const { data: interp } = await supabase
          .from('lca_interpretation_results')
          .select('id')
          .eq('product_carbon_footprint_id', pcfId)
          .maybeSingle();

        if (interp) {
          setFormData((prev) => ({
            ...prev,
            hasInterpretation: true,
            interpretationId: interp.id,
          }));
        }
      } catch (err: any) {
        console.error('[WizardContext] Load error:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [pcfId]);

  // ============================================================================
  // CALCULATE TIME REMAINING
  // ============================================================================

  function calculateTimeRemaining(completedSteps: number[]): number {
    let remaining = 0;
    for (let i = 0; i < TOTAL_STEPS; i++) {
      if (!completedSteps.includes(i + 1)) {
        remaining += STEP_TIME_ESTIMATES[i];
      }
    }
    return remaining;
  }

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const updateField = useCallback(
    <K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      // Trigger debounced auto-save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveProgressInternal();
      }, 2000); // 2 second debounce
    },
    [pcfId]
  );

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setProgress((prev) => ({ ...prev, currentStep: step }));
    }
  }, []);

  const nextStep = useCallback(() => {
    setProgress((prev) => {
      const newStep = Math.min(prev.currentStep + 1, TOTAL_STEPS);
      return { ...prev, currentStep: newStep };
    });
  }, []);

  const prevStep = useCallback(() => {
    setProgress((prev) => {
      const newStep = Math.max(prev.currentStep - 1, 1);
      return { ...prev, currentStep: newStep };
    });
  }, []);

  const markStepComplete = useCallback((step: number) => {
    setProgress((prev) => {
      const completedSteps = prev.completedSteps.includes(step)
        ? prev.completedSteps
        : [...prev.completedSteps, step];
      return {
        ...prev,
        completedSteps,
        estimatedTimeRemaining: calculateTimeRemaining(completedSteps),
      };
    });
  }, []);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  // ============================================================================
  // SAVE PROGRESS
  // ============================================================================

  const saveProgressInternal = useCallback(async () => {
    // Skip if data hasn't changed
    const currentData = JSON.stringify(formData);
    if (currentData === lastSavedDataRef.current) {
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('product_carbon_footprints')
        .update({
          intended_application: formData.intendedApplication || null,
          reasons_for_study: formData.reasonsForStudy || null,
          intended_audience: formData.intendedAudience.length > 0 ? formData.intendedAudience : null,
          is_comparative_assertion: formData.isComparativeAssertion,
          functional_unit: formData.functionalUnit || null,
          system_boundary: formData.systemBoundary || null,
          cutoff_criteria: formData.cutoffCriteria || null,
          assumptions_limitations: formData.assumptions.length > 0
            ? formData.assumptions.map((text) => ({ type: 'Assumption', text }))
            : null,
          data_quality_requirements: formData.dataQuality,
          critical_review_type: formData.criticalReviewType,
          critical_review_justification: formData.criticalReviewJustification || null,
          wizard_progress: {
            currentStep: progress.currentStep,
            completedSteps: progress.completedSteps,
            lastSavedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', pcfId);

      if (updateError) throw updateError;

      lastSavedDataRef.current = currentData;
      setProgress((prev) => ({
        ...prev,
        lastSavedAt: new Date(),
      }));
    } catch (err: any) {
      console.error('[WizardContext] Save error:', err);
      // Don't show error toast for auto-save failures (too noisy)
    } finally {
      setSaving(false);
    }
  }, [formData, progress, pcfId]);

  const saveProgress = useCallback(async () => {
    await saveProgressInternal();
    toast({
      title: 'Progress saved',
      description: 'Your changes have been saved.',
    });
  }, [saveProgressInternal, toast]);

  // ============================================================================
  // FINISH WIZARD
  // ============================================================================

  const finishWizard = useCallback(async () => {
    setSaving(true);

    try {
      // Save final state
      await saveProgressInternal();

      // Mark all steps as complete
      setProgress((prev) => ({
        ...prev,
        completedSteps: Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1),
        estimatedTimeRemaining: 0,
      }));

      toast({
        title: 'Compliance wizard complete!',
        description: 'All required ISO 14044 fields have been documented.',
      });

      // Call completion callback
      onComplete?.();
    } catch (err: any) {
      console.error('[WizardContext] Finish error:', err);
      setError(err.message || 'Failed to complete wizard');
      toast({
        title: 'Error',
        description: 'Failed to complete wizard. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [saveProgressInternal, onComplete, toast]);

  // ============================================================================
  // CLEANUP
  // ============================================================================

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: WizardContextValue = {
    pcfId,
    formData,
    progress,
    loading,
    saving,
    error,
    setFormData,
    updateField,
    goToStep,
    nextStep,
    prevStep,
    markStepComplete,
    saveProgress,
    finishWizard,
    resetError,
  };

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
}
