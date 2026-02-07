export { OnboardingProvider, useOnboarding } from './OnboardingContext'
export type {
  OnboardingPhase,
  OnboardingStep,
  OnboardingState,
  OnboardingStepConfig,
  PersonalizationData,
  UserRole,
  BeverageType,
  CompanySize,
  PrimaryGoal,
} from './types'
export {
  ONBOARDING_STEPS,
  TOTAL_STEPS,
  PHASE_CONFIG,
  INITIAL_ONBOARDING_STATE,
  getStepConfig,
  getPhaseSteps,
  getNextStep,
  getPreviousStep,
  getProgressPercentage,
  isPhaseComplete,
} from './types'
