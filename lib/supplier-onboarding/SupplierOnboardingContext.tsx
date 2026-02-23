'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  SupplierOnboardingState,
  SupplierOnboardingStep,
  INITIAL_SUPPLIER_ONBOARDING_STATE,
  getNextSupplierStep,
  getPreviousSupplierStep,
  getSupplierStepConfig,
  getSupplierProgressPercentage,
} from './types'

interface SupplierOnboardingContextType {
  /** Current onboarding state */
  state: SupplierOnboardingState
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
  goToStep: (step: SupplierOnboardingStep) => void
  /** Mark the current step as completed and advance */
  completeStep: () => void
  /** Skip the current step (if skippable) */
  skipStep: () => void
  /** Complete the entire onboarding (awaitable — waits for persistence) */
  completeOnboarding: () => Promise<void>
  /** Dismiss onboarding without completing */
  dismissOnboarding: () => void
  /** Mark the profile as completed during the wizard */
  markProfileCompleted: () => void
  /** Reset onboarding (for testing) */
  resetOnboarding: () => void
}

const SupplierOnboardingContext = createContext<SupplierOnboardingContextType | undefined>(undefined)

export function SupplierOnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SupplierOnboardingState>(INITIAL_SUPPLIER_ONBOARDING_STATE)
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()

  // Track whether we've already loaded state to avoid re-fetching
  const loadedUserIdRef = useRef<string | null>(null)
  // Guard against saving while a fetch is in flight
  const isFetchingRef = useRef(false)
  // Counter to ignore stale fetch responses
  const fetchGenerationRef = useRef(0)
  // Session-level guard: once dismissed in this browser session, stay dismissed
  const sessionDismissedRef = useRef(false)

  // Queue of state updates that arrived while a fetch was in-flight
  const pendingUpdatesRef = useRef<Array<(prev: SupplierOnboardingState) => SupplierOnboardingState>>([])

  // Save onboarding state to the API — fires immediately, no debounce.
  const saveState = useCallback(async (newState: SupplierOnboardingState): Promise<boolean> => {
    try {
      const res = await fetch('/api/supplier-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState }),
      })
      return res.ok
    } catch (err) {
      console.error('Failed to save supplier onboarding state:', err)
      return false
    }
  }, [])

  // Fetch state from the API
  useEffect(() => {
    const userId = user?.id
    if (!userId) return

    // Only fetch once per user ID
    if (loadedUserIdRef.current === userId) return
    loadedUserIdRef.current = userId

    const generation = ++fetchGenerationRef.current
    isFetchingRef.current = true
    setIsLoading(true)

    ;(async () => {
      try {
        const res = await fetch('/api/supplier-onboarding')
        // If the user changed while we were fetching, discard the result
        if (generation !== fetchGenerationRef.current) return

        if (res.ok) {
          const data = await res.json()

          if (data.state) {
            // Replay any updates the user made while we were fetching
            let merged = data.state as SupplierOnboardingState
            const pending = pendingUpdatesRef.current
            pendingUpdatesRef.current = []
            for (const updater of pending) {
              merged = updater(merged)
            }
            setState(merged)
            // If there were pending updates, persist the merged state
            if (pending.length > 0) {
              saveState(merged)
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch supplier onboarding state:', err)
      } finally {
        if (generation === fetchGenerationRef.current) {
          isFetchingRef.current = false
          setIsLoading(false)
        }
      }
    })()
  }, [user?.id, saveState])

  // Helper: update state in memory and persist immediately.
  const updateState = useCallback((updater: (prev: SupplierOnboardingState) => SupplierOnboardingState) => {
    if (isFetchingRef.current) {
      pendingUpdatesRef.current.push(updater)
    }
    setState(prev => {
      const next = updater(prev)
      if (!isFetchingRef.current) {
        saveState(next)
      }
      return next
    })
  }, [saveState])

  const nextStep = useCallback(() => {
    updateState(prev => {
      const next = getNextSupplierStep(prev.currentStep)
      if (!next) return prev
      return { ...prev, currentStep: next }
    })
  }, [updateState])

  const previousStep = useCallback(() => {
    updateState(prev => {
      const prevStep = getPreviousSupplierStep(prev.currentStep)
      if (!prevStep) return prev
      return { ...prev, currentStep: prevStep }
    })
  }, [updateState])

  const goToStep = useCallback((step: SupplierOnboardingStep) => {
    updateState(prev => ({ ...prev, currentStep: step }))
  }, [updateState])

  const completeStep = useCallback(() => {
    updateState(prev => {
      const completedSteps = prev.completedSteps.includes(prev.currentStep)
        ? prev.completedSteps
        : [...prev.completedSteps, prev.currentStep]

      const next = getNextSupplierStep(prev.currentStep)

      return {
        ...prev,
        completedSteps,
        currentStep: next ?? prev.currentStep,
      }
    })
  }, [updateState])

  const skipStep = useCallback(() => {
    updateState(prev => {
      const config = getSupplierStepConfig(prev.currentStep)
      if (!config.skippable) return prev
      const next = getNextSupplierStep(prev.currentStep)
      if (!next) return prev
      return { ...prev, currentStep: next }
    })
  }, [updateState])

  const completeOnboarding = useCallback(async () => {
    const completedState: SupplierOnboardingState = {
      ...state,
      completed: true,
      completedAt: new Date().toISOString(),
      currentStep: 'supplier-all-set',
      completedSteps: state.completedSteps.includes('supplier-all-set')
        ? state.completedSteps
        : [...state.completedSteps, 'supplier-all-set'],
    }
    setState(completedState)
    await saveState(completedState)
  }, [state, saveState])

  const dismissOnboarding = useCallback(() => {
    sessionDismissedRef.current = true
    updateState(prev => ({
      ...prev,
      dismissed: true,
    }))
  }, [updateState])

  const markProfileCompleted = useCallback(() => {
    updateState(prev => ({
      ...prev,
      profileCompleted: true,
    }))
  }, [updateState])

  const resetOnboarding = useCallback(() => {
    sessionDismissedRef.current = false
    const fresh = { ...INITIAL_SUPPLIER_ONBOARDING_STATE, startedAt: new Date().toISOString() }
    setState(fresh)
    saveState(fresh)
  }, [saveState])

  const shouldShowOnboarding =
    !state.completed &&
    !state.dismissed &&
    !sessionDismissedRef.current &&
    !!user

  const progress = getSupplierProgressPercentage(state.currentStep)

  return (
    <SupplierOnboardingContext.Provider
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
        completeOnboarding,
        dismissOnboarding,
        markProfileCompleted,
        resetOnboarding,
      }}
    >
      {children}
    </SupplierOnboardingContext.Provider>
  )
}

export function useSupplierOnboarding() {
  const context = useContext(SupplierOnboardingContext)
  if (context === undefined) {
    throw new Error('useSupplierOnboarding must be used within a SupplierOnboardingProvider')
  }
  return context
}
