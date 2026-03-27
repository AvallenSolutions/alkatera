/**
 * EPR Compliance Wizard — Types & Step Configuration
 *
 * Mirrors the pattern used by the onboarding wizard (lib/onboarding/types.ts)
 * but scoped to the EPR data-entry flow.
 *
 * 5 phases, 16 steps — includes HMRC registration template data collection.
 */

// =============================================================================
// Phase & Step Types
// =============================================================================

export type EPRWizardPhase =
  | 'org-setup'            // Phase 1: Organisation Setup
  | 'hmrc-registration'    // Phase 2: HMRC Registration
  | 'packaging-data'       // Phase 3: Packaging Data
  | 'validate-generate'    // Phase 4: Validate & Generate
  | 'export-finish'        // Phase 5: Export & Finish

export type EPRWizardStep =
  // Phase 1: Organisation Setup
  | 'welcome'
  | 'registration'
  | 'company-details'
  | 'packaging-activities'
  | 'obligation'
  | 'nation-split'
  // Phase 2: HMRC Registration
  | 'addresses'
  | 'contacts'
  | 'brands'
  | 'partners'
  // Phase 3: Packaging Data
  | 'defaults'
  | 'data-review'
  | 'bulk-edit'
  // Phase 4: Validate & Generate
  | 'validation'
  | 'generate'
  // Phase 5: Export & Finish
  | 'export-complete'

// =============================================================================
// Step Configuration
// =============================================================================

export interface EPRWizardStepConfig {
  id: EPRWizardStep
  phase: EPRWizardPhase
  title: string
  description: string
  /** Whether this step can be skipped */
  skippable: boolean
  /** Index within the full step sequence (0-based) */
  index: number
  /** Whether this step should be conditionally skipped based on org data */
  conditionalSkip?: 'partners-only'
}

export const EPR_WIZARD_STEPS: EPRWizardStepConfig[] = [
  // Phase 1: Organisation Setup
  { id: 'welcome', phase: 'org-setup', title: 'Welcome', description: 'Rosa introduces EPR', skippable: false, index: 0 },
  { id: 'registration', phase: 'org-setup', title: 'Registration', description: 'RPD Organisation ID', skippable: true, index: 1 },
  { id: 'company-details', phase: 'org-setup', title: 'Company Details', description: 'Companies House & SIC code', skippable: false, index: 2 },
  { id: 'packaging-activities', phase: 'org-setup', title: 'Activities', description: 'Packaging activity types', skippable: false, index: 3 },
  { id: 'obligation', phase: 'org-setup', title: 'Obligation', description: 'Turnover & obligation size', skippable: false, index: 4 },
  { id: 'nation-split', phase: 'org-setup', title: 'Nation Split', description: 'Sales distribution by nation', skippable: true, index: 5 },
  // Phase 2: HMRC Registration
  { id: 'addresses', phase: 'hmrc-registration', title: 'Addresses', description: 'Business addresses', skippable: false, index: 6 },
  { id: 'contacts', phase: 'hmrc-registration', title: 'Contacts', description: 'Key contact persons', skippable: false, index: 7 },
  { id: 'brands', phase: 'hmrc-registration', title: 'Brands', description: 'Brand names you sell under', skippable: false, index: 8 },
  { id: 'partners', phase: 'hmrc-registration', title: 'Partners', description: 'Partnership members', skippable: true, index: 9, conditionalSkip: 'partners-only' },
  // Phase 3: Packaging Data
  { id: 'defaults', phase: 'packaging-data', title: 'Defaults', description: 'Set default EPR values', skippable: true, index: 10 },
  { id: 'data-review', phase: 'packaging-data', title: 'Data Review', description: 'Check packaging completeness', skippable: false, index: 11 },
  { id: 'bulk-edit', phase: 'packaging-data', title: 'Bulk Edit', description: 'Update multiple items at once', skippable: true, index: 12 },
  // Phase 4: Validate & Generate
  { id: 'validation', phase: 'validate-generate', title: 'Validation', description: 'Final compliance check', skippable: false, index: 13 },
  { id: 'generate', phase: 'validate-generate', title: 'Generate', description: 'Create RPD submission', skippable: false, index: 14 },
  // Phase 5: Export & Finish
  { id: 'export-complete', phase: 'export-finish', title: 'Export', description: 'Download CSVs & finish', skippable: false, index: 15 },
]

export const TOTAL_EPR_WIZARD_STEPS = EPR_WIZARD_STEPS.length

// =============================================================================
// Phase Configuration
// =============================================================================

export const EPR_WIZARD_PHASE_CONFIG: Record<EPRWizardPhase, {
  label: string
  duration: string
  color: string
}> = {
  'org-setup': { label: 'Organisation Setup', duration: '~4 min', color: 'emerald' },
  'hmrc-registration': { label: 'HMRC Registration', duration: '~5 min', color: 'amber' },
  'packaging-data': { label: 'Packaging Data', duration: '~5 min', color: 'cyan' },
  'validate-generate': { label: 'Validate & Generate', duration: '~3 min', color: 'purple' },
  'export-finish': { label: 'Export & Finish', duration: '~2 min', color: 'lime' },
}

export const EPR_WIZARD_PHASES: EPRWizardPhase[] = [
  'org-setup',
  'hmrc-registration',
  'packaging-data',
  'validate-generate',
  'export-finish',
]

// =============================================================================
// Wizard State
// =============================================================================

export interface EPRWizardState {
  /** Whether the wizard has been completed */
  completed: boolean
  /** Whether the wizard has been dismissed (user chose to skip) */
  dismissed: boolean
  /** Current step in the wizard */
  currentStep: EPRWizardStep
  /** Steps that have been completed */
  completedSteps: EPRWizardStep[]
  /** Timestamp when the wizard was started */
  startedAt?: string
  /** Timestamp when the wizard was completed */
  completedAt?: string
}

export const INITIAL_EPR_WIZARD_STATE: EPRWizardState = {
  completed: false,
  dismissed: false,
  currentStep: 'welcome',
  completedSteps: [],
}

// =============================================================================
// Helper Functions
// =============================================================================

export function getEPRWizardStepConfig(step: EPRWizardStep): EPRWizardStepConfig {
  return EPR_WIZARD_STEPS.find(s => s.id === step)!
}

export function getEPRWizardPhaseSteps(phase: EPRWizardPhase): EPRWizardStepConfig[] {
  return EPR_WIZARD_STEPS.filter(s => s.phase === phase)
}

export function getNextEPRWizardStep(currentStep: EPRWizardStep): EPRWizardStep | null {
  const config = getEPRWizardStepConfig(currentStep)
  const next = EPR_WIZARD_STEPS[config.index + 1]
  return next?.id ?? null
}

export function getPreviousEPRWizardStep(currentStep: EPRWizardStep): EPRWizardStep | null {
  const config = getEPRWizardStepConfig(currentStep)
  const prev = EPR_WIZARD_STEPS[config.index - 1]
  return prev?.id ?? null
}

export function getEPRWizardProgress(currentStep: EPRWizardStep): number {
  const config = getEPRWizardStepConfig(currentStep)
  return Math.round(((config.index + 1) / TOTAL_EPR_WIZARD_STEPS) * 100)
}

export function isEPRWizardPhaseComplete(
  phase: EPRWizardPhase,
  completedSteps: EPRWizardStep[]
): boolean {
  const phaseSteps = getEPRWizardPhaseSteps(phase)
  return phaseSteps.every(s => completedSteps.includes(s.id))
}

/**
 * Determines whether a step should be auto-skipped based on org data.
 * Currently only 'partners' is conditionally skipped (non-partnership orgs).
 */
export function shouldAutoSkipStep(
  step: EPRWizardStepConfig,
  orgTypeCode?: string
): boolean {
  if (step.conditionalSkip === 'partners-only') {
    return orgTypeCode !== 'PAR'
  }
  return false
}

// =============================================================================
// Rosa's Contextual Messages
// =============================================================================

export const ROSA_WIZARD_MESSAGES: Record<EPRWizardStep, string> = {
  'welcome':
    "Hi! I'm Rosa, your sustainability guide. EPR can feel overwhelming, but I'll walk you through it step by step. By the end, you'll have everything ready to submit to Defra. Let's get started!",
  'registration':
    "Your RPD Organisation ID is like your unique passport for the packaging data portal. You can find it in your RPD account, it's usually a 6-digit number. If you don't have one yet, you can skip this and add it later.",
  'company-details':
    "We need a few details about your company to complete the HMRC registration template. Your Companies House number is the 8-digit number on your certificate of incorporation. Most drinks businesses use SIC codes starting with 11 (manufacturing) or 46.34 (wholesale).",
  'packaging-activities':
    "HMRC needs to know what packaging activities your business carries out. Most drinks brands only need 'Sold (Brand Owner)' as their primary activity. If you also import products, tick 'Imported' too.",
  'obligation':
    "The UK government needs to know your size to determine your reporting requirements. Large producers (turnover over £2M and 50+ tonnes of packaging) report twice a year. Small producers report once.",
  'nation-split':
    "Because packaging fees differ across England, Scotland, Wales and Northern Ireland, we need to know where your products are sold. Don't worry, we can estimate this from your delivery data if you're not sure!",
  'addresses':
    "HMRC needs up to four addresses for your registration. Most small businesses use the same address for all of them, so we've added a handy 'Same as registered address' option to save you time.",
  'contacts':
    "We need the details of key people in your organisation for the HMRC registration. The 'Approved Person' is whoever signs off on your EPR compliance, and the 'Primary Contact' is your day-to-day point of contact for correspondence.",
  'brands':
    "List every brand name you sell products under. We've pre-filled this from your product catalogue. A 'brand' is any name, trademark, or identifier that appears on your packaging.",
  'partners':
    "As a partnership, HMRC requires the details of each individual partner. Please add all partners registered with Companies House.",
  'defaults':
    "Setting defaults here saves you clicking the same values on every product. Most drinks brands are 'Brand Owner' selling primarily in one nation. You can always override these on individual products.",
  'data-review':
    "Here's where we check that every packaging item has the EPR fields filled in. Think of it as a pre-flight checklist before generating your submission. Items highlighted in amber need your attention.",
  'bulk-edit':
    "If many of your products share the same packaging activity or nation, you can set them all at once here. Much faster than editing one by one! Just tick the items you want to update.",
  'validation':
    "Nearly there! Let me check everything one last time, both your packaging data and HMRC registration details. Green ticks mean you're good to go. If anything's missing, I'll tell you exactly what needs fixing.",
  'generate':
    "This is the exciting bit, we're creating your official RPD submission lines. These are the exact rows that will go into your Defra portal CSV file.",
  'export-complete':
    "Brilliant! Your files are ready to download: packaging data CSV, organisation details, brand details, and (if applicable) partner details. Upload these directly to the Defra portal. Everything's been recorded in your audit trail.",
}
