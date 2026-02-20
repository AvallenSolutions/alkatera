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
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import {
  validateMaterialsBeforeCalculation,
  type ProductMaterial,
} from '@/lib/impact-waterfall-resolver';
import type { CriticalReviewType, DataQualityRequirements } from '@/lib/types/lca';
import type {
  PreCalculationState,
  LinkedFacility,
  FacilityAllocation,
  ReportingSession,
  MaterialWithValidation,
} from './types';
import { INITIAL_PRE_CALC_STATE } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface WizardFormData {
  // Step 4: Goal & Purpose
  intendedApplication: string;
  reasonsForStudy: string;
  intendedAudience: string[];
  isComparativeAssertion: boolean;

  // Step 5: System Boundary
  functionalUnit: string;
  systemBoundary: string;

  // Step 6: Cut-off Criteria
  cutoffCriteria: string;
  assumptions: string[];

  // Step 7: Data Quality
  dataQuality: DataQualityRequirements;

  // Step 8: Interpretation (read-only, generated)
  hasInterpretation: boolean;
  interpretationId?: string;

  // Step 9: Critical Review
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
  // Identity
  productId: string;
  pcfId: string | null;

  // Pre-calculation state (steps 1-3)
  preCalcState: PreCalculationState;
  setPreCalcState: React.Dispatch<React.SetStateAction<PreCalculationState>>;
  onCalculationComplete: (newPcfId: string) => void;

  // Post-calculation state (steps 4-10)
  formData: WizardFormData;
  setFormData: React.Dispatch<React.SetStateAction<WizardFormData>>;
  updateField: <K extends keyof WizardFormData>(
    field: K,
    value: WizardFormData[K]
  ) => void;

  // Progress
  progress: WizardProgress;
  loading: boolean;
  saving: boolean;
  error: string | null;

  // Actions
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
  estimatedTimeRemaining: 12,
};

// Time estimates per step (in minutes) — 10 steps
const STEP_TIME_ESTIMATES = [1, 1, 2, 2, 2, 2, 1, 1, 1, 1];
const TOTAL_STEPS = 10;

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
  productId: string;
  pcfId?: string | null;
  children: React.ReactNode;
  onComplete?: () => void;
}

export function WizardProvider({
  productId,
  pcfId: initialPcfId,
  children,
  onComplete,
}: WizardProviderProps) {
  const { toast } = useToast();

  // State
  const [pcfId, setPcfId] = useState<string | null>(initialPcfId || null);
  const [formData, setFormData] = useState<WizardFormData>(INITIAL_FORM_DATA);
  const [progress, setProgress] = useState<WizardProgress>(INITIAL_PROGRESS);
  const [preCalcState, setPreCalcState] = useState<PreCalculationState>(
    INITIAL_PRE_CALC_STATE
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-save debounce ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');

  // ============================================================================
  // LOAD MATERIAL & FACILITY DATA (steps 1-3)
  // ============================================================================

  useEffect(() => {
    loadMaterialAndFacilityData();
  }, [productId]);

  async function loadMaterialAndFacilityData() {
    const sb = getSupabaseBrowserClient();

    try {
      setLoading(true);
      setError(null);

      // 1. Fetch product
      const { data: productData, error: productError } = await sb
        .from('products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();

      if (productError || !productData) {
        setError('Product not found');
        return;
      }

      setPreCalcState((prev) => ({ ...prev, product: productData }));

      // 2. Fetch materials
      const { data: materialsData, error: materialsError } = await sb
        .from('product_materials')
        .select('*')
        .eq('product_id', productId);

      if (materialsError) throw materialsError;

      if (!materialsData || materialsData.length === 0) {
        setError(
          'No materials found. Please add ingredients and packaging first.'
        );
        return;
      }

      // 3. Validate emission factors
      const validation = await validateMaterialsBeforeCalculation(
        materialsData as ProductMaterial[],
        productData.organization_id
      );

      const materialsWithStatus: MaterialWithValidation[] = materialsData.map(
        (mat) => {
          const validMaterial = validation.validMaterials.find(
            (v) => v.material.id === mat.id
          );
          const missingMaterial = validation.missingData.find(
            (m) => m.material.id === mat.id
          );

          if (validMaterial) {
            return {
              ...mat,
              hasData: true,
              dataQuality: validMaterial.resolved.data_quality_tag,
              confidenceScore: validMaterial.resolved.confidence_score,
            };
          } else if (missingMaterial) {
            return { ...mat, hasData: false, error: missingMaterial.error };
          }
          return { ...mat, hasData: false, error: 'Unknown validation error' };
        }
      );

      // 4. Fetch linked facilities
      const { data: facilitiesData } = await sb
        .from('facility_product_assignments')
        .select(
          'id, facility_id, facilities (id, name, operational_control, address_city, address_country)'
        )
        .eq('product_id', productId)
        .eq('assignment_status', 'active');

      let facilities: LinkedFacility[] = [];
      let allSessions: Record<string, ReportingSession[]> = {};
      let allocations: FacilityAllocation[] = [];

      if (facilitiesData) {
        facilities = facilitiesData.map((f: any) => ({
          id: f.id,
          facility_id: f.facility_id,
          facility: f.facilities,
        })) as LinkedFacility[];

        const facilityIds = facilities.map((f) => f.facility_id);
        const { data: sessions } = await sb
          .from('facility_reporting_sessions')
          .select(
            'id, facility_id, reporting_period_start, reporting_period_end, total_production_volume, volume_unit, data_source_type'
          )
          .in('facility_id', facilityIds)
          .order('reporting_period_end', { ascending: false });

        for (const session of sessions || []) {
          if (!allSessions[session.facility_id])
            allSessions[session.facility_id] = [];
          allSessions[session.facility_id].push(session);
        }

        const defaultEndDate = new Date().toISOString().split('T')[0];
        const defaultStartDate = new Date(
          new Date().setFullYear(new Date().getFullYear() - 1)
        )
          .toISOString()
          .split('T')[0];

        allocations = facilities.map((f) => {
          const facilitySessions = allSessions[f.facility_id] || [];
          const latestSession = facilitySessions[0];
          if (latestSession) {
            return {
              facilityId: f.facility_id,
              facilityName: f.facility.name,
              operationalControl: f.facility.operational_control,
              reportingPeriodStart: latestSession.reporting_period_start,
              reportingPeriodEnd: latestSession.reporting_period_end,
              productionVolume: '',
              productionVolumeUnit: latestSession.volume_unit || 'units',
              facilityTotalProduction: String(
                latestSession.total_production_volume
              ),
              selectedSessionId: latestSession.id,
            };
          }
          return {
            facilityId: f.facility_id,
            facilityName: f.facility.name,
            operationalControl: f.facility.operational_control,
            reportingPeriodStart: defaultStartDate,
            reportingPeriodEnd: defaultEndDate,
            productionVolume: '',
            productionVolumeUnit: 'units',
            facilityTotalProduction: '',
          };
        });
      }

      setPreCalcState((prev) => ({
        ...prev,
        materials: materialsWithStatus,
        canCalculate: validation.valid,
        missingCount: validation.missingData.length,
        linkedFacilities: facilities,
        facilityAllocations: allocations,
        reportingSessions: allSessions,
        materialDataLoaded: true,
        materialDataLoading: false,
      }));

      // 5. If PCF already exists, load it and mark steps 1-3 complete
      if (initialPcfId) {
        await loadPcfData(initialPcfId);
      }
    } catch (err: any) {
      console.error('[WizardContext] Load error:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  // ============================================================================
  // LOAD PCF DATA (steps 4-10)
  // ============================================================================

  async function loadPcfData(id: string) {
    try {
      const { data: pcf, error: pcfError } = await supabase
        .from('product_carbon_footprints')
        .select(
          `
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
        `
        )
        .eq('id', id)
        .single();

      if (pcfError) throw pcfError;

      if (pcf) {
        const productName = pcf.product_name || 'Product';

        setFormData({
          intendedApplication:
            pcf.intended_application ||
            'Product carbon footprint assessment to identify environmental hotspots and support sustainability reporting.',
          reasonsForStudy:
            pcf.reasons_for_study ||
            'To quantify the carbon footprint and environmental impact of this product in accordance with ISO 14044/14067.',
          intendedAudience:
            pcf.intended_audience?.length > 0
              ? pcf.intended_audience
              : [],
          isComparativeAssertion: pcf.is_comparative_assertion || false,
          functionalUnit:
            pcf.functional_unit || `1 unit of ${productName}`,
          systemBoundary: pcf.system_boundary || 'Cradle-to-gate',
          cutoffCriteria:
            pcf.cutoff_criteria ||
            'Mass: <1% of total input mass. Energy: <1% of total energy input. Environmental significance: Any flow contributing >1% to any impact category is included regardless of mass/energy contribution.',
          assumptions: (pcf.assumptions_limitations || [])
            .map((a: any) => (typeof a === 'string' ? a : a.text || ''))
            .filter(Boolean),
          dataQuality: {
            temporal_coverage:
              pcf.data_quality_requirements?.temporal_coverage ||
              `${pcf.reference_year || new Date().getFullYear()}`,
            geographic_coverage:
              pcf.data_quality_requirements?.geographic_coverage || '',
            technological_coverage:
              pcf.data_quality_requirements?.technological_coverage || '',
            precision:
              pcf.data_quality_requirements?.precision || 'medium',
            completeness:
              pcf.data_quality_requirements?.completeness || 0,
          },
          hasInterpretation: false,
          criticalReviewType: pcf.critical_review_type || 'none',
          criticalReviewJustification:
            pcf.critical_review_justification || '',
          referenceYear: pcf.reference_year || new Date().getFullYear(),
          dqiScore: pcf.dqi_score || 0,
        });

        // Restore wizard progress with remapping
        if (pcf.wizard_progress) {
          const savedStep = pcf.wizard_progress.currentStep || 1;
          const savedCompleted: number[] =
            pcf.wizard_progress.completedSteps || [];

          // Old format used 1-7 for ISO steps; remap to 4-10
          const remappedStep = savedStep + 3;
          const remappedCompleted = [
            1,
            2,
            3,
            ...savedCompleted.map((s: number) => s + 3),
          ];

          setProgress({
            currentStep: Math.min(remappedStep, TOTAL_STEPS),
            completedSteps: remappedCompleted,
            lastSavedAt: pcf.wizard_progress.lastSavedAt
              ? new Date(pcf.wizard_progress.lastSavedAt)
              : undefined,
            estimatedTimeRemaining: calculateTimeRemaining(remappedCompleted),
          });
        } else {
          // PCF exists but no wizard progress — start at step 4
          setProgress({
            currentStep: 4,
            completedSteps: [1, 2, 3],
            estimatedTimeRemaining: calculateTimeRemaining([1, 2, 3]),
          });
        }
      }

      // Check for interpretation
      const { data: interp } = await supabase
        .from('lca_interpretation_results')
        .select('id')
        .eq('product_carbon_footprint_id', id)
        .maybeSingle();

      if (interp) {
        setFormData((prev) => ({
          ...prev,
          hasInterpretation: true,
          interpretationId: interp.id,
        }));
      }
    } catch (err: any) {
      console.error('[WizardContext] PCF load error:', err);
      setError(err.message || 'Failed to load PCF data');
    }
  }

  // ============================================================================
  // ON CALCULATION COMPLETE
  // ============================================================================

  const onCalculationComplete = useCallback(
    async (newPcfId: string) => {
      setPcfId(newPcfId);

      // Mark steps 1-3 complete, advance to step 4
      setProgress((prev) => ({
        ...prev,
        currentStep: 4,
        completedSteps: Array.from(
          new Set([...prev.completedSteps, 1, 2, 3])
        ),
        estimatedTimeRemaining: calculateTimeRemaining([
          ...prev.completedSteps,
          1,
          2,
          3,
        ]),
      }));

      // Load PCF data for steps 4-10
      await loadPcfData(newPcfId);
    },
    []
  );

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

      // Trigger debounced auto-save (only when pcfId exists)
      if (pcfId) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          saveProgressInternal();
        }, 2000);
      }
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
  // SAVE PROGRESS (only when pcfId exists)
  // ============================================================================

  const saveProgressInternal = useCallback(async () => {
    if (!pcfId) return; // Can't save before PCF exists

    const currentData = JSON.stringify(formData);
    if (currentData === lastSavedDataRef.current) {
      return;
    }

    setSaving(true);

    try {
      // Save with original step numbers (1-7) for backward compat
      const wizardProgress = {
        currentStep: Math.max(progress.currentStep - 3, 1),
        completedSteps: progress.completedSteps
          .filter((s) => s > 3)
          .map((s) => s - 3),
        lastSavedAt: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('product_carbon_footprints')
        .update({
          intended_application: formData.intendedApplication || null,
          reasons_for_study: formData.reasonsForStudy || null,
          intended_audience:
            formData.intendedAudience.length > 0
              ? formData.intendedAudience
              : null,
          is_comparative_assertion: formData.isComparativeAssertion,
          functional_unit: formData.functionalUnit || null,
          system_boundary: formData.systemBoundary || null,
          cutoff_criteria: formData.cutoffCriteria || null,
          assumptions_limitations:
            formData.assumptions.length > 0
              ? formData.assumptions.map((text) => ({
                  type: 'Assumption',
                  text,
                }))
              : null,
          data_quality_requirements: formData.dataQuality,
          critical_review_type: formData.criticalReviewType,
          critical_review_justification:
            formData.criticalReviewJustification || null,
          wizard_progress: wizardProgress,
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
      await saveProgressInternal();

      setProgress((prev) => ({
        ...prev,
        completedSteps: Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1),
        estimatedTimeRemaining: 0,
      }));

      toast({
        title: 'Compliance wizard complete!',
        description: 'All required ISO 14044 fields have been documented.',
      });

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
    productId,
    pcfId,
    preCalcState,
    setPreCalcState,
    onCalculationComplete,
    formData,
    setFormData,
    updateField,
    progress,
    loading,
    saving,
    error,
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
