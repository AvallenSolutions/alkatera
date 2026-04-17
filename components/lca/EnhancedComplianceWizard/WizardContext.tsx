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
import { INITIAL_PRE_CALC_STATE, materialHasAssignedFactor } from './types';
import { boundaryNeedsUsePhase, boundaryNeedsEndOfLife, boundaryNeedsDistribution, boundaryToDbEnum, DEFAULT_PRODUCT_LOSS_CONFIG } from '@/lib/system-boundaries';
import type { ProductLossConfig } from '@/lib/system-boundaries';
import type { UsePhaseConfig } from '@/lib/use-phase-factors';
import type { EoLConfig } from '@/lib/end-of-life-factors';
import type { DistributionConfig } from '@/lib/distribution-factors';
import { pickLcaSettings } from '@/types/lca-templates';
import type { LcaReportTemplate, LcaWizardSettings } from '@/types/lca-templates';

// ============================================================================
// TYPES
// ============================================================================

export type { ProductLossConfig } from '@/lib/system-boundaries';
export { DEFAULT_PRODUCT_LOSS_CONFIG } from '@/lib/system-boundaries';

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

  // Conditional steps (appear based on boundary)
  distributionConfig?: DistributionConfig;
  usePhaseConfig?: UsePhaseConfig;
  eolConfig?: EoLConfig;
  productLossConfig?: ProductLossConfig;

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

  // Dynamic step count based on boundary
  totalSteps: number;
  getStepId: (stepNumber: number) => string; // Maps step number to logical step ID
  showGuide: boolean;

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

  // Resume prompt
  resumeAvailable: boolean;
  resumeStep: number;
  dismissResume: () => void;

  // Actions
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  markStepComplete: (step: number) => void;
  saveProgress: () => Promise<void>;
  finishWizard: () => Promise<void>;
  resetError: () => void;

  // LCA report templates
  /**
   * Fetch the named template by id and overlay its settings onto the
   * current formData (preserving functionalUnit, which is product-specific).
   * Does not auto-save; the user is expected to review and either save
   * manually or edit a field to trigger the debounced auto-save.
   */
  applyTemplate: (templateId: string) => Promise<void>;
  /**
   * Persist the current formData as a new org-scoped template via
   * POST /api/lca-templates. Throws on failure so the calling dialog
   * can stay open and surface the error message inline (e.g. on a
   * duplicate-name 409).
   */
  saveAsTemplate: (
    name: string,
    description?: string | null,
    setAsDefault?: boolean,
  ) => Promise<void>;

  // Template prompt UI state (auto-opened dialogs)
  /**
   * True when the wizard has just loaded on a product with no prior
   * `last_wizard_settings`, so the UI should auto-open the template picker
   * prompt. Dismissing it (Skip or Apply) sets it back to false and it does
   * not reopen in this session. Also exposed so any step can call
   * `openTemplatePicker()` as a manual override.
   */
  showTemplatePicker: boolean;
  openTemplatePicker: () => void;
  dismissTemplatePicker: () => void;
  /**
   * True when the picker was opened by the auto-trigger (new product, no
   * prior settings). In that mode the dialog silently auto-dismisses if the
   * org has zero templates, to keep brand-new orgs friction-free. Manual
   * opens (GoalStep's "Apply template" button) set this to false so the
   * user sees the "No templates yet" empty state and understands why
   * clicking did nothing.
   */
  templatePickerAutoDismissOnEmpty: boolean;
  /**
   * True after `finishWizard()` has successfully persisted the PCF, so the
   * UI auto-opens the "Save as template?" prompt. Dismissed by Skip or Save.
   */
  showSaveTemplatePrompt: boolean;
  dismissSaveTemplatePrompt: () => void;
}

const INITIAL_FORM_DATA: WizardFormData = {
  intendedApplication: '',
  reasonsForStudy: '',
  intendedAudience: [],
  isComparativeAssertion: false,
  functionalUnit: '',
  systemBoundary: 'cradle-to-gate',
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

/**
 * Produce the initial WizardFormData for a freshly-opened wizard (no PCF
 * yet) by overlaying the product's persisted `last_wizard_settings` onto
 * the blank defaults.
 *
 * Org-scoped templates are NOT auto-applied here. Instead, when no
 * `last_wizard_settings` exists, `loadMaterialAndFacilityData` flips
 * `showTemplatePicker` so the shell opens a prompt dialog asking the user
 * to pick a template (or skip to a blank wizard). That keeps the prefill
 * explicit and visible instead of silently mutating state behind the user.
 *
 * functionalUnit is product-specific and lives on its own column, so it
 * is never part of the persisted settings blob and always falls through
 * to INITIAL_FORM_DATA here. loadPcfData() handles the resume case
 * separately when a pcfId already exists.
 */
export function buildInitialFormData(
  product: { last_wizard_settings?: Partial<LcaWizardSettings> | null } | null,
): WizardFormData {
  const source = product?.last_wizard_settings ?? null;

  if (!source) {
    return INITIAL_FORM_DATA;
  }

  return {
    ...INITIAL_FORM_DATA,
    ...source,
  } as WizardFormData;
}

const INITIAL_PROGRESS: WizardProgress = {
  currentStep: 1,
  completedSteps: [],
  estimatedTimeRemaining: 12,
};

// Base step time estimates (minutes) — 10 base steps (in new order)
// materials, facilities, boundary, calculate, goal, cutoff, data-quality, interpretation, review, summary
const BASE_STEP_TIME_ESTIMATES = [1, 1, 2, 2, 2, 2, 1, 1, 1, 1];
const BASE_TOTAL_STEPS = 10;

// Guide step time estimate
const GUIDE_STEP_TIME = 3;

// Additional step times for conditional steps
const DISTRIBUTION_STEP_TIME = 2;
const USE_PHASE_STEP_TIME = 2;
const EOL_STEP_TIME = 2;

/**
 * Step IDs for mapping step numbers to logical steps.
 *
 * CRITICAL FIX #16+20: Boundary step moved to step 3 (before Calculate at step 4).
 *
 * Previously, `calculate` was step 3 and `boundary` was step 5 — meaning the
 * calculation ran with the default `cradle-to-gate` boundary even if the user
 * intended cradle-to-grave. More critically, `usePhaseConfig` and `eolConfig`
 * were always undefined at calculation time (steps 6-7 hadn't run yet).
 *
 * New order: Materials → Facilities → Boundary(+UsePhase/EoL if needed) → Calculate
 *   - User selects boundary and fills use-phase/EoL steps BEFORE the calculation runs.
 *   - The calculation at step 4+ now has the correct boundary, usePhaseConfig, eolConfig.
 *   - Dynamic use-phase and end-of-life steps are inserted after `boundary` (index 2).
 *
 * If the user later changes the boundary in the boundary step (step 3) and saves,
 * they are shown a warning to re-run the calculation. The finishWizard() call also
 * re-runs the aggregation with final configs to ensure the stored result is correct.
 */
const BASE_STEP_IDS = [
  'materials',      // 1
  'facilities',     // 2
  'boundary',       // 3  ← moved BEFORE calculate
  'calculate',      // 4  ← now runs after boundary/use-phase/EoL configured
  'goal',           // 5
  'cutoff',         // 6
  'data-quality',   // 7
  'interpretation', // 8
  'review',         // 9
  'summary',        // 10
];

/**
 * Calculate total steps based on system boundary.
 * Use Phase step is added for consumer/grave, EoL step for grave.
 * When showGuide is true, the guide step is prepended.
 */
export function getTotalSteps(boundary: string, showGuide: boolean = false): number {
  let total = BASE_TOTAL_STEPS;
  if (showGuide) total += 1;
  if (boundaryNeedsDistribution(boundary)) total += 1;
  if (boundaryNeedsUsePhase(boundary)) total += 1;
  if (boundaryNeedsEndOfLife(boundary)) total += 1;
  return total;
}

/**
 * Get the ordered list of step IDs for a given boundary.
 * Use-phase and EoL steps are inserted after 'boundary'.
 * They appear BEFORE 'calculate' so configs are ready when calculation runs.
 * When showGuide is true, the 'guide' step is prepended.
 */
export function getStepIdsForBoundary(boundary: string, showGuide: boolean = false): string[] {
  const ids = showGuide ? ['guide', ...BASE_STEP_IDS] : [...BASE_STEP_IDS];
  // 'boundary' index shifts by 1 when guide is present
  const boundaryIdx = ids.indexOf('boundary');
  const insertAt = boundaryIdx + 1;
  // Insert in reverse order at the same index so the final ordering is:
  // boundary → distribution → use-phase → end-of-life → calculate
  if (boundaryNeedsEndOfLife(boundary)) {
    ids.splice(insertAt, 0, 'end-of-life');
  }
  if (boundaryNeedsUsePhase(boundary)) {
    ids.splice(insertAt, 0, 'use-phase');
  }
  if (boundaryNeedsDistribution(boundary)) {
    ids.splice(insertAt, 0, 'distribution');
  }
  return ids;
  // Result for cradle-to-grave (with guide): guide, materials, facilities, boundary, distribution, use-phase, end-of-life, calculate, goal, ...
  // Result for cradle-to-gate (no guide):    materials, facilities, boundary, calculate, goal, ...
}

/**
 * Get time estimates for all steps (including dynamic ones)
 */
function getStepTimeEstimates(boundary: string, showGuide: boolean = false): number[] {
  const times = showGuide
    ? [GUIDE_STEP_TIME, ...BASE_STEP_TIME_ESTIMATES]
    : [...BASE_STEP_TIME_ESTIMATES];
  // Use dynamic lookup (matching getStepIdsForBoundary) instead of hardcoded index
  const stepIds = showGuide ? ['guide', ...BASE_STEP_IDS] : [...BASE_STEP_IDS];
  const boundaryIdx = stepIds.indexOf('boundary');
  const insertAt = boundaryIdx + 1;
  // Same reverse-order insertion as getStepIdsForBoundary
  if (boundaryNeedsEndOfLife(boundary)) {
    times.splice(insertAt, 0, EOL_STEP_TIME);
  }
  if (boundaryNeedsUsePhase(boundary)) {
    times.splice(insertAt, 0, USE_PHASE_STEP_TIME);
  }
  if (boundaryNeedsDistribution(boundary)) {
    times.splice(insertAt, 0, DISTRIBUTION_STEP_TIME);
  }
  return times;
}

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
  showGuide?: boolean;
}

export function WizardProvider({
  productId,
  pcfId: initialPcfId,
  children,
  onComplete,
  showGuide = false,
}: WizardProviderProps) {
  const { toast } = useToast();

  // State
  const [pcfId, setPcfId] = useState<string | null>(initialPcfId || null);
  const [formData, setFormData] = useState<WizardFormData>(INITIAL_FORM_DATA);
  const [progress, setProgress] = useState<WizardProgress>(INITIAL_PROGRESS);

  // Template prompt state (Stage 6 — auto-open dialogs instead of nav buttons)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [
    templatePickerAutoDismissOnEmpty,
    setTemplatePickerAutoDismissOnEmpty,
  ] = useState(false);
  const [showSaveTemplatePrompt, setShowSaveTemplatePrompt] = useState(false);
  const [preCalcState, setPreCalcState] = useState<PreCalculationState>(
    INITIAL_PRE_CALC_STATE
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resume prompt state
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [resumeStep, setResumeStep] = useState(1);

  // Auto-save debounce ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');
  // Guards the facility-allocation autosave effect from firing on the initial
  // load hydration (we only want saves triggered by real user edits).
  const initialLoadDoneRef = useRef<boolean>(false);
  // Prevents concurrent draft-PCF creation if multiple edits race.
  const draftCreationRef = useRef<Promise<string | null> | null>(null);
  // Holds the latest saveProgressInternal closure so callers declared earlier
  // in the component (updateField, useEffect) can invoke it without hitting
  // a use-before-declaration error.
  const saveProgressRef = useRef<() => Promise<void>>(async () => {});

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

      // ── FAST PHASE: fetch product, materials, and facilities in parallel ──
      // These are simple DB reads that complete in <1s. We show the wizard
      // immediately after this phase, with materials in 'validating' state.
      const [productResult, materialsResult, facilitiesResult] = await Promise.all([
        sb.from('products').select('*').eq('id', productId).maybeSingle(),
        sb.from('product_materials').select('*').eq('product_id', productId),
        sb.from('facility_product_assignments')
          .select('*, facilities (id, name, operational_control, address_city, address_country)')
          .eq('product_id', productId)
          .eq('assignment_status', 'active'),
      ]);

      const { data: productData, error: productError } = productResult;
      if (productError || !productData) {
        setError('Product not found');
        return;
      }

      setPreCalcState((prev) => ({ ...prev, product: productData }));

      // Look up an existing draft PCF for this product so the wizard
      // resumes where the user left off. We only do this when the caller
      // didn't pass an explicit pcfId (that path is for editing a completed
      // LCA; drafts are a separate "in-progress" concept).
      let resumedDraftPcfId: string | null = null;
      let resumedDraftData: any = null;
      if (!initialPcfId) {
        const { data: existingDraft } = await sb
          .from('product_carbon_footprints')
          .select('id, draft_data')
          .eq('product_id', parseInt(productId, 10))
          .eq('organization_id', productData.organization_id)
          .eq('status', 'draft')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existingDraft?.id) {
          resumedDraftPcfId = existingDraft.id;
          resumedDraftData = existingDraft.draft_data ?? null;
          setPcfId(existingDraft.id);
        }
      }

      // Fresh-wizard prefill (no PCF to resume):
      //
      //   1. products.last_wizard_settings — restore silently from the
      //      user's most recent run on this product.
      //   2. No prior settings → start from INITIAL_FORM_DATA AND trigger
      //      the template picker prompt so the user can explicitly choose
      //      to start from a saved template or skip to blank defaults.
      //
      // Org-scoped templates are no longer auto-applied behind the user's
      // back — the prompt dialog fetches the list itself and handles the
      // pick / skip / zero-templates cases.
      if (!initialPcfId && !resumedDraftPcfId) {
        setFormData(buildInitialFormData(productData));
        if (!productData.last_wizard_settings) {
          // Auto-trigger: silently dismiss if the org has no templates yet.
          setTemplatePickerAutoDismissOnEmpty(true);
          setShowTemplatePicker(true);
        }
      }

      const { data: materialsData, error: materialsError } = materialsResult;
      if (materialsError) throw materialsError;

      if (!materialsData || materialsData.length === 0) {
        setError(
          'No materials found. Please add ingredients and packaging first.'
        );
        return;
      }

      const { data: facilitiesData } = facilitiesResult;

      // Build initial materials list with 'validating' status.
      // Materials with a DB-assigned factor show as 'assigned' immediately;
      // the rest show as 'validating' until background resolution completes.
      const initialMaterials: MaterialWithValidation[] = materialsData.map(
        (mat) => {
          if (materialHasAssignedFactor(mat)) {
            return {
              ...mat,
              hasData: true,
              validationStatus: 'assigned' as const,
              resolvedFactorName: mat.matched_source_name || mat.material_name,
            };
          }
          return {
            ...mat,
            hasData: false,
            validationStatus: 'validating' as const,
          };
        }
      );

      // Process facility data (fast, no API calls)
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

        // Pre-populate production volumes from product's annual production
        const annualVolume = productData.annual_production_volume;
        const annualUnit = productData.annual_production_unit || 'units';

        const initYear = new Date().getFullYear(); // matches INITIAL_FORM_DATA.referenceYear

        allocations = facilities.map((f) => {
          const facilitySessions = allSessions[f.facility_id] || [];
          // Prefer session matching the default reference year over just "latest"
          const yearMatchSession = facilitySessions.find((s) => {
            const sy = new Date(s.reporting_period_start).getFullYear();
            const ey = new Date(s.reporting_period_end).getFullYear();
            return initYear >= sy && initYear <= ey;
          });
          const latestSession = yearMatchSession || facilitySessions[0];

          // Get allocation percentage from the assignment record
          const assignmentRecord = facilitiesData!.find((fd: any) => fd.facility_id === f.facility_id);
          const allocationPct = (assignmentRecord as any)?.allocation_percentage ?? 100;

          // Pre-compute product volume at this facility
          const prePopulatedVolume = annualVolume
            ? String(Math.round(annualVolume * allocationPct / 100))
            : '';

          if (latestSession) {
            return {
              facilityId: f.facility_id,
              facilityName: f.facility.name,
              operationalControl: f.facility.operational_control,
              reportingPeriodStart: latestSession.reporting_period_start,
              reportingPeriodEnd: latestSession.reporting_period_end,
              productionVolume: prePopulatedVolume,
              productionVolumeUnit: annualVolume ? annualUnit : (latestSession.volume_unit || 'units'),
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
            productionVolume: prePopulatedVolume,
            productionVolumeUnit: annualVolume ? annualUnit : 'units',
            facilityTotalProduction: '',
          };
        });
      }

      // If we're resuming a draft, overlay the persisted facility allocations
      // on top of the freshly-loaded defaults. Merge by facilityId so newly
      // linked facilities still get their default session; removed ones are
      // dropped naturally.
      let effectiveAllocations = allocations;
      if (resumedDraftData?.facilityAllocations && Array.isArray(resumedDraftData.facilityAllocations)) {
        const savedByFacility = new Map<string, FacilityAllocation>(
          (resumedDraftData.facilityAllocations as FacilityAllocation[]).map((a) => [a.facilityId, a])
        );
        effectiveAllocations = allocations.map((a) => savedByFacility.get(a.facilityId) ?? a);
      }

      // ── SHOW WIZARD IMMEDIATELY ──
      // Set initial state with materials in 'validating' status so the wizard
      // renders instantly. Validation runs in the background below.
      setPreCalcState((prev) => ({
        ...prev,
        materials: initialMaterials,
        canCalculate: false, // Will be updated after validation
        missingCount: 0,
        linkedFacilities: facilities,
        facilityAllocations: effectiveAllocations,
        reportingSessions: allSessions,
        materialDataLoaded: true,
        materialDataLoading: true, // Still validating
      }));

      // Clear the top-level loading gate — wizard UI is now visible
      setLoading(false);

      // Load PCF data if editing an existing calculation (fast DB read)
      const pcfToLoad = initialPcfId ?? resumedDraftPcfId;
      if (pcfToLoad) {
        await loadPcfData(pcfToLoad);
      }

      // Mark initial load complete so subsequent allocation mutations
      // trigger the facility-allocation autosave effect.
      initialLoadDoneRef.current = true;

      // ── BACKGROUND PHASE: validate materials asynchronously ──
      // This resolves emission factors (including OpenLCA API calls) without
      // blocking the wizard. Materials update from 'validating' to their final
      // status as each one completes.
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
            const r = validMaterial.resolved;
            const totalClimate = r.impact_climate || 1;
            const transportPct = r.impact_climate_transport_embedded
              ? (r.impact_climate_transport_embedded / totalClimate) * 100
              : undefined;
            const electricityPct = r.impact_climate_electricity_embedded
              ? (r.impact_climate_electricity_embedded / totalClimate) * 100
              : undefined;

            return {
              ...mat,
              hasData: true,
              validationStatus: 'resolved' as const,
              dataQuality: r.data_quality_tag,
              confidenceScore: r.confidence_score,
              factorGeography: r.geographic_scope || undefined,
              embeddedTransportPercent: transportPct,
              embeddedElectricityPercent: electricityPct,
              embeddedElectricityGeography: r.embedded_electricity_geography,
            };
          }

          if (materialHasAssignedFactor(mat)) {
            return {
              ...mat,
              hasData: true,
              validationStatus: 'assigned' as const,
              resolvedFactorName: mat.matched_source_name || mat.material_name,
              error: missingMaterial?.error,
            };
          }

          return {
            ...mat,
            hasData: false,
            validationStatus: 'missing' as const,
            error: missingMaterial?.error || 'Unknown validation error',
          };
        }
      );

      const trulyMissing = materialsWithStatus.filter(
        (m) => m.validationStatus === 'missing'
      ).length;

      setPreCalcState((prev) => ({
        ...prev,
        materials: materialsWithStatus,
        canCalculate: trulyMissing === 0,
        missingCount: trulyMissing,
        materialDataLoading: false,
      }));

      // Fire-and-forget: pre-warm OpenLCA cache for next calculation
      const openLcaMaterials = materialsData
        .filter((m: any) => m.data_source === 'openlca' && m.data_source_id)
        .map((m: any) => ({
          processId: m.data_source_id,
          database: (m.openlca_database || 'ecoinvent') as 'ecoinvent' | 'agribalyse',
        }));

      if (openLcaMaterials.length > 0) {
        const { data: { session } } = await sb.auth.getSession();
        if (session?.access_token) {
          fetch('/api/openlca/warm-cache', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              organizationId: productData.organization_id,
              materials: openLcaMaterials,
            }),
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error('[WizardContext] Load error:', err);
      setError(err.message || 'Failed to load data');
      setLoading(false);
    }
  }

  // ============================================================================
  // LOAD PCF DATA (steps 4-10)
  // ============================================================================

  async function loadPcfData(id: string, resetStep = true) {
    try {
      // Try with product_loss_config first; fall back without it if column doesn't exist yet
      let pcf: any = null;
      const baseColumns = `
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
          product_name,
          use_phase_config,
          eol_config,
          distribution_config`;

      const { data: pcfFull, error: fullError } = await supabase
        .from('product_carbon_footprints')
        .select(`${baseColumns}, product_loss_config`)
        .eq('id', id)
        .single();

      if (fullError && fullError.code === '42703') {
        // Column doesn't exist yet (migration not applied) — retry without it
        const { data: pcfBase, error: baseError } = await supabase
          .from('product_carbon_footprints')
          .select(baseColumns)
          .eq('id', id)
          .single();
        if (baseError) throw baseError;
        pcf = pcfBase;
      } else if (fullError) {
        throw fullError;
      } else {
        pcf = pcfFull;
      }

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
            pcf.functional_unit || '',
          systemBoundary: (pcf.system_boundary || 'cradle-to-gate').toLowerCase(),
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
          distributionConfig: pcf.distribution_config || undefined,
          usePhaseConfig: pcf.use_phase_config || undefined,
          eolConfig: pcf.eol_config || undefined,
          productLossConfig: pcf.product_loss_config || undefined,
          referenceYear: pcf.reference_year || new Date().getFullYear(),
          dqiScore: pcf.dqi_score || 0,
        });

        // Only reset step position when loading an existing PCF on initial
        // mount. After a fresh calculation, onCalculationComplete has already
        // set the correct step — resetting here would send the user back to
        // the beginning.
        if (resetStep) {
          // Start at step 1 so users can review from the beginning,
          // but restore completed steps so progress bar shows what's done
          if (pcf.wizard_progress) {
            const savedCompleted: number[] =
              pcf.wizard_progress.completedSteps || [];

            // Determine offset: calculate is now step (3 + use-phase? + end-of-life?),
            // so ISO doc steps are offset by (calculateStepNumber).
            // Old saved format stored ISO steps starting at 1.
            const savedBoundary = (pcf.system_boundary || 'cradle-to-gate').toLowerCase();
            const savedStepIds = getStepIdsForBoundary(savedBoundary, showGuide);
            const calcIdx = savedStepIds.indexOf('calculate'); // 0-indexed
            const isoOffset = calcIdx + 1; // 1-indexed step number of 'calculate'

            const preCalcSteps = Array.from({ length: isoOffset }, (_, i) => i + 1);
            const remappedCompleted = [
              ...preCalcSteps,
              ...savedCompleted.map((s: number) => s + isoOffset),
            ];

            setProgress({
              currentStep: 1,
              completedSteps: remappedCompleted,
              lastSavedAt: pcf.wizard_progress.lastSavedAt
                ? new Date(pcf.wizard_progress.lastSavedAt)
                : undefined,
              estimatedTimeRemaining: calculateTimeRemaining(remappedCompleted),
            });

            // Offer to resume if there are completed steps beyond the first
            const maxCompleted = Math.max(...remappedCompleted, 0);
            if (maxCompleted > 1) {
              setResumeStep(maxCompleted);
              setResumeAvailable(true);
            }
          } else {
            // PCF exists but no wizard progress — start at step 1
            setProgress({
              currentStep: 1,
              completedSteps: [1, 2, 3],
              estimatedTimeRemaining: calculateTimeRemaining([1, 2, 3]),
            });

            // Offer to resume from step 3 (boundary)
            setResumeStep(3);
            setResumeAvailable(true);
          }
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

      // Determine which step number 'calculate' is for this boundary,
      // then advance to the step after it (the 'goal' step).
      const boundary = formData.systemBoundary || 'cradle-to-gate';
      const stepIds = getStepIdsForBoundary(boundary, showGuide);
      const calcStepNumber = stepIds.indexOf('calculate') + 1; // 1-indexed
      const nextStepAfterCalc = calcStepNumber + 1;

      // Mark all steps up to and including calculate as complete
      const completedUpToCalc = Array.from({ length: calcStepNumber }, (_, i) => i + 1);

      setProgress((prev) => ({
        ...prev,
        currentStep: nextStepAfterCalc,
        completedSteps: Array.from(
          new Set([...prev.completedSteps, ...completedUpToCalc])
        ),
        estimatedTimeRemaining: calculateTimeRemaining([
          ...prev.completedSteps,
          ...completedUpToCalc,
        ]),
      }));

      // Load PCF data for ISO documentation steps — don't reset step
      // position since we've already advanced past calculate above
      await loadPcfData(newPcfId, false);
    },
    [formData.systemBoundary, showGuide]
  );

  // ============================================================================
  // CALCULATE TIME REMAINING
  // ============================================================================

  function calculateTimeRemaining(completedSteps: number[]): number {
    const boundary = formData.systemBoundary || 'cradle-to-gate';
    const total = getTotalSteps(boundary, showGuide);
    const timeEstimates = getStepTimeEstimates(boundary, showGuide);
    let remaining = 0;
    for (let i = 0; i < total; i++) {
      if (!completedSteps.includes(i + 1)) {
        remaining += timeEstimates[i] || 1;
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

      // HIGH FIX #18: When the system boundary changes, the step list gains or loses
      // use-phase and end-of-life steps. Numeric `completedSteps` become invalid
      // because step numbers shift (e.g., old step 6 "Cutoff" → new step 7 if UsePhase inserted).
      //
      // Fix: when boundary changes, re-anchor completedSteps relative to the new step order.
      // We keep pre-calculate steps (steps 1..calculateStepNumber) as completed, and
      // reset all post-calculate steps so the user must complete them again.
      // This is safe: the calculation result is still valid (stored in DB), but the
      // ISO doc steps (goal, cutoff, data quality, etc.) need to be re-confirmed in case
      // the new boundary changes what assumptions apply.
      if (field === 'systemBoundary' && typeof value === 'string') {
        const newBoundary = value;
        const newStepIds = getStepIdsForBoundary(newBoundary, showGuide);
        const newCalcStepNumber = newStepIds.indexOf('calculate') + 1;
        // Keep steps 1..newCalcStepNumber as completed; clear the rest
        const preCalcCompleted = Array.from({ length: newCalcStepNumber }, (_, i) => i + 1);
        setProgress((prev) => ({
          ...prev,
          completedSteps: preCalcCompleted,
          // If currently past calculate, stay at current step if it still exists;
          // otherwise go back to the step after boundary
          currentStep: prev.currentStep > newCalcStepNumber
            ? Math.min(prev.currentStep, newStepIds.length)
            : prev.currentStep,
        }));
      }

      // When the user changes the reference year, auto-select the facility
      // reporting session that best matches the new year so that facility data
      // (energy, production runs, etc.) aligns with the stated reference period.
      if (field === 'referenceYear' && typeof value === 'number') {
        const selectedYear = value as number;
        setPreCalcState((prev) => {
          const sessions = prev.reportingSessions;
          const updatedAllocations = prev.facilityAllocations.map((alloc) => {
            const facilitySessions = sessions[alloc.facilityId] || [];
            if (facilitySessions.length === 0) return alloc;

            // Find session whose reporting period overlaps the selected year
            const matchingSession = facilitySessions.find((s) => {
              const startYear = new Date(s.reporting_period_start).getFullYear();
              const endYear = new Date(s.reporting_period_end).getFullYear();
              return selectedYear >= startYear && selectedYear <= endYear;
            });

            const bestSession = matchingSession || facilitySessions[0];
            if (bestSession.id === alloc.selectedSessionId) return alloc;

            return {
              ...alloc,
              reportingPeriodStart: bestSession.reporting_period_start,
              reportingPeriodEnd: bestSession.reporting_period_end,
              facilityTotalProduction: String(bestSession.total_production_volume || ''),
              productionVolumeUnit: bestSession.volume_unit || alloc.productionVolumeUnit,
              selectedSessionId: bestSession.id,
            };
          });
          return { ...prev, facilityAllocations: updatedAllocations };
        });
      }

      // Trigger debounced auto-save. saveProgressInternal creates a draft
      // PCF lazily if none exists yet, so we no longer gate on pcfId.
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveProgressRef.current();
      }, 2000);
    },
    [pcfId, showGuide]
  );

  const goToStep = useCallback((step: number) => {
    const total = getTotalSteps(formData.systemBoundary || 'cradle-to-gate', showGuide);
    if (step >= 1 && step <= total) {
      setProgress((prev) => ({ ...prev, currentStep: step }));
    }
  }, [formData.systemBoundary, showGuide]);

  const nextStep = useCallback(() => {
    const total = getTotalSteps(formData.systemBoundary || 'cradle-to-gate', showGuide);
    setProgress((prev) => {
      const newStep = Math.min(prev.currentStep + 1, total);
      return { ...prev, currentStep: newStep };
    });
  }, [formData.systemBoundary, showGuide]);

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

  const dismissResume = useCallback(() => {
    setResumeAvailable(false);
  }, []);

  // ============================================================================
  // DRAFT PCF CREATION
  // ============================================================================

  /**
   * Ensure a draft PCF row exists for this wizard session. The row is created
   * on the first user edit (not on mount) so that abandoned wizards don't
   * leave orphan rows. Subsequent saves update this row in place; the
   * calculator promotes it from 'draft' → 'pending' → 'completed'.
   */
  const ensureDraftPcf = useCallback(async (): Promise<string | null> => {
    if (pcfId) return pcfId;
    if (draftCreationRef.current) return draftCreationRef.current;

    const product = preCalcState.product;
    if (!product) return null;

    const creation = (async () => {
      const { data: created, error: createError } = await supabase
        .from('product_carbon_footprints')
        .insert({
          organization_id: product.organization_id,
          product_id: parseInt(productId, 10),
          product_name: product.name,
          product_description: product.product_description,
          product_image_url: product.product_image_url,
          functional_unit: `1 ${product.unit || 'unit'} of ${product.name || 'product'}`,
          system_boundary: formData.systemBoundary || 'cradle-to-gate',
          lca_scope_type: formData.systemBoundary || 'cradle-to-gate',
          reference_year: formData.referenceYear || new Date().getFullYear(),
          status: 'draft',
          lca_version: '1.0',
        })
        .select('id')
        .single();

      if (createError || !created) {
        console.error('[WizardContext] Draft PCF creation failed:', createError);
        return null;
      }
      setPcfId(created.id);
      return created.id as string;
    })();

    draftCreationRef.current = creation;
    try {
      return await creation;
    } finally {
      draftCreationRef.current = null;
    }
  }, [pcfId, preCalcState.product, productId, formData.systemBoundary, formData.referenceYear]);

  // ============================================================================
  // SAVE PROGRESS (creates draft PCF if needed, then saves)
  // ============================================================================

  const saveProgressInternal = useCallback(async () => {
    const activePcfId = pcfId ?? (await ensureDraftPcf());
    if (!activePcfId) return;

    const currentData = JSON.stringify(formData);
    if (currentData === lastSavedDataRef.current) {
      return;
    }

    setSaving(true);

    try {
      // Save ISO doc step progress (steps after 'calculate') relative to calculate's position.
      // This is boundary-aware: calculate step number varies based on use-phase/EoL insertion.
      const boundary = formData.systemBoundary || 'cradle-to-gate';
      const stepIds = getStepIdsForBoundary(boundary, showGuide);
      const calcStepNumber = stepIds.indexOf('calculate') + 1; // 1-indexed

      const wizardProgress = {
        currentStep: Math.max(progress.currentStep - calcStepNumber, 1),
        completedSteps: progress.completedSteps
          .filter((s) => s > calcStepNumber)
          .map((s) => s - calcStepNumber),
        lastSavedAt: new Date().toISOString(),
      };

      // Build update payload — only include lifecycle columns when they have
      // values, so saves still succeed if the DB migration hasn't been applied yet.
      const updatePayload: Record<string, unknown> = {
        intended_application: formData.intendedApplication || null,
        reasons_for_study: formData.reasonsForStudy || null,
        intended_audience:
          formData.intendedAudience.length > 0
            ? formData.intendedAudience
            : null,
        is_comparative_assertion: formData.isComparativeAssertion,
        // Only update functional_unit when the user has actually entered a value.
        // An empty string means the field was never edited — preserve the original
        // value set during calculation to avoid NOT NULL constraint violations.
        ...(formData.functionalUnit ? { functional_unit: formData.functionalUnit } : {}),
        system_boundary: formData.systemBoundary || null,
        lca_scope_type: formData.systemBoundary || null,
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
        reference_year: formData.referenceYear,
        wizard_progress: wizardProgress,
        // Persist pre-calculation state so the wizard can resume mid-flow.
        // Materials are authoritative in product_materials; we only need to
        // snapshot the user-editable facility allocations here.
        draft_data: {
          facilityAllocations: preCalcState.facilityAllocations,
        },
        updated_at: new Date().toISOString(),
      };

      // Lifecycle columns added in migrations 20260313/20260325 — include only when set
      if (formData.distributionConfig) {
        updatePayload.distribution_config = formData.distributionConfig;
      }
      if (formData.usePhaseConfig) {
        updatePayload.use_phase_config = formData.usePhaseConfig;
      }
      if (formData.eolConfig) {
        updatePayload.eol_config = formData.eolConfig;
      }
      if (formData.productLossConfig) {
        updatePayload.product_loss_config = formData.productLossConfig;
      }

      const { error: updateError } = await supabase
        .from('product_carbon_footprints')
        .update(updatePayload)
        .eq('id', activePcfId);

      if (updateError) throw updateError;

      // Mirror-write to the products table:
      //   1. last_wizard_settings — always updated, so the next wizard open
      //      prefills from the user's most recent choices and drift between
      //      runs for the same product is eliminated.
      //   2. system_boundary — kept in sync so the product list and detail
      //      pages display the correct boundary (DB uses underscore enum).
      const productsUpdate: Record<string, unknown> = {
        last_wizard_settings: pickLcaSettings(formData),
      };
      if (formData.systemBoundary) {
        productsUpdate.system_boundary = boundaryToDbEnum(formData.systemBoundary);
      }
      const { error: productsUpdateError } = await supabase
        .from('products')
        .update(productsUpdate)
        .eq('id', productId);
      if (productsUpdateError) {
        // Non-fatal: the PCF itself saved successfully, the prefill is just a
        // convenience. Log and swallow so the user doesn't see a scary error.
        console.warn(
          '[WizardContext] Mirror-write to products failed (non-fatal):',
          productsUpdateError,
        );
      }

      lastSavedDataRef.current = currentData;
      setProgress((prev) => ({
        ...prev,
        lastSavedAt: new Date(),
      }));
    } catch (err: any) {
      console.error('[WizardContext] Save error:', err);
      sonnerToast.error('Failed to save progress', {
        description: err?.message || 'Check your connection and try again',
      });
    } finally {
      setSaving(false);
    }
  }, [formData, progress, pcfId, preCalcState.facilityAllocations, ensureDraftPcf]);

  // Keep the ref pointing at the freshest saveProgressInternal closure so
  // earlier-declared callbacks (updateField, effects) can call it without a
  // circular declaration order.
  saveProgressRef.current = saveProgressInternal;

  const saveProgress = useCallback(async () => {
    await saveProgressInternal();
    toast({
      title: 'Progress saved',
      description: 'Your changes have been saved.',
    });
  }, [saveProgressInternal, toast]);

  // ============================================================================
  // LCA REPORT TEMPLATES — apply / save-as
  // ============================================================================

  /**
   * Fetch an LCA report template and overlay its settings onto the current
   * formData. functionalUnit is preserved because it's product-specific and
   * is never part of the persisted settings blob (LcaWizardSettings Omits it).
   *
   * Intentionally does NOT call saveProgressInternal — the plan is that the
   * user reviews the applied settings first. A subsequent field edit will
   * trigger the existing debounced auto-save, or they can hit Save manually.
   */
  const applyTemplate = useCallback(
    async (templateId: string) => {
      try {
        const res = await fetch(`/api/lca-templates/${templateId}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || 'Failed to load template');
        }
        const template = json?.template as LcaReportTemplate | undefined;
        if (!template) {
          throw new Error('Template response was empty');
        }

        setFormData((prev) => ({
          ...prev,
          ...template.settings,
          // Defensive: LcaWizardSettings Omits functionalUnit so this
          // spread can't clobber it, but pin it explicitly in case a
          // legacy/hand-edited row has it stored anyway.
          functionalUnit: prev.functionalUnit,
        }));

        sonnerToast.success(`Template "${template.name}" applied`, {
          description: 'Review the settings and save to persist.',
        });
      } catch (err: any) {
        console.error('[WizardContext] applyTemplate error:', err);
        sonnerToast.error('Failed to apply template', {
          description: err?.message || 'Please try again.',
        });
      }
    },
    [],
  );

  /**
   * POST the current formData as a new org-scoped template. Errors are
   * re-thrown so the calling dialog can keep itself open and display the
   * message inline (duplicate-name 409, validation 400, etc).
   */
  const saveAsTemplate = useCallback(
    async (
      name: string,
      description?: string | null,
      setAsDefault?: boolean,
    ) => {
      const organizationId = preCalcState.product?.organization_id;
      if (!organizationId) {
        const msg = 'Organisation context is not loaded yet.';
        sonnerToast.error('Cannot save template', { description: msg });
        throw new Error(msg);
      }

      const res = await fetch('/api/lca-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          name,
          description: description ?? null,
          settings: pickLcaSettings(formData),
          setAsDefault: setAsDefault === true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.error || 'Failed to save template';
        sonnerToast.error('Failed to save template', { description: msg });
        throw new Error(msg);
      }

      sonnerToast.success(`Template "${name}" saved`, {
        description: setAsDefault
          ? 'This is now the org default for new products.'
          : 'Available to apply on any product in your organisation.',
      });
    },
    [formData, preCalcState.product?.organization_id],
  );

  // ============================================================================
  // FINISH WIZARD
  // ============================================================================

  const finishWizard = useCallback(async () => {
    setSaving(true);

    try {
      await saveProgressInternal();

      const total = getTotalSteps(formData.systemBoundary || 'cradle-to-gate', showGuide);
      setProgress((prev) => ({
        ...prev,
        completedSteps: Array.from({ length: total }, (_, i) => i + 1),
        estimatedTimeRemaining: 0,
      }));

      toast({
        title: 'Compliance wizard complete!',
        description: 'All required ISO 14044 fields have been documented.',
      });

      // Prompt the user to save these settings as a reusable template.
      // By the finish step every Goal & Scope field is populated, so the
      // captured blob is complete — unlike the old "Save as template" button
      // that lived on the Goal step, which could only capture partial data.
      setShowSaveTemplatePrompt(true);
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
  // AUTOSAVE: facility allocation changes
  // ============================================================================

  // Debounced autosave triggered by user edits to facility allocations. The
  // initialLoadDoneRef guard skips the first render where allocations are
  // populated by loadMaterialAndFacilityData (we don't want to create a
  // draft PCF on pure mount, only on real user interaction).
  useEffect(() => {
    if (!initialLoadDoneRef.current) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveProgressRef.current();
    }, 2000);
  }, [preCalcState.facilityAllocations]);

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

  const boundary = formData.systemBoundary || 'cradle-to-gate';
  const totalSteps = getTotalSteps(boundary, showGuide);
  const stepIds = getStepIdsForBoundary(boundary, showGuide);

  const getStepId = useCallback(
    (stepNumber: number): string => {
      return stepIds[stepNumber - 1] || 'unknown';
    },
    [boundary, showGuide]
  );

  const value: WizardContextValue = {
    productId,
    pcfId,
    preCalcState,
    setPreCalcState,
    onCalculationComplete,
    totalSteps,
    getStepId,
    showGuide,
    formData,
    setFormData,
    updateField,
    progress,
    loading,
    saving,
    error,
    resumeAvailable,
    resumeStep,
    dismissResume,
    goToStep,
    nextStep,
    prevStep,
    markStepComplete,
    saveProgress,
    finishWizard,
    resetError,
    applyTemplate,
    saveAsTemplate,
    showTemplatePicker,
    openTemplatePicker: () => {
      // Manual open: never auto-dismiss on empty, so the user sees the
      // "No templates yet" empty state and knows why the button did nothing.
      setTemplatePickerAutoDismissOnEmpty(false);
      setShowTemplatePicker(true);
    },
    dismissTemplatePicker: () => setShowTemplatePicker(false),
    templatePickerAutoDismissOnEmpty,
    showSaveTemplatePrompt,
    dismissSaveTemplatePrompt: () => setShowSaveTemplatePrompt(false),
  };

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
}
