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

import type { PlatformRoomKey } from '@/components/studio/platform-rooms'

export type OnboardingFlow = 'owner' | 'member' | 'fast_track' | 'advisor' | 'arrival'

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
  // Member-specific steps
  | 'member-welcome'
  | 'member-org-overview'
  | 'member-platform-tour'
  | 'member-completion'
  // Advisor-specific steps
  | 'advisor-welcome'
  | 'advisor-capabilities'
  | 'advisor-org-overview'
  | 'advisor-completion'
  // Fast Track flow steps
  | 'fast-track-setup'
  | 'fast-track-reveal'
  | 'fast-track-import'
  | 'fast-track-products'
  | 'fast-track-facility'
  | 'fast-track-estimate'
  | 'fast-track-target'
  | 'fast-track-completion'
  // Arrival flow steps — the 6-screen studio-language ritual for fresh
  // owners, now the front door itself (see tasks/arrival-front-door-plan.md).
  // 'arrival-welcome' and 'arrival-company' are retired but kept as valid
  // literals so old saved onboarding_state rows still type-check; the
  // OnboardingContext load path remaps them (see the compat shim there).
  | 'arrival-welcome'
  | 'arrival-website'
  | 'arrival-persona'
  | 'arrival-company'
  | 'arrival-confirm'
  | 'arrival-reveal'
  | 'arrival-facility'
  | 'arrival-estimate'
  | 'arrival-plan'

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

/**
 * @deprecated The 14-step owner flow. Superseded by ARRIVAL_STEPS (the arrival
 * ritual is the front door now). Kept only so in-flight users with an existing
 * `onboarding_flow='owner'` state can finish the flow they started; new owners
 * never get it. Do not extend — build on ARRIVAL_STEPS instead. Removal is a
 * later cleanup once no in-flight owner states remain.
 */
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

/** Member onboarding: streamlined 6-step flow for invited team members */
export const MEMBER_ONBOARDING_STEPS: OnboardingStepConfig[] = [
  { id: 'member-welcome', phase: 'welcome', title: 'Welcome', description: 'Welcome to the team', skippable: false, index: 0 },
  { id: 'meet-rosa', phase: 'welcome', title: 'Meet Rosa', description: 'Your sustainability guide', skippable: false, index: 1 },
  { id: 'personalization', phase: 'welcome', title: 'Personalization', description: 'Tell us about yourself', skippable: false, index: 2 },
  { id: 'member-org-overview', phase: 'quick-wins', title: 'Your Organisation', description: 'Meet your sustainability hub', skippable: false, index: 3 },
  { id: 'member-platform-tour', phase: 'quick-wins', title: 'Platform Tour', description: 'What you can do', skippable: false, index: 4 },
  { id: 'member-completion', phase: 'quick-wins', title: 'Complete', description: 'You are all set!', skippable: false, index: 5 },
]

/** Advisor onboarding: 4-step orientation for external sustainability advisors */
export const ADVISOR_ONBOARDING_STEPS: OnboardingStepConfig[] = [
  { id: 'advisor-welcome', phase: 'welcome', title: 'Welcome', description: 'You’re now an advisor', skippable: false, index: 0 },
  { id: 'advisor-capabilities', phase: 'welcome', title: 'Your Access', description: 'What you can do here', skippable: false, index: 1 },
  { id: 'advisor-org-overview', phase: 'quick-wins', title: 'Your Client', description: 'Who you’re advising', skippable: false, index: 2 },
  { id: 'advisor-completion', phase: 'quick-wins', title: 'Complete', description: 'Ready to advise', skippable: false, index: 3 },
]

export const TOTAL_STEPS = ONBOARDING_STEPS.length
export const TOTAL_MEMBER_STEPS = MEMBER_ONBOARDING_STEPS.length
export const TOTAL_ADVISOR_STEPS = ADVISOR_ONBOARDING_STEPS.length

/**
 * @deprecated The 8-step Fast Track flow. Superseded by ARRIVAL_STEPS, which
 * reuses several of this flow's step components (confirm/reveal/estimate) but
 * is the canonical front door. Kept for in-flight `onboarding_flow='fast_track'`
 * states only; new owners get the arrival ritual. Do not extend. Removal is a
 * later cleanup once no in-flight fast-track states remain.
 */
export const FAST_TRACK_STEPS: OnboardingStepConfig[] = [
  { id: 'welcome-screen',        phase: 'welcome',        title: 'Welcome',         description: 'Welcome to alkatera',          skippable: false, index: 0 },
  { id: 'fast-track-setup',      phase: 'welcome',        title: 'Your Company',    description: 'Tell us about your business',  skippable: false, index: 1 },
  { id: 'fast-track-reveal',     phase: 'welcome',        title: 'Here You Are',    description: 'What we found on your website', skippable: true, index: 2 },
  { id: 'fast-track-import',     phase: 'quick-wins',     title: 'Bring Your Data', description: 'Connect or import what you have', skippable: true, index: 3 },
  { id: 'fast-track-products',   phase: 'quick-wins',     title: 'Your Products',   description: 'Add or refine products',       skippable: true,  index: 4 },
  { id: 'fast-track-facility',   phase: 'quick-wins',     title: 'Your Facility',   description: 'Where you produce',            skippable: true,  index: 5 },
  { id: 'fast-track-estimate',   phase: 'first-insights', title: 'Your Footprint',  description: 'Your instant estimate',        skippable: false, index: 6 },
  { id: 'fast-track-target',     phase: 'first-insights', title: 'Your Target',     description: 'Set a reduction goal',         skippable: true,  index: 7 },
  { id: 'fast-track-completion', phase: 'power-features', title: 'All Set',         description: 'Next steps to improve',        skippable: false, index: 8 },
]

export const TOTAL_FAST_TRACK_STEPS = FAST_TRACK_STEPS.length

/** Phases shown in the fast track top bar */
export const FAST_TRACK_PHASES: OnboardingPhase[] = ['welcome', 'quick-wins', 'first-insights', 'power-features']

/**
 * Arrival onboarding: the 6-screen studio-language ritual that is now the
 * front door itself (see tasks/arrival-front-door-plan.md). Org creation
 * happens silently inside the first step, and the trial/plan choice moves to
 * the last step — there is no separate /create-organization or
 * /complete-subscription detour for a fresh owner. Reuses the fast-track
 * confirm/reveal/estimate step internals rather than rewriting them — only
 * the wrapper components and chrome are new. All six steps share a single
 * phase; the wizard renders a quiet mono step counter for this flow instead
 * of a phase bar.
 */
export const ARRIVAL_STEPS: OnboardingStepConfig[] = [
  { id: 'arrival-website',  phase: 'welcome', title: 'Welcome',       description: 'Where we can find you',        skippable: false, index: 0 },
  { id: 'arrival-persona',  phase: 'welcome', title: 'You',           description: 'What you do here',             skippable: true,  index: 1 },
  { id: 'arrival-confirm',  phase: 'welcome', title: 'Your Company',  description: 'Confirm what we found',        skippable: true,  index: 2 },
  { id: 'arrival-reveal',   phase: 'welcome', title: 'Here You Are',  description: 'What we found on your website', skippable: true, index: 3 },
  { id: 'arrival-facility', phase: 'welcome', title: 'Where You Make It', description: 'Your production site',      skippable: true,  index: 4 },
  { id: 'arrival-estimate', phase: 'welcome', title: 'Your Forest',   description: 'Your instant estimate',        skippable: false, index: 5 },
  { id: 'arrival-plan',     phase: 'welcome', title: 'Your Plan',     description: 'Start your trial',             skippable: false, index: 6 },
]

export const TOTAL_ARRIVAL_STEPS = ARRIVAL_STEPS.length

export const PHASE_CONFIG: Record<OnboardingPhase, { label: string; duration: string; color: string }> = {
  'welcome': { label: 'Welcome & Orientation', duration: '~3 min', color: 'lime' },
  'quick-wins': { label: 'Quick Wins', duration: '~5 min', color: 'cyan' },
  'core-setup': { label: 'Core Data Setup', duration: '~8 min', color: 'purple' },
  'first-insights': { label: 'First Insights', duration: '~2 min', color: 'emerald' },
  'power-features': { label: 'Power Features', duration: '~2 min', color: 'lime' },
}

/** Phases used in the member onboarding flow */
export const MEMBER_PHASES: OnboardingPhase[] = ['welcome', 'quick-wins']

/** Phases used in the advisor onboarding flow */
export const ADVISOR_PHASES: OnboardingPhase[] = ['welcome', 'quick-wins']

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
  | 'functional'
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

/**
 * The arrival flow's persona choice ("What do you do here?"). Matches
 * lib/rosa/useUserRole.ts's RosaPersona values (minus 'unknown', which is
 * never a user choice) so it writes straight into the rosa_memory 'persona'
 * key that hook already reads.
 */
export type PersonaChoice = 'operator' | 'finance' | 'leadership' | 'sustainability'

/**
 * A product found by the website scrape, carried through personalization to
 * the arrival flow's reveal step so it can be materialised as an is_draft
 * products row (the 5-step arrival flow has no import step to do it).
 * Field names mirror the products columns they map onto.
 */
export interface ScrapedProductDraft {
  name: string
  /** products.product_category (e.g. "Spirits"). Null when the scrape wasn't sure. */
  category?: string | null
  /** products.unit_size_value. Null when the site didn't state a size. */
  unitSizeValue?: number | null
  /** products.unit_size_unit ('ml' | 'cl' | 'l'). Null when unknown. */
  unitSizeUnit?: string | null
}

export interface PersonalizationData {
  role?: UserRole
  roleOther?: string
  beverageTypes?: BeverageType[]
  beverageTypeOther?: string
  companySize?: CompanySize
  primaryGoals?: PrimaryGoal[]
  /** "What do you do here?" — set on the arrival flow's persona step. */
  persona?: PersonaChoice
  // Fast Track fields — all stored in personalization for estimate calculation
  /** Annual production volume bucket (used for footprint estimate) */
  annualProductionBucket?: AnnualProductionBucket
  /** Company website URL */
  websiteUrl?: string
  /**
   * The product_import_jobs id for the background scrape ArrivalWebsiteStep
   * kicked off. Lets the arrival-confirm screen (FastTrackSetupStep in
   * confirm mode) resume polling the same job instead of starting a second
   * scrape of the same site.
   */
  scrapeJobId?: string
  /** Brand colour scraped from the website (or confirmed by the user). */
  brandColour?: string
  /** Brand logo URL scraped from the website. */
  brandLogoUrl?: string
  /** Product names found on the website (shown on the reveal step). */
  scrapedProductNames?: string[]
  /**
   * Full product drafts found on the website, for the reveal step to insert
   * as is_draft products. Superset of scrapedProductNames, which is kept for
   * back-compat with state saved before this field existed.
   */
  scrapedProducts?: ScrapedProductDraft[]
  /** Country of operation */
  country?: string
  /** Year company was founded */
  foundingYear?: number
  /**
   * Registered-entity facts from Companies House (UK), fetched alongside the
   * website scrape on the arrival flow. Shown as "From Companies House."
   * confirmations; the registered address pre-fills the facility step.
   */
  companiesHouse?: {
    companyNumber: string
    name: string
    incorporationYear?: number
    country?: string
    registeredAddress?: {
      line1?: string
      city?: string
      postalCode?: string
      country?: string
    }
  }
  /** The first facility, created in the arrival ritual's facility step. Lights
   * the workbench room and gives the estimate step a real country grid factor. */
  facilityId?: string
  /** Facility country (human-readable label), for the estimate's grid factor. */
  facilityCountry?: string
  /** Last estimated footprint in tonnes CO₂e/year. Set by the estimate step. */
  estimateTonnesCO2e?: number
  /** First sustainability target: % reduction from the estimate baseline. */
  targetReductionPct?: number
  /** First sustainability target: target year (e.g. 2030). */
  targetYear?: number
  /**
   * Slugs of import-step tiles the user has already completed. Persisted so
   * an OAuth round-trip (Breww, Xero) doesn't lose the green-tick UI state
   * when the component remounts.
   */
  importedSources?: string[]
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
  /** Whether the recipe sidebar first-run tour has been completed (or skipped) */
  recipeSidebarTourCompleted?: boolean
  /** Whether the factor-info hover hint coachmark has been seen/dismissed */
  factorInfoHintCompleted?: boolean
  /**
   * Phase 2 — room-segmented onboarding (components/studio/room-setup-panel.tsx).
   * Per-room intro/checklist state, keyed by the room the user is standing
   * in. Additive and optional so existing saved states keep loading.
   */
  rooms?: Partial<Record<PlatformRoomKey, RoomOnboardingState>>
  /**
   * Phase 2 — coachmark dismissals (components/studio/coachmark.tsx), keyed
   * by the coachmark's own id. Additive and optional.
   */
  coachmarks?: Record<string, boolean>
}

/** Per-room onboarding state: has the first-visit intro been shown, has the checklist been hidden. */
export interface RoomOnboardingState {
  introSeen?: boolean
  checklistDismissed?: boolean
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
  recipeSidebarTourCompleted: false,
  factorInfoHintCompleted: false,
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
  recipeSidebarTourCompleted: false,
  factorInfoHintCompleted: false,
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
  recipeSidebarTourCompleted: false,
  factorInfoHintCompleted: false,
}

export const INITIAL_ARRIVAL_STATE: OnboardingState = {
  completed: false,
  dismissed: false,
  currentStep: 'arrival-website',
  completedSteps: [],
  personalization: {},
  dashboardGuideCompleted: false,
  searchGuideCompleted: false,
  productGuideCompleted: false,
  emissionsGuideCompleted: false,
  emissionsGuideDismissed: false,
  recipeSidebarTourCompleted: false,
  factorInfoHintCompleted: false,
}

export const INITIAL_ADVISOR_ONBOARDING_STATE: OnboardingState = {
  completed: false,
  dismissed: false,
  currentStep: 'advisor-welcome',
  completedSteps: [],
  personalization: {},
  dashboardGuideCompleted: false,
  searchGuideCompleted: false,
  productGuideCompleted: false,
  emissionsGuideCompleted: false,
  emissionsGuideDismissed: false,
  recipeSidebarTourCompleted: false,
  factorInfoHintCompleted: false,
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Get the steps array for the given flow */
export function getStepsForFlow(flow: OnboardingFlow): OnboardingStepConfig[] {
  if (flow === 'member') return MEMBER_ONBOARDING_STEPS
  if (flow === 'fast_track') return FAST_TRACK_STEPS
  if (flow === 'advisor') return ADVISOR_ONBOARDING_STEPS
  if (flow === 'arrival') return ARRIVAL_STEPS
  return ONBOARDING_STEPS
}

/** Get the initial state for the given flow */
export function getInitialStateForFlow(flow: OnboardingFlow): OnboardingState {
  if (flow === 'member') return { ...INITIAL_MEMBER_ONBOARDING_STATE }
  if (flow === 'fast_track') return { ...INITIAL_FAST_TRACK_STATE }
  if (flow === 'advisor') return { ...INITIAL_ADVISOR_ONBOARDING_STATE }
  if (flow === 'arrival') return { ...INITIAL_ARRIVAL_STATE }
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
  const advisorStep = ADVISOR_ONBOARDING_STEPS.find(s => s.id === step)
  if (advisorStep) return advisorStep
  const arrivalStep = ARRIVAL_STEPS.find(s => s.id === step)
  if (arrivalStep) return arrivalStep
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
