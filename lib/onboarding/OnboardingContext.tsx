'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/lib/organizationContext'
import {
  OnboardingState,
  OnboardingStep,
  PersonalizationData,
  INITIAL_ONBOARDING_STATE,
  getNextStep,
  getPreviousStep,
  getStepConfig,
  getProgressPercentage,
} from './types'

interface OnboardingContextType {
  /** Current onboarding state */
  state: OnboardingState
  /** Whether onboarding should be shown */
  shouldShowOnboarding: boolean
  /** Whether onboarding state is loading */
  isLoading: boolean
  /** Progress percentage (0-100) */
  progress: number
  /** Go to the next step */
  nextStep: () => void
  /** Go to the previous step */
  previousStep: () => void
  /** Go to a specific step */
  goToStep: (step: OnboardingStep) => void
  /** Mark the current step as completed and advance */
  completeStep: () => void
  /** Skip the current step (if skippable) */
  skipStep: () => void
  /** Update personalization data */
  updatePersonalization: (data: Partial<PersonalizationData>) => void
  /** Complete the entire onboarding */
  completeOnboarding: () => void
  /** Dismiss onboarding without completing */
  dismissOnboarding: () => void
  /** Reset onboarding (for testing) */
  resetOnboarding: () => void
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState>(INITIAL_ONBOARDING_STATE)
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()
  const { currentOrganization } = useOrganization()
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasFetchedRef = useRef(false)

  // Load onboarding state from the API
  const fetchState = useCallback(async () => {
    if (!currentOrganization) return

    try {
      const res = await fetch(`/api/onboarding?organizationId=${currentOrganization.id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.state) {
          setState(data.state)
        }
      }
    } catch (err) {
      console.error('Failed to fetch onboarding state:', err)
    } finally {
      setIsLoading(false)
    }
  }, [currentOrganization])

  // Save onboarding state to the API (debounced)
  const saveState = useCallback(async (newState: OnboardingState) => {
    if (!currentOrganization) return

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce saves by 500ms
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: currentOrganization.id,
            state: newState,
          }),
        })
      } catch (err) {
        console.error('Failed to save onboarding state:', err)
      }
    }, 500)
  }, [currentOrganization])

  // Fetch state when organization changes
  useEffect(() => {
    if (currentOrganization && !hasFetchedRef.current) {
      hasFetchedRef.current = true
      fetchState()
    }
  }, [currentOrganization, fetchState])

  // Reset fetch flag when organization changes
  useEffect(() => {
    hasFetchedRef.current = false
  }, [currentOrganization?.id])

  const updateState = useCallback((updater: (prev: OnboardingState) => OnboardingState) => {
    setState(prev => {
      const next = updater(prev)
      saveState(next)
      return next
    })
  }, [saveState])

  const nextStep = useCallback(() => {
    updateState(prev => {
      const next = getNextStep(prev.currentStep)
      if (!next) return prev
      return { ...prev, currentStep: next }
    })
  }, [updateState])

  const previousStep = useCallback(() => {
    updateState(prev => {
      const prevStep = getPreviousStep(prev.currentStep)
      if (!prevStep) return prev
      return { ...prev, currentStep: prevStep }
    })
  }, [updateState])

  const goToStep = useCallback((step: OnboardingStep) => {
    updateState(prev => ({ ...prev, currentStep: step }))
  }, [updateState])

  const completeStep = useCallback(() => {
    updateState(prev => {
      const completedSteps = prev.completedSteps.includes(prev.currentStep)
        ? prev.completedSteps
        : [...prev.completedSteps, prev.currentStep]

      const next = getNextStep(prev.currentStep)
      return {
        ...prev,
        completedSteps,
        currentStep: next ?? prev.currentStep,
      }
    })
  }, [updateState])

  const skipStep = useCallback(() => {
    const config = getStepConfig(state.currentStep)
    if (!config.skippable) return
    nextStep()
  }, [state.currentStep, nextStep])

  const updatePersonalization = useCallback((data: Partial<PersonalizationData>) => {
    updateState(prev => ({
      ...prev,
      personalization: { ...prev.personalization, ...data },
    }))
  }, [updateState])

  const completeOnboarding = useCallback(() => {
    updateState(prev => ({
      ...prev,
      completed: true,
      completedAt: new Date().toISOString(),
      currentStep: 'completion',
      completedSteps: prev.completedSteps.includes('completion')
        ? prev.completedSteps
        : [...prev.completedSteps, 'completion'],
    }))
  }, [updateState])

  const dismissOnboarding = useCallback(() => {
    updateState(prev => ({
      ...prev,
      dismissed: true,
    }))
  }, [updateState])

  const resetOnboarding = useCallback(() => {
    const fresh = { ...INITIAL_ONBOARDING_STATE, startedAt: new Date().toISOString() }
    setState(fresh)
    saveState(fresh)
  }, [saveState])

  const shouldShowOnboarding = !state.completed && !state.dismissed && !!user && !!currentOrganization
  const progress = getProgressPercentage(state.currentStep)

  return (
    <OnboardingContext.Provider
      value={{
        state,
        shouldShowOnboarding,
        isLoading,
        progress,
        nextStep,
        previousStep,
        goToStep,
        completeStep,
        skipStep,
        updatePersonalization,
        completeOnboarding,
        dismissOnboarding,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider')
  }
  return context
}
