/**
 * Onboarding Wizard Types
 *
 * Defines the five-phase onboarding journey for new Alkatera users.
 * Based on the ALKATERA_ONBOARDING_PLAN_2026.md specification.
 */

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
  { id: 'first-product', phase: 'quick-wins', title: 'First Product', description: 'Add your first product', skippable: true, index: 6 },
  // Phase 3
  { id: 'facilities-setup', phase: 'core-setup', title: 'Facilities', description: 'Map your operations', skippable: true, index: 7 },
  { id: 'core-metrics', phase: 'core-setup', title: 'Metrics', description: 'What will you track?', skippable: true, index: 8 },
  { id: 'data-entry-method', phase: 'core-setup', title: 'Data Entry', description: 'Choose how to add data', skippable: true, index: 9 },
  // Phase 4
  { id: 'foundation-complete', phase: 'first-insights', title: 'Insights', description: 'Your progress so far', skippable: false, index: 10 },
  // Phase 5
  { id: 'feature-showcase', phase: 'power-features', title: 'Features', description: 'Unlock capabilities', skippable: false, index: 11 },
  { id: 'invite-team', phase: 'power-features', title: 'Team', description: 'Invite colleagues', skippable: true, index: 12 },
  { id: 'completion', phase: 'power-features', title: 'Complete', description: 'You did it!', skippable: false, index: 13 },
]

export const TOTAL_STEPS = ONBOARDING_STEPS.length

export const PHASE_CONFIG: Record<OnboardingPhase, { label: string; duration: string; color: string }> = {
  'welcome': { label: 'Welcome & Orientation', duration: '~3 min', color: 'lime' },
  'quick-wins': { label: 'Quick Wins', duration: '~5 min', color: 'cyan' },
  'core-setup': { label: 'Core Data Setup', duration: '~8 min', color: 'purple' },
  'first-insights': { label: 'First Insights', duration: '~2 min', color: 'emerald' },
  'power-features': { label: 'Power Features', duration: '~2 min', color: 'lime' },
}

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

export interface PersonalizationData {
  role?: UserRole
  roleOther?: string
  beverageTypes?: BeverageType[]
  beverageTypeOther?: string
  companySize?: CompanySize
  primaryGoals?: PrimaryGoal[]
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
}

export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  completed: false,
  dismissed: false,
  currentStep: 'welcome-screen',
  completedSteps: [],
  personalization: {},
}

export function getStepConfig(step: OnboardingStep): OnboardingStepConfig {
  return ONBOARDING_STEPS.find(s => s.id === step)!
}

export function getPhaseSteps(phase: OnboardingPhase): OnboardingStepConfig[] {
  return ONBOARDING_STEPS.filter(s => s.phase === phase)
}

export function getNextStep(currentStep: OnboardingStep): OnboardingStep | null {
  const config = getStepConfig(currentStep)
  const next = ONBOARDING_STEPS[config.index + 1]
  return next?.id ?? null
}

export function getPreviousStep(currentStep: OnboardingStep): OnboardingStep | null {
  const config = getStepConfig(currentStep)
  const prev = ONBOARDING_STEPS[config.index - 1]
  return prev?.id ?? null
}

export function getProgressPercentage(currentStep: OnboardingStep): number {
  const config = getStepConfig(currentStep)
  return Math.round(((config.index + 1) / TOTAL_STEPS) * 100)
}

export function isPhaseComplete(phase: OnboardingPhase, completedSteps: OnboardingStep[]): boolean {
  const phaseSteps = getPhaseSteps(phase)
  return phaseSteps.every(s => completedSteps.includes(s.id))
}
