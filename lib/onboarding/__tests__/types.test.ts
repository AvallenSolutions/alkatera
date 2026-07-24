import { describe, it, expect } from 'vitest'
import {
  ARRIVAL_STEPS,
  MEMBER_ONBOARDING_STEPS,
  ADVISOR_ONBOARDING_STEPS,
  INITIAL_ARRIVAL_STATE,
  INITIAL_MEMBER_ONBOARDING_STATE,
  INITIAL_ADVISOR_ONBOARDING_STATE,
  getStepsForFlow,
  getInitialStateForFlow,
  getStepConfig,
  getNextStep,
  getPreviousStep,
  getProgressPercentage,
} from '../types'
import type { OnboardingFlow, OnboardingStepConfig } from '../types'

/**
 * The arrival ritual is the only first-run flow for owners; members and
 * advisors get their short orientations. The legacy 'owner' and 'fast_track'
 * labels must keep resolving (old saved rows, including production rows at
 * cutover) but always onto the arrival shape.
 */
describe('Onboarding Types & Utilities', () => {
  const FLOWS: { flow: OnboardingFlow; steps: OnboardingStepConfig[]; first: string; last: string }[] = [
    { flow: 'arrival', steps: ARRIVAL_STEPS, first: 'arrival-website', last: 'arrival-plan' },
    { flow: 'member', steps: MEMBER_ONBOARDING_STEPS, first: 'member-welcome', last: 'member-completion' },
    { flow: 'advisor', steps: ADVISOR_ONBOARDING_STEPS, first: 'advisor-welcome', last: 'advisor-completion' },
  ]

  describe.each(FLOWS)('$flow flow steps', ({ steps, first, last }) => {
    it('has consecutive indices starting from 0', () => {
      steps.forEach((step, i) => {
        expect(step.index).toBe(i)
      })
    })

    it('has unique step IDs', () => {
      const ids = steps.map(s => s.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('starts and ends where the flow says it does', () => {
      expect(steps[0].id).toBe(first)
      expect(steps[steps.length - 1].id).toBe(last)
    })

    it('never lets the first or last step be skipped', () => {
      expect(steps[0].skippable).toBe(false)
      expect(steps[steps.length - 1].skippable).toBe(false)
    })

    it('gives every step a title and description', () => {
      for (const step of steps) {
        expect(step.title.length).toBeGreaterThan(0)
        expect(step.description.length).toBeGreaterThan(0)
      }
    })
  })

  describe('the arrival ritual shape', () => {
    it('is the 8-screen ritual from the arrival-front-door plan', () => {
      // 'arrival-modules' joined on 2026-07-24: which of the four growing /
      // hospitality modules this business works with, asked straight after
      // "where you make it" because it is the same question one step out.
      expect(ARRIVAL_STEPS.map(s => s.id)).toEqual([
        'arrival-website',
        'arrival-persona',
        'arrival-confirm',
        'arrival-reveal',
        'arrival-facility',
        'arrival-modules',
        'arrival-estimate',
        'arrival-plan',
      ])
    })

    it('numbers every step by its own position', () => {
      ARRIVAL_STEPS.forEach((s, i) => expect(s.index).toBe(i))
    })

    it('opens org creation (arrival-website) unskippably', () => {
      expect(getStepConfig('arrival-website').skippable).toBe(false)
    })
  })

  describe('getStepsForFlow', () => {
    it('returns each surviving flow its own steps', () => {
      expect(getStepsForFlow('arrival')).toBe(ARRIVAL_STEPS)
      expect(getStepsForFlow('member')).toBe(MEMBER_ONBOARDING_STEPS)
      expect(getStepsForFlow('advisor')).toBe(ADVISOR_ONBOARDING_STEPS)
    })

    it('routes the legacy owner and fast_track labels onto the arrival steps', () => {
      expect(getStepsForFlow('owner')).toBe(ARRIVAL_STEPS)
      expect(getStepsForFlow('fast_track')).toBe(ARRIVAL_STEPS)
    })
  })

  describe('getInitialStateForFlow', () => {
    it('returns each surviving flow its own initial state', () => {
      expect(getInitialStateForFlow('arrival').currentStep).toBe('arrival-website')
      expect(getInitialStateForFlow('member').currentStep).toBe('member-welcome')
      expect(getInitialStateForFlow('advisor').currentStep).toBe('advisor-welcome')
    })

    it('routes the legacy labels onto the arrival initial state', () => {
      expect(getInitialStateForFlow('owner').currentStep).toBe('arrival-website')
      expect(getInitialStateForFlow('fast_track').currentStep).toBe('arrival-website')
    })

    it('starts every flow fresh', () => {
      for (const initial of [INITIAL_ARRIVAL_STATE, INITIAL_MEMBER_ONBOARDING_STATE, INITIAL_ADVISOR_ONBOARDING_STATE]) {
        expect(initial.completed).toBe(false)
        expect(initial.dismissed).toBe(false)
        expect(initial.completedSteps).toEqual([])
        expect(initial.personalization).toEqual({})
      }
    })
  })

  describe('getStepConfig', () => {
    it('finds arrival, member and advisor steps', () => {
      expect(getStepConfig('arrival-persona').id).toBe('arrival-persona')
      expect(getStepConfig('member-platform-tour').id).toBe('member-platform-tour')
      expect(getStepConfig('advisor-capabilities').id).toBe('advisor-capabilities')
    })

    it('lands legacy owner/fast-track ids on the arrival opener (never renders — those states are retired as completed on load)', () => {
      expect(getStepConfig('welcome-screen').id).toBe('arrival-website')
      expect(getStepConfig('fast-track-setup').id).toBe('arrival-website')
    })
  })

  describe('navigation', () => {
    it('traverses the arrival ritual end to end', () => {
      let step: ReturnType<typeof getNextStep> = 'arrival-website'
      const visited: string[] = [step]
      while (step) {
        step = getNextStep(step, 'arrival')
        if (step) visited.push(step)
      }
      expect(visited).toEqual(ARRIVAL_STEPS.map(s => s.id))
    })

    it('is bidirectional within a flow', () => {
      for (const { flow, steps } of FLOWS) {
        for (const step of steps.slice(0, -1)) {
          const next = getNextStep(step.id, flow)
          expect(next).not.toBeNull()
          expect(getPreviousStep(next!, flow)).toBe(step.id)
        }
      }
    })

    it('returns null past either end', () => {
      expect(getPreviousStep('arrival-website', 'arrival')).toBeNull()
      expect(getNextStep('arrival-plan', 'arrival')).toBeNull()
    })

    it('defaults its flow to arrival', () => {
      expect(getNextStep('arrival-website')).toBe('arrival-persona')
    })
  })

  describe('getProgressPercentage', () => {
    it('reaches 100% on the last step of each flow', () => {
      for (const { flow, steps } of FLOWS) {
        expect(getProgressPercentage(steps[steps.length - 1].id, flow)).toBe(100)
      }
    })

    it('always returns values between 1 and 100 across every flow', () => {
      for (const { flow, steps } of FLOWS) {
        for (const step of steps) {
          const p = getProgressPercentage(step.id, flow)
          expect(p).toBeGreaterThanOrEqual(1)
          expect(p).toBeLessThanOrEqual(100)
        }
      }
    })
  })
})
