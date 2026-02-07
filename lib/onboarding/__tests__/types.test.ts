import { describe, it, expect } from 'vitest'
import {
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
  type OnboardingStep,
  type OnboardingPhase,
} from '../types'

describe('Onboarding Types & Utilities', () => {
  describe('ONBOARDING_STEPS', () => {
    it('should have 14 total steps', () => {
      expect(ONBOARDING_STEPS).toHaveLength(14)
      expect(TOTAL_STEPS).toBe(14)
    })

    it('should have consecutive indices starting from 0', () => {
      ONBOARDING_STEPS.forEach((step, i) => {
        expect(step.index).toBe(i)
      })
    })

    it('should have unique step IDs', () => {
      const ids = ONBOARDING_STEPS.map(s => s.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('should cover all 5 phases', () => {
      const phases = new Set(ONBOARDING_STEPS.map(s => s.phase))
      expect(phases.size).toBe(5)
      expect(phases.has('welcome')).toBe(true)
      expect(phases.has('quick-wins')).toBe(true)
      expect(phases.has('core-setup')).toBe(true)
      expect(phases.has('first-insights')).toBe(true)
      expect(phases.has('power-features')).toBe(true)
    })

    it('should have phases in sequential order', () => {
      const phaseOrder: OnboardingPhase[] = ['welcome', 'quick-wins', 'core-setup', 'first-insights', 'power-features']
      let lastPhaseIndex = -1
      for (const step of ONBOARDING_STEPS) {
        const phaseIndex = phaseOrder.indexOf(step.phase)
        expect(phaseIndex).toBeGreaterThanOrEqual(lastPhaseIndex)
        lastPhaseIndex = phaseIndex
      }
    })
  })

  describe('PHASE_CONFIG', () => {
    it('should have configuration for all 5 phases', () => {
      expect(Object.keys(PHASE_CONFIG)).toHaveLength(5)
    })

    it('should have label, duration, and color for each phase', () => {
      for (const [, config] of Object.entries(PHASE_CONFIG)) {
        expect(config.label).toBeTruthy()
        expect(config.duration).toBeTruthy()
        expect(config.color).toBeTruthy()
      }
    })
  })

  describe('INITIAL_ONBOARDING_STATE', () => {
    it('should start with welcome-screen step', () => {
      expect(INITIAL_ONBOARDING_STATE.currentStep).toBe('welcome-screen')
    })

    it('should not be completed or dismissed', () => {
      expect(INITIAL_ONBOARDING_STATE.completed).toBe(false)
      expect(INITIAL_ONBOARDING_STATE.dismissed).toBe(false)
    })

    it('should have empty completed steps', () => {
      expect(INITIAL_ONBOARDING_STATE.completedSteps).toEqual([])
    })

    it('should have empty personalization data', () => {
      expect(INITIAL_ONBOARDING_STATE.personalization).toEqual({})
    })
  })

  describe('getStepConfig', () => {
    it('should return correct config for welcome-screen', () => {
      const config = getStepConfig('welcome-screen')
      expect(config.id).toBe('welcome-screen')
      expect(config.phase).toBe('welcome')
      expect(config.index).toBe(0)
      expect(config.skippable).toBe(false)
    })

    it('should return correct config for company-basics (skippable)', () => {
      const config = getStepConfig('company-basics')
      expect(config.skippable).toBe(true)
      expect(config.phase).toBe('welcome')
    })

    it('should return correct config for completion step', () => {
      const config = getStepConfig('completion')
      expect(config.index).toBe(13)
      expect(config.phase).toBe('power-features')
    })
  })

  describe('getPhaseSteps', () => {
    it('should return 4 steps for welcome phase', () => {
      const steps = getPhaseSteps('welcome')
      expect(steps).toHaveLength(4)
      expect(steps.map(s => s.id)).toEqual([
        'welcome-screen', 'meet-rosa', 'personalization', 'company-basics'
      ])
    })

    it('should return 3 steps for quick-wins phase', () => {
      const steps = getPhaseSteps('quick-wins')
      expect(steps).toHaveLength(3)
    })

    it('should return 3 steps for core-setup phase', () => {
      const steps = getPhaseSteps('core-setup')
      expect(steps).toHaveLength(3)
    })

    it('should return 1 step for first-insights phase', () => {
      const steps = getPhaseSteps('first-insights')
      expect(steps).toHaveLength(1)
    })

    it('should return 3 steps for power-features phase', () => {
      const steps = getPhaseSteps('power-features')
      expect(steps).toHaveLength(3)
    })
  })

  describe('getNextStep', () => {
    it('should return meet-rosa after welcome-screen', () => {
      expect(getNextStep('welcome-screen')).toBe('meet-rosa')
    })

    it('should return null after completion (last step)', () => {
      expect(getNextStep('completion')).toBeNull()
    })

    it('should correctly traverse all steps', () => {
      let step: OnboardingStep | null = 'welcome-screen'
      const visited: OnboardingStep[] = [step]
      while (step) {
        step = getNextStep(step)
        if (step) visited.push(step)
      }
      expect(visited).toHaveLength(14)
      expect(visited[0]).toBe('welcome-screen')
      expect(visited[visited.length - 1]).toBe('completion')
    })
  })

  describe('getPreviousStep', () => {
    it('should return null before welcome-screen (first step)', () => {
      expect(getPreviousStep('welcome-screen')).toBeNull()
    })

    it('should return welcome-screen before meet-rosa', () => {
      expect(getPreviousStep('meet-rosa')).toBe('welcome-screen')
    })

    it('should return invite-team before completion', () => {
      expect(getPreviousStep('completion')).toBe('invite-team')
    })
  })

  describe('getProgressPercentage', () => {
    it('should return ~7% for welcome-screen (step 1 of 14)', () => {
      expect(getProgressPercentage('welcome-screen')).toBe(7)
    })

    it('should return 100% for completion (step 14 of 14)', () => {
      expect(getProgressPercentage('completion')).toBe(100)
    })

    it('should return ~50% for mid-step', () => {
      const mid = getProgressPercentage('facilities-setup') // index 7 → (8/14)*100 = 57
      expect(mid).toBeGreaterThan(50)
      expect(mid).toBeLessThan(60)
    })

    it('should always return values between 1 and 100', () => {
      for (const step of ONBOARDING_STEPS) {
        const pct = getProgressPercentage(step.id)
        expect(pct).toBeGreaterThanOrEqual(1)
        expect(pct).toBeLessThanOrEqual(100)
      }
    })
  })

  describe('isPhaseComplete', () => {
    it('should return false when no steps completed', () => {
      expect(isPhaseComplete('welcome', [])).toBe(false)
    })

    it('should return false when only some steps completed', () => {
      expect(isPhaseComplete('welcome', ['welcome-screen', 'meet-rosa'])).toBe(false)
    })

    it('should return true when all welcome phase steps completed', () => {
      expect(
        isPhaseComplete('welcome', ['welcome-screen', 'meet-rosa', 'personalization', 'company-basics'])
      ).toBe(true)
    })

    it('should return true for first-insights phase with single step completed', () => {
      expect(isPhaseComplete('first-insights', ['foundation-complete'])).toBe(true)
    })
  })
})
