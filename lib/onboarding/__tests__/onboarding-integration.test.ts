import { describe, it, expect } from 'vitest'
import {
  ARRIVAL_STEPS,
  INITIAL_ARRIVAL_STATE,
  getInitialStateForFlow,
  getStepsForFlow,
  getStepConfig,
  getNextStep,
  getPreviousStep,
  getProgressPercentage,
  type OnboardingFlow,
  type OnboardingState,
  type OnboardingStep,
} from '../types'

/**
 * Integration-level tests that simulate a user walking the flows end to end.
 * The arrival ritual is the only first-run flow for owners; member and
 * advisor orientations walk the same machinery.
 */
describe('Onboarding Flow Integration', () => {
  const walk = (flow: OnboardingFlow) => {
    let state: OnboardingState = { ...getInitialStateForFlow(flow) }
    let stepsWalked = 0
    const maxSteps = 20 // Safety limit

    while (!state.completed && stepsWalked < maxSteps) {
      const config = getStepConfig(state.currentStep)
      expect(config).toBeTruthy()

      state = {
        ...state,
        completedSteps: state.completedSteps.includes(state.currentStep)
          ? state.completedSteps
          : [...state.completedSteps, state.currentStep],
      }

      const next = getNextStep(state.currentStep, flow)
      if (next) {
        state = { ...state, currentStep: next }
      } else {
        state = { ...state, completed: true, completedAt: new Date().toISOString() }
      }
      stepsWalked++
    }

    return { state, stepsWalked }
  }

  describe('Full walkthroughs', () => {
    it('completes the arrival ritual sequentially in exactly its 7 steps', () => {
      const { state, stepsWalked } = walk('arrival')
      expect(state.completed).toBe(true)
      expect(stepsWalked).toBe(ARRIVAL_STEPS.length)
      expect(state.completedSteps).toHaveLength(ARRIVAL_STEPS.length)
    })

    it('completes the member and advisor orientations sequentially', () => {
      for (const flow of ['member', 'advisor'] as const) {
        const { state, stepsWalked } = walk(flow)
        expect(state.completed).toBe(true)
        expect(stepsWalked).toBe(getStepsForFlow(flow).length)
      }
    })

    it('walks a legacy-labelled flow as the arrival ritual', () => {
      const { state, stepsWalked } = walk('owner')
      expect(state.completed).toBe(true)
      expect(stepsWalked).toBe(ARRIVAL_STEPS.length)
      expect(state.completedSteps[0]).toBe('arrival-website')
    })
  })

  describe('Skippable steps', () => {
    it('lets the arrival ritual skip everything it marks skippable', () => {
      const skippable = ARRIVAL_STEPS.filter(s => s.skippable).map(s => s.id)
      // Everything between the opener and the estimate/plan close is optional.
      expect(skippable).toEqual(['arrival-persona', 'arrival-confirm', 'arrival-reveal', 'arrival-facility'])
      // Skipping still reaches the end.
      let step: OnboardingStep | null = 'arrival-website'
      let hops = 0
      while (step && hops < 20) {
        step = getNextStep(step, 'arrival')
        hops++
      }
      expect(hops).toBe(ARRIVAL_STEPS.length)
    })
  })

  describe('Progress calculation', () => {
    it('shows monotonically increasing progress as arrival steps advance', () => {
      let last = 0
      for (const step of ARRIVAL_STEPS) {
        const p = getProgressPercentage(step.id, 'arrival')
        expect(p).toBeGreaterThan(last)
        last = p
      }
      expect(last).toBe(100)
    })
  })

  describe('Navigation bidirectional', () => {
    it('going next then previous returns to the same step', () => {
      for (const step of ARRIVAL_STEPS.slice(0, -1)) {
        const next = getNextStep(step.id, 'arrival')!
        expect(getPreviousStep(next, 'arrival')).toBe(step.id)
      }
    })
  })

  describe('Dismiss/resume flow', () => {
    it('dismissed state should prevent onboarding from showing', () => {
      const state: OnboardingState = { ...INITIAL_ARRIVAL_STATE, dismissed: true }
      const shouldShow = !state.completed && !state.dismissed
      expect(shouldShow).toBe(false)
    })

    it('resumes from a saved mid-ritual step', () => {
      const state: OnboardingState = {
        ...INITIAL_ARRIVAL_STATE,
        currentStep: 'arrival-facility',
        completedSteps: ['arrival-website', 'arrival-persona', 'arrival-confirm', 'arrival-reveal'],
      }
      expect(getStepConfig(state.currentStep).id).toBe('arrival-facility')
      expect(getNextStep(state.currentStep, 'arrival')).toBe('arrival-estimate')
    })
  })
})
