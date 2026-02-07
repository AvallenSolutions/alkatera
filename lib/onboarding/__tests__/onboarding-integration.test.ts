import { describe, it, expect } from 'vitest'
import {
  ONBOARDING_STEPS,
  INITIAL_ONBOARDING_STATE,
  getStepConfig,
  getNextStep,
  getPreviousStep,
  getProgressPercentage,
  isPhaseComplete,
  getPhaseSteps,
  type OnboardingState,
  type OnboardingStep,
} from '../types'

/**
 * Integration-level tests that verify the onboarding flow logic works correctly
 * when simulating a user walking through all steps.
 */
describe('Onboarding Flow Integration', () => {
  describe('Full wizard walkthrough', () => {
    it('should be possible to complete the entire wizard sequentially', () => {
      let state: OnboardingState = { ...INITIAL_ONBOARDING_STATE }
      let stepsWalked = 0
      const maxSteps = 20 // Safety limit

      while (!state.completed && stepsWalked < maxSteps) {
        const config = getStepConfig(state.currentStep)
        expect(config).toBeTruthy()

        // "Complete" the step
        state = {
          ...state,
          completedSteps: state.completedSteps.includes(state.currentStep)
            ? state.completedSteps
            : [...state.completedSteps, state.currentStep],
        }

        const next = getNextStep(state.currentStep)
        if (next) {
          state = { ...state, currentStep: next }
        } else {
          // Last step reached
          state = { ...state, completed: true, completedAt: new Date().toISOString() }
        }
        stepsWalked++
      }

      expect(state.completed).toBe(true)
      expect(stepsWalked).toBe(14) // Exactly 14 steps
      expect(state.completedSteps).toHaveLength(14)
    })

    it('should be possible to skip skippable steps', () => {
      let state: OnboardingState = { ...INITIAL_ONBOARDING_STATE }
      let stepsWalked = 0
      const skippedSteps: OnboardingStep[] = []

      while (!state.completed && stepsWalked < 20) {
        const config = getStepConfig(state.currentStep)

        if (config.skippable) {
          // Skip this step (don't add to completedSteps)
          skippedSteps.push(state.currentStep)
        } else {
          // Complete the step
          state = {
            ...state,
            completedSteps: [...state.completedSteps, state.currentStep],
          }
        }

        const next = getNextStep(state.currentStep)
        if (next) {
          state = { ...state, currentStep: next }
        } else {
          state = { ...state, completed: true }
        }
        stepsWalked++
      }

      expect(state.completed).toBe(true)
      // Should have skipped some steps
      expect(skippedSteps.length).toBeGreaterThan(0)
      // Skipped steps should all be skippable
      for (const s of skippedSteps) {
        expect(getStepConfig(s).skippable).toBe(true)
      }
      // Completed steps count should be less than total
      expect(state.completedSteps.length).toBeLessThan(14)
    })
  })

  describe('Phase completion tracking', () => {
    it('should track when welcome phase is complete', () => {
      const completedSteps: OnboardingStep[] = [
        'welcome-screen', 'meet-rosa', 'personalization', 'company-basics'
      ]
      expect(isPhaseComplete('welcome', completedSteps)).toBe(true)
      expect(isPhaseComplete('quick-wins', completedSteps)).toBe(false)
    })

    it('should track progressive phase completion', () => {
      const allSteps: OnboardingStep[] = ONBOARDING_STEPS.map(s => s.id)
      const phases = ['welcome', 'quick-wins', 'core-setup', 'first-insights', 'power-features'] as const

      // Complete steps one by one and check phase completion
      const completed: OnboardingStep[] = []
      for (const step of allSteps) {
        completed.push(step)

        // Check which phases are now complete
        for (const phase of phases) {
          const phaseSteps = getPhaseSteps(phase)
          const shouldBeComplete = phaseSteps.every(s => completed.includes(s.id))
          expect(isPhaseComplete(phase, completed)).toBe(shouldBeComplete)
        }
      }
    })
  })

  describe('Progress calculation', () => {
    it('should show monotonically increasing progress as steps advance', () => {
      let prevProgress = 0
      let step: OnboardingStep | null = 'welcome-screen'

      while (step) {
        const progress = getProgressPercentage(step)
        expect(progress).toBeGreaterThanOrEqual(prevProgress)
        prevProgress = progress
        step = getNextStep(step)
      }
    })

    it('should reach 100% at the completion step', () => {
      expect(getProgressPercentage('completion')).toBe(100)
    })
  })

  describe('Navigation bidirectional', () => {
    it('going next then previous should return to the same step', () => {
      for (const step of ONBOARDING_STEPS) {
        if (step.index === 0 || step.index === ONBOARDING_STEPS.length - 1) continue

        const next = getNextStep(step.id)
        if (next) {
          const backToOriginal = getPreviousStep(next)
          expect(backToOriginal).toBe(step.id)
        }
      }
    })

    it('going previous then next should return to the same step', () => {
      for (const step of ONBOARDING_STEPS) {
        if (step.index === 0) continue

        const prev = getPreviousStep(step.id)
        if (prev) {
          const backToOriginal = getNextStep(prev)
          expect(backToOriginal).toBe(step.id)
        }
      }
    })
  })

  describe('Step configuration completeness', () => {
    it('all steps should have title and description', () => {
      for (const step of ONBOARDING_STEPS) {
        expect(step.title).toBeTruthy()
        expect(step.title.length).toBeGreaterThan(0)
        expect(step.description).toBeTruthy()
        expect(step.description.length).toBeGreaterThan(0)
      }
    })

    it('first and last steps should not be skippable', () => {
      expect(getStepConfig('welcome-screen').skippable).toBe(false)
      expect(getStepConfig('completion').skippable).toBe(false)
    })

    it('personalization step should not be skippable', () => {
      expect(getStepConfig('personalization').skippable).toBe(false)
    })

    it('company-basics, first-product, facilities-setup should be skippable', () => {
      expect(getStepConfig('company-basics').skippable).toBe(true)
      expect(getStepConfig('first-product').skippable).toBe(true)
      expect(getStepConfig('facilities-setup').skippable).toBe(true)
    })
  })

  describe('Dismiss/resume flow', () => {
    it('dismissed state should prevent onboarding from showing', () => {
      const state: OnboardingState = {
        ...INITIAL_ONBOARDING_STATE,
        dismissed: true,
        currentStep: 'personalization',
      }
      // The context checks !completed && !dismissed
      expect(state.completed || state.dismissed).toBe(true)
    })

    it('should be possible to resume from a saved step', () => {
      const savedState: OnboardingState = {
        completed: false,
        dismissed: false,
        currentStep: 'facilities-setup',
        completedSteps: ['welcome-screen', 'meet-rosa', 'personalization', 'company-basics', 'roadmap', 'preview-dashboard', 'first-product'],
        personalization: {
          role: 'sustainability_manager',
          beverageTypes: ['spirits'],
          companySize: '11-50',
          primaryGoals: ['track_emissions', 'reduce_impact'],
        },
        startedAt: '2026-02-01T10:00:00Z',
      }

      // Should be at facilities-setup
      expect(savedState.currentStep).toBe('facilities-setup')
      expect(getStepConfig(savedState.currentStep).phase).toBe('core-setup')

      // Progress should reflect current position
      const progress = getProgressPercentage(savedState.currentStep)
      expect(progress).toBeGreaterThan(50)

      // Next step should be core-metrics
      expect(getNextStep(savedState.currentStep)).toBe('core-metrics')
    })
  })
})
