/**
 * EPR Compliance Wizard — Types & Step Configuration
 *
 * Mirrors the pattern used by the onboarding wizard (lib/onboarding/types.ts)
 * but scoped to the EPR data-entry flow.
 */

// =============================================================================
// Phase & Step Types
// =============================================================================

export type EPRWizardPhase =
  | 'org-setup'          // Phase 1: Organisation Setup
  | 'packaging-data'     // Phase 2: Packaging Data
  | 'validate-generate'  // Phase 3: Validate & Generate
  | 'export-finish'      // Phase 4: Export & Finish

export type EPRWizardStep =
  // Phase 1: Organisation Setup
  | 'welcome'
  | 'registration'
  | 'obligation'
  | 'nation-split'
  // Phase 2: Packaging Data
  | 'defaults'
  | 'data-review'
  | 'bulk-edit'
  // Phase 3: Validate & Generate
  | 'validation'
  | 'generate'
  // Phase 4: Export & Finish
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
}

export const EPR_WIZARD_STEPS: EPRWizardStepConfig[] = [
  // Phase 1: Organisation Setup
  { id: 'welcome', phase: 'org-setup', title: 'Welcome', description: 'Rosa introduces EPR', skippable: false, index: 0 },
  { id: 'registration', phase: 'org-setup', title: 'Registration', description: 'RPD Organisation ID', skippable: true, index: 1 },
  { id: 'obligation', phase: 'org-setup', title: 'Obligation', description: 'Turnover & obligation size', skippable: false, index: 2 },
  { id: 'nation-split', phase: 'org-setup', title: 'Nation Split', description: 'Sales distribution by nation', skippable: true, index: 3 },
  // Phase 2: Packaging Data
  { id: 'defaults', phase: 'packaging-data', title: 'Defaults', description: 'Set default EPR values', skippable: true, index: 4 },
  { id: 'data-review', phase: 'packaging-data', title: 'Data Review', description: 'Check packaging completeness', skippable: false, index: 5 },
  { id: 'bulk-edit', phase: 'packaging-data', title: 'Bulk Edit', description: 'Update multiple items at once', skippable: true, index: 6 },
  // Phase 3: Validate & Generate
  { id: 'validation', phase: 'validate-generate', title: 'Validation', description: 'Final compliance check', skippable: false, index: 7 },
  { id: 'generate', phase: 'validate-generate', title: 'Generate', description: 'Create RPD submission', skippable: false, index: 8 },
  // Phase 4: Export & Finish
  { id: 'export-complete', phase: 'export-finish', title: 'Export', description: 'Download CSV & finish', skippable: false, index: 9 },
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
  'org-setup': { label: 'Organisation Setup', duration: '~3 min', color: 'emerald' },
  'packaging-data': { label: 'Packaging Data', duration: '~5 min', color: 'cyan' },
  'validate-generate': { label: 'Validate & Generate', duration: '~3 min', color: 'purple' },
  'export-finish': { label: 'Export & Finish', duration: '~2 min', color: 'lime' },
}

export const EPR_WIZARD_PHASES: EPRWizardPhase[] = [
  'org-setup',
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

// =============================================================================
// Rosa's Contextual Messages
// =============================================================================

export const ROSA_WIZARD_MESSAGES: Record<EPRWizardStep, string> = {
  'welcome':
    "Hi! I'm Rosa, your sustainability guide. EPR can feel overwhelming, but I'll walk you through it step by step. By the end, you'll have everything ready to submit to Defra. Let's get started!",
  'registration':
    "Your RPD Organisation ID is like your unique passport for the packaging data portal. You can find it in your RPD account — it's usually a 6-digit number. If you don't have one yet, you can skip this and add it later.",
  'obligation':
    "The UK government needs to know your size to determine your reporting requirements. Large producers (turnover over £2M and 50+ tonnes of packaging) report twice a year. Small producers report once.",
  'nation-split':
    "Because packaging fees differ across England, Scotland, Wales and Northern Ireland, we need to know where your products are sold. Don't worry — we can estimate this from your delivery data if you're not sure!",
  'defaults':
    "Setting defaults here saves you clicking the same values on every product. Most drinks brands are 'Brand Owner' selling primarily in one nation. You can always override these on individual products.",
  'data-review':
    "Here's where we check that every packaging item has the EPR fields filled in. Think of it as a pre-flight checklist before generating your submission. Items highlighted in amber need your attention.",
  'bulk-edit':
    "If many of your products share the same packaging activity or nation, you can set them all at once here. Much faster than editing one by one! Just tick the items you want to update.",
  'validation':
    "Nearly there! Let me check everything one last time. Green ticks mean you're good to go. If anything's missing, I'll tell you exactly what needs fixing.",
  'generate':
    "This is the exciting bit — we're creating your official RPD submission lines. These are the exact rows that will go into your Defra portal CSV file.",
  'export-complete':
    "Brilliant! Your RPD CSV is ready to download. You can upload this directly to the Defra portal. I've also recorded everything in your audit trail for your compliance records.",
}
