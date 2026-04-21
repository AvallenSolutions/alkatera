/**
 * Onboarding Wizard Types
 *
 * Defines the five-phase onboarding journey for new Alkatera users.
 * Based on the ALKATERA_ONBOARDING_PLAN_2026.md specification.
 *
 * Owner flow: Full 14-step onboarding (create org, add data, etc.)
 * Member flow: Streamlined 6-step onboarding (welcome, learn platform)
 * Fast track flow: 5-step "see your footprint in 10 min" path
 */

export type OnboardingFlow = 'owner' | 'member' | 'fast_track'

export type OnboardingPhase =
  | 'welcome'           // Phase 1: Welcome & Orientation
  | 'quick-wins'        // Phase 2: Quick Wins
  | 'core-setup'        // Phase 3: Core Data Setup
  | 'first-insights'    // Phase 4: First Insights
  | 'power-features'    // Phase 5: Power Features & Completion

export type OnboardingStep =
  // Phase 1: Welcome & Orientation
  | 'welcome-screen'
  | 'meet-rosa'
  | 'personalization'
  | 'company-basics'
  // Phase 2: Quick Wins
  | 'roadmap'
  | 'preview-dashboard'
  | 'connect-tools'
  | 'first-product'
  // Phase 3: Core Data Setup
  | 'facilities-setup'
  | 'core-metrics'
  | 'data-entry-method'
  // Phase 4: First Insights
  | 'foundation-complete'
  // Phase 5: Power Features
  | 'feature-showcase'
  | 'invite-team'
  | 'completion'
  // Member-specific steps
  | 'member-welcome'
  | 'member-org-overview'
  | 'member-platform-tour'
  | 'member-completion'
  // Fast Track flow steps
  | 'fast-track-setup'
  | 'fast-track-products'
  | 'fast-track-facility'
  | 'fast-track-estimate'
  | 'fast-track-completion'

export interface OnboardingStepConfig {
  id: OnboardingStep
  phase: OnboardingPhase
  title: string
  description: string
  /** Whether this step can be skipped */
  skippable: boolean
  /** Index within the full step sequence (0-based) */
  index: number
}

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  // Phase 1
  { id: 'welcome-screen', phase: 'welcome', title: 'Welcome', description: 'Welcome to Alkatera', skippable: false, index: 0 },
  { id: 'meet-rosa', phase: 'welcome', title: 'Meet Rosa', description: 'Your sustainability guide', skippable: false, index: 1 },
  { id: 'personalization', phase: 'welcome', title: 'Personalization', description: 'Tell us about yourself', skippable: false, index: 2 },
  { id: 'company-basics', phase: 'welcome', title: 'Company Details', description: 'Add your company info', skippable: true, index: 3 },
  // Phase 2
  { id: 'roadmap', phase: 'quick-wins', title: 'Your Roadmap', description: 'Your sustainability journey', skippable: false, index: 4 },
  { id: 'preview-dashboard', phase: 'quick-wins', title: 'Preview', description: 'See your future dashboard', skippable: true, index: 5 },
  { id: 'connect-tools', phase: 'quick-wins', title: 'Connect Tools', description: 'Skip manual entry by connecting what you already use', skippable: true, index: 6 },
  { id: 'first-product', phase: 'quick-wins', title: 'First Product', description: 'Add your first product', skippable: true, index: 7 },
  // Phase 3
  { id: 'facilities-setup', phase: 'core-setup', title: 'Facilities', description: 'Map your operations', skippable: true, index: 8 },
  { id: 'core-metrics', phase: 'core-setup', title: 'Metrics', description: 'What will you track?', skippable: true, index: 9 },
  { id: 'data-entry-method', phase: 'core-setup', title: 'Data Entry', description: 'Choose how to add data', skippable: true, index: 10 },
  // Phase 4
  { id: 'foundation-complete', phase: 'first-insights', title: 'Insights', description: 'Your progress so far', skippable: false, index: 11 },
  // Phase 5
  { id: 'feature-showcase', phase: 'power-features', title: 'Features', description: 'Unlock capabilities', skippable: false, index: 12 },
  { id: 'invite-team', phase: 'power-features', title: 'Team', description: 'Invite colleagues', skippable: true, index: 13 },
  { id: 'completion', phase: 'power-features', title: 'Complete', description: 'You did it!', skippable: false, index: 14 },
]

/** Member onboarding: streamlined 6-step flow for invited team members */
export const MEMBER_ONBOARDING_STEPS: OnboardingStepConfig[] = [
  { id: 'member-welcome', phase: 'welcome', title: 'Welcome', description: 'Welcome to the team', skippable: false, index: 0 },
  { id: 'meet-rosa', phase: 'welcome', title: 'Meet Rosa', description: 'Your sustainability guide', skippable: false, index: 1 },
  { id: 'personalization', phase: 'welcome', title: 'Personalization', description: 'Tell us about yourself', skippable: false, index: 2 },
  { id: 'member-org-overview', phase: 'quick-wins', title: 'Your Organisation', description: 'Meet your sustainability hub', skippable: false, index: 3 },
  { id: 'member-platform-tour', phase: 'quick-wins', title: 'Platform Tour', description: 'What you can do', skippable: false, index: 4 },
  { id: 'member-completion', phase: 'quick-wins', title: 'Complete', description: 'You are all set!', skippable: false, index: 5 },
]

export const TOTAL_STEPS = ONBOARDING_STEPS.length
export const TOTAL_MEMBER_STEPS = MEMBER_ONBOARDING_STEPS.length

/** Fast Track onboarding: 6-step path that populates real account data */
export const FAST_TRACK_STEPS: OnboardingStepConfig[] = [
  { id: 'welcome-screen',        phase: 'welcome',        title: 'Welcome',         description: 'Welcome to alkatera',          skippable: false, index: 0 },
  { id: 'fast-track-setup',      phase: 'welcome',        title: 'Your Company',    description: 'Tell us about your business',  skippable: false, index: 1 },
  { id: 'fast-track-products',   phase: 'quick-wins',     title: 'Your Products',   description: 'Import or add products',       skippable: true,  index: 2 },
  { id: 'fast-track-facility',   phase: 'quick-wins',     title: 'Your Facility',   description: 'Where you produce',            skippable: true,  index: 3 },
  { id: 'fast-track-estimate',   phase: 'first-insights', title: 'Your Footprint',  description: 'Your instant estimate',        skippable: false, index: 4 },
  { id: 'fast-track-completion', phase: 'power-features', title: 'All Set',         description: 'Next steps to improve',        skippable: false, index: 5 },
]

export const TOTAL_FAST_TRACK_STEPS = FAST_TRACK_STEPS.length

/** Phases shown in the fast track top bar */
export const FAST_TRACK_PHASES: OnboardingPhase[] = ['welcome', 'quick-wins', 'first-insights', 'power-features']

export const PHASE_CONFIG: Record<OnboardingPhase, { label: string; duration: string; color: string }> = {
  'welcome': { label: 'Welcome & Orientation', duration: '~3 min', color: 'lime' },
  'quick-wins': { label: 'Quick Wins', duration: '~5 min', color: 'cyan' },
  'core-setup': { label: 'Core Data Setup', duration: '~8 min', color: 'purple' },
  'first-insights': { label: 'First Insights', duration: '~2 min', color: 'emerald' },
  'power-features': { label: 'Power Features', duration: '~2 min', color: 'lime' },
}

/** Phases used in the member onboarding flow */
export const MEMBER_PHASES: OnboardingPhase[] = ['welcome', 'quick-wins']

export type UserRole =
  | 'sustainability_manager'
  | 'operations_manager'
  | 'founder_executive'
  | 'production_manager'
  | 'consultant_advisor'
  | 'other'

export type BeverageType =
  | 'beer'
  | 'spirits'
  | 'wine'
  | 'cider'
  | 'non_alcoholic'
  | 'rtd'
  | 'other'

export type CompanySize =
  | '1-10'
  | '11-50'
  | '51-200'
  | '201-1000'
  | '1000+'

export type PrimaryGoal =
  | 'track_emissions'
  | 'reduce_impact'
  | 'sustainability_reporting'
  | 'get_certified'
  | 'supply_chain'
  | 'understand_footprint'
  | 'learning'

export type AnnualProductionBucket = '<10k' | '10k-100k' | '100k-1M' | '1M+'

export interface PersonalizationData {
  role?: UserRole
  roleOther?: string
  beverageTypes?: BeverageType[]
  beverageTypeOther?: string
  companySize?: CompanySize
  primaryGoals?: PrimaryGoal[]
  // Fast Track fields — all stored in personalization for estimate calculation
  /** Annual production volume bucket (used for footprint estimate) */
  annualProductionBucket?: AnnualProductionBucket
  /** Company website URL */
  websiteUrl?: string
  /** Country of operation */
  country?: string
  /** Year company was founded */
  foundingYear?: number
}

export interface OnboardingState {
  /** Whether the user has completed onboarding */
  completed: boolean
  /** Whether onboarding has been dismissed (user chose to skip) */
  dismissed: boolean
  /** Current step in the onboarding flow */
  currentStep: OnboardingStep
  /** Steps that have been completed */
  completedSteps: OnboardingStep[]
  /** Personalization answers */
  personalization: PersonalizationData
  /** Timestamp when onboarding was started */
  startedAt?: string
  /** Timestamp when onboarding was completed */
  completedAt?: string
  /** Whether the post-onboarding dashboard guide has been completed */
  dashboardGuideCompleted?: boolean
  /** Whether the ingredient/packaging search guide has been dismissed */
  searchGuideCompleted?: boolean
  /** Whether the product page guide has been completed */
  productGuideCompleted?: boolean
  /** Whether the emissions guide has been completed (all steps) */
  emissionsGuideCompleted?: boolean
  /** Whether the emissions guide has been dismissed by the user */
  emissionsGuideDismissed?: boolean
}

export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  completed: false,
  dismissed: false,
  currentStep: 'welcome-screen',
  completedSteps: [],
  personalization: {},
  dashboardGuideCompleted: false,
  searchGuideCompleted: false,
  productGuideCompleted: false,
  emissionsGuideCompleted: false,
  emissionsGuideDismissed: false,
}

export const INITIAL_MEMBER_ONBOARDING_STATE: OnboardingState = {
  completed: false,
  dismissed: false,
  currentStep: 'member-welcome',
  completedSteps: [],
  personalization: {},
  dashboardGuideCompleted: false,
  searchGuideCompleted: false,
  productGuideCompleted: false,
  emissionsGuideCompleted: false,
  emissionsGuideDismissed: false,
}

export const INITIAL_FAST_TRACK_STATE: OnboardingState = {
  completed: false,
  dismissed: false,
  currentStep: 'welcome-screen',
  completedSteps: [],
  personalization: {},
  dashboardGuideCompleted: false,
  searchGuideCompleted: false,
  productGuideCompleted: false,
  emissionsGuideCompleted: false,
  emissionsGuideDismissed: false,
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Get the steps array for the given flow */
export function getStepsForFlow(flow: OnboardingFlow): OnboardingStepConfig[] {
  if (flow === 'member') return MEMBER_ONBOARDING_STEPS
  if (flow === 'fast_track') return FAST_TRACK_STEPS
  return ONBOARDING_STEPS
}

/** Get the initial state for the given flow */
export function getInitialStateForFlow(flow: OnboardingFlow): OnboardingState {
  if (flow === 'member') return { ...INITIAL_MEMBER_ONBOARDING_STATE }
  if (flow === 'fast_track') return { ...INITIAL_FAST_TRACK_STATE }
  return { ...INITIAL_ONBOARDING_STATE }
}

/** Get step config — searches all step arrays */
export function getStepConfig(step: OnboardingStep): OnboardingStepConfig {
  const ownerStep = ONBOARDING_STEPS.find(s => s.id === step)
  if (ownerStep) return ownerStep
  const memberStep = MEMBER_ONBOARDING_STEPS.find(s => s.id === step)
  if (memberStep) return memberStep
  const fastTrackStep = FAST_TRACK_STEPS.find(s => s.id === step)
  if (fastTrackStep) return fastTrackStep
  // Fallback — should never happen
  return ONBOARDING_STEPS[0]
}

export function getPhaseSteps(phase: OnboardingPhase): OnboardingStepConfig[] {
  return ONBOARDING_STEPS.filter(s => s.phase === phase)
}

/** Get next step within the given flow */
export function getNextStep(currentStep: OnboardingStep, flow: OnboardingFlow = 'owner'): OnboardingStep | null {
  const steps = getStepsForFlow(flow)
  const idx = steps.findIndex(s => s.id === currentStep)
  if (idx === -1) return null
  const next = steps[idx + 1]
  return next?.id ?? null
}

/** Get previous step within the given flow */
export function getPreviousStep(currentStep: OnboardingStep, flow: OnboardingFlow = 'owner'): OnboardingStep | null {
  const steps = getStepsForFlow(flow)
  const idx = steps.findIndex(s => s.id === currentStep)
  if (idx <= 0) return null
  const prev = steps[idx - 1]
  return prev?.id ?? null
}

/** Get progress percentage within the given flow */
export function getProgressPercentage(currentStep: OnboardingStep, flow: OnboardingFlow = 'owner'): number {
  const steps = getStepsForFlow(flow)
  const idx = steps.findIndex(s => s.id === currentStep)
  if (idx === -1) return 0
  return Math.round(((idx + 1) / steps.length) * 100)
}

export function isPhaseComplete(phase: OnboardingPhase, completedSteps: OnboardingStep[]): boolean {
  const phaseSteps = getPhaseSteps(phase)
  return phaseSteps.every(s => completedSteps.includes(s.id))
}
