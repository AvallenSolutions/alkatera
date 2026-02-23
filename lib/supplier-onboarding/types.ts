/**
 * Supplier Onboarding Wizard Types
 *
 * Defines the three-phase onboarding journey for new supplier users.
 * Follows the same pattern as lib/onboarding/types.ts but is simpler:
 * - Single flow (no owner/member distinction)
 * - 7 steps across 3 phases
 * - No personalisation data
 */

export type SupplierOnboardingStep =
  // Phase 1: Orientation
  | 'supplier-welcome'
  | 'supplier-how-it-works'
  // Phase 2: Setup
  | 'supplier-complete-profile'
  | 'supplier-data-requests'
  // Phase 3: Action
  | 'supplier-add-product'
  | 'supplier-upload-evidence'
  | 'supplier-all-set'

export type SupplierOnboardingPhase =
  | 'orientation'   // Phase 1: Welcome & How It Works
  | 'setup'         // Phase 2: Profile & Data Requests
  | 'action'        // Phase 3: Products, Evidence, Completion

export interface SupplierOnboardingStepConfig {
  id: SupplierOnboardingStep
  phase: SupplierOnboardingPhase
  title: string
  description: string
  /** Whether this step can be skipped */
  skippable: boolean
  /** Index within the full step sequence (0-based) */
  index: number
}

export const SUPPLIER_ONBOARDING_STEPS: SupplierOnboardingStepConfig[] = [
  // Phase 1: Orientation
  { id: 'supplier-welcome',          phase: 'orientation', title: 'Welcome',        description: 'Welcome to alkatera',              skippable: false, index: 0 },
  { id: 'supplier-how-it-works',     phase: 'orientation', title: 'How It Works',   description: 'Platform tour',                    skippable: false, index: 1 },
  // Phase 2: Setup
  { id: 'supplier-complete-profile', phase: 'setup',       title: 'Your Profile',   description: 'Complete your company profile',    skippable: true,  index: 2 },
  { id: 'supplier-data-requests',    phase: 'setup',       title: 'Data Requests',  description: 'Understanding data requests',      skippable: false, index: 3 },
  // Phase 3: Action
  { id: 'supplier-add-product',      phase: 'action',      title: 'First Product',  description: 'Add your first product',           skippable: true,  index: 4 },
  { id: 'supplier-upload-evidence',  phase: 'action',      title: 'Evidence',       description: 'Why evidence matters',             skippable: false, index: 5 },
  { id: 'supplier-all-set',          phase: 'action',      title: 'All Set',        description: 'You are all set!',                 skippable: false, index: 6 },
]

export const TOTAL_SUPPLIER_STEPS = SUPPLIER_ONBOARDING_STEPS.length

export const SUPPLIER_PHASE_CONFIG: Record<SupplierOnboardingPhase, { label: string; duration: string; color: string }> = {
  'orientation': { label: 'Orientation',  duration: '~2 min', color: 'lime' },
  'setup':       { label: 'Setup',        duration: '~5 min', color: 'cyan' },
  'action':      { label: 'Get Started',  duration: '~3 min', color: 'emerald' },
}

export const SUPPLIER_PHASES: SupplierOnboardingPhase[] = ['orientation', 'setup', 'action']

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface SupplierOnboardingState {
  /** Whether the supplier has completed onboarding */
  completed: boolean
  /** Whether onboarding has been dismissed (supplier chose to skip) */
  dismissed: boolean
  /** Current step in the onboarding flow */
  currentStep: SupplierOnboardingStep
  /** Steps that have been completed */
  completedSteps: SupplierOnboardingStep[]
  /** Timestamp when onboarding was started */
  startedAt?: string
  /** Timestamp when onboarding was completed */
  completedAt?: string
  /** Whether the profile was filled in during the wizard */
  profileCompleted?: boolean
}

export const INITIAL_SUPPLIER_ONBOARDING_STATE: SupplierOnboardingState = {
  completed: false,
  dismissed: false,
  currentStep: 'supplier-welcome',
  completedSteps: [],
  profileCompleted: false,
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Get step config by step ID */
export function getSupplierStepConfig(step: SupplierOnboardingStep): SupplierOnboardingStepConfig {
  return SUPPLIER_ONBOARDING_STEPS.find(s => s.id === step) || SUPPLIER_ONBOARDING_STEPS[0]
}

/** Get next step (or null if at the end) */
export function getNextSupplierStep(currentStep: SupplierOnboardingStep): SupplierOnboardingStep | null {
  const idx = SUPPLIER_ONBOARDING_STEPS.findIndex(s => s.id === currentStep)
  if (idx === -1) return null
  const next = SUPPLIER_ONBOARDING_STEPS[idx + 1]
  return next?.id ?? null
}

/** Get previous step (or null if at the start) */
export function getPreviousSupplierStep(currentStep: SupplierOnboardingStep): SupplierOnboardingStep | null {
  const idx = SUPPLIER_ONBOARDING_STEPS.findIndex(s => s.id === currentStep)
  if (idx <= 0) return null
  const prev = SUPPLIER_ONBOARDING_STEPS[idx - 1]
  return prev?.id ?? null
}

/** Get progress percentage (0-100) */
export function getSupplierProgressPercentage(currentStep: SupplierOnboardingStep): number {
  const idx = SUPPLIER_ONBOARDING_STEPS.findIndex(s => s.id === currentStep)
  if (idx === -1) return 0
  return Math.round(((idx + 1) / SUPPLIER_ONBOARDING_STEPS.length) * 100)
}

/** Get all steps in a given phase */
export function getSupplierPhaseSteps(phase: SupplierOnboardingPhase): SupplierOnboardingStepConfig[] {
  return SUPPLIER_ONBOARDING_STEPS.filter(s => s.phase === phase)
}

/** Check if all steps in a phase have been completed */
export function isSupplierPhaseComplete(phase: SupplierOnboardingPhase, completedSteps: SupplierOnboardingStep[]): boolean {
  const phaseSteps = getSupplierPhaseSteps(phase)
  return phaseSteps.every(s => completedSteps.includes(s.id))
}
