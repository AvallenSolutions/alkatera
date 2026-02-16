'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/lib/organizationContext'
import {
  OnboardingFlow,
  OnboardingState,
  OnboardingStep,
  PersonalizationData,
  INITIAL_ONBOARDING_STATE,
  INITIAL_MEMBER_ONBOARDING_STATE,
  getNextStep,
  getPreviousStep,
  getStepConfig,
  getProgressPercentage,
  getInitialStateForFlow,
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
  /** The onboarding flow type: 'owner' or 'member' */
  onboardingFlow: OnboardingFlow
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
  /** Complete the entire onboarding (awaitable — waits for persistence) */
  completeOnboarding: () => Promise<void>
  /** Dismiss onboarding without completing */
  dismissOnboarding: () => void
  /** Mark the post-onboarding dashboard guide as completed */
  markGuideCompleted: () => void
  /** Mark the product page guide as completed */
  markProductGuideCompleted: () => void
  /** Mark the search guide as completed (dismissed) */
  markSearchGuideCompleted: () => void
  /** Re-enable the search guide */
  resetSearchGuide: () => void
  /** Reset onboarding (for testing) */
  resetOnboarding: () => void
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState>(INITIAL_ONBOARDING_STATE)
  const [isLoading, setIsLoading] = useState(true)
  const [onboardingFlow, setOnboardingFlow] = useState<OnboardingFlow>('owner')
  const { user } = useAuth()
  const { currentOrganization, userRole } = useOrganization()
  const isOwner = userRole === 'owner'

  // Track which org ID we've loaded state for to avoid re-fetching on every render
  const loadedOrgIdRef = useRef<string | null>(null)
  // Track the org ID and flow for saves so the callback doesn't need them in deps
  const orgIdRef = useRef<string | null>(null)
  const flowRef = useRef<OnboardingFlow>('owner')
  // Guard against saving while a fetch is in flight
  const isFetchingRef = useRef(false)
  // Counter to ignore stale fetch responses
  const fetchGenerationRef = useRef(0)
  // Session-level guard: once dismissed in this browser session, stay dismissed
  // even if the fire-and-forget save hasn't completed or failed silently
  const sessionDismissedRef = useRef(false)

  // Keep refs current
  useEffect(() => {
    orgIdRef.current = currentOrganization?.id ?? null
  }, [currentOrganization?.id])

  useEffect(() => {
    flowRef.current = onboardingFlow
  }, [onboardingFlow])

  // Queue of state updates that arrived while a fetch was in-flight.
  // When the fetch completes we merge these on top of the server state
  // so nothing the user did during loading is lost.
  const pendingUpdatesRef = useRef<Array<(prev: OnboardingState) => OnboardingState>>([])

  // Save onboarding state to the API — fires immediately, no debounce.
  // Uses orgIdRef/flowRef so it doesn't depend on reactive values (avoids
  // re-creating the callback on every reference change).
  // Returns true on success, false on failure.
  const saveState = useCallback(async (newState: OnboardingState): Promise<boolean> => {
    const orgId = orgIdRef.current
    if (!orgId) return false

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          state: newState,
          flow: flowRef.current,
        }),
      })
      return res.ok
    } catch (err) {
      console.error('Failed to save onboarding state:', err)
      return false
    }
  }, []) // stable — no deps

  // Fetch state from the API for a given org ID
  useEffect(() => {
    const orgId = currentOrganization?.id
    if (!orgId) {
      // Don't set isLoading to false here — wait for the org to load
      return
    }

    // Only fetch once per org ID
    if (loadedOrgIdRef.current === orgId) return
    loadedOrgIdRef.current = orgId

    const generation = ++fetchGenerationRef.current
    isFetchingRef.current = true
    setIsLoading(true)

    ;(async () => {
      try {
        const res = await fetch(`/api/onboarding?organizationId=${orgId}`)
        // If the org changed while we were fetching, discard the result
        if (generation !== fetchGenerationRef.current) return

        if (res.ok) {
          const data = await res.json()
          // Set the flow from the API response
          const serverFlow: OnboardingFlow = data.flow || (isOwner ? 'owner' : 'member')
          setOnboardingFlow(serverFlow)

          if (data.state) {
            // Replay any updates the user made while we were fetching
            let merged = data.state as OnboardingState
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
        console.error('Failed to fetch onboarding state:', err)
      } finally {
        if (generation === fetchGenerationRef.current) {
          isFetchingRef.current = false
          setIsLoading(false)
        }
      }
    })()
  }, [currentOrganization?.id, isOwner, saveState])

  // Helper: update state in memory and persist immediately.
  // If a fetch is in-flight, queue the updater so it can be replayed
  // on top of the server state when the fetch completes.
  const updateState = useCallback((updater: (prev: OnboardingState) => OnboardingState) => {
    if (isFetchingRef.current) {
      pendingUpdatesRef.current.push(updater)
    }
    setState(prev => {
      const next = updater(prev)
      // Only persist immediately if we're not mid-fetch;
      // otherwise the fetch-complete handler will persist the merged result.
      if (!isFetchingRef.current) {
        saveState(next)
      }
      return next
    })
  }, [saveState])

  const nextStep = useCallback(() => {
    updateState(prev => {
      const next = getNextStep(prev.currentStep, flowRef.current)
      if (!next) return prev
      return { ...prev, currentStep: next }
    })
  }, [updateState])

  const previousStep = useCallback(() => {
    updateState(prev => {
      const prevStep = getPreviousStep(prev.currentStep, flowRef.current)
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

      const next = getNextStep(prev.currentStep, flowRef.current)

      return {
        ...prev,
        completedSteps,
        currentStep: next ?? prev.currentStep,
      }
    })
  }, [updateState])

  const skipStep = useCallback(() => {
    updateState(prev => {
      const config = getStepConfig(prev.currentStep)
      if (!config.skippable) return prev
      const next = getNextStep(prev.currentStep, flowRef.current)
      if (!next) return prev

      return { ...prev, currentStep: next }
    })
  }, [updateState])

  const updatePersonalization = useCallback((data: Partial<PersonalizationData>) => {
    updateState(prev => ({
      ...prev,
      personalization: { ...prev.personalization, ...data },
    }))
  }, [updateState])

  const completeOnboarding = useCallback(async () => {
    // Use the appropriate completion step for the flow
    const completionStep = flowRef.current === 'member' ? 'member-completion' : 'completion'
    const completedState: OnboardingState = {
      ...state,
      completed: true,
      completedAt: new Date().toISOString(),
      currentStep: completionStep as OnboardingStep,
      completedSteps: state.completedSteps.includes(completionStep as OnboardingStep)
        ? state.completedSteps
        : [...state.completedSteps, completionStep as OnboardingStep],
    }
    setState(completedState)
    // Await the save so callers can wait for persistence before navigating
    await saveState(completedState)
  }, [state, saveState])

  const dismissOnboarding = useCallback(() => {
    sessionDismissedRef.current = true
    updateState(prev => ({
      ...prev,
      dismissed: true,
    }))
  }, [updateState])

  const markGuideCompleted = useCallback(() => {
    updateState(prev => ({
      ...prev,
      dashboardGuideCompleted: true,
    }))
  }, [updateState])

  const markProductGuideCompleted = useCallback(() => {
    updateState(prev => ({
      ...prev,
      productGuideCompleted: true,
    }))
  }, [updateState])

  const markSearchGuideCompleted = useCallback(() => {
    updateState(prev => ({
      ...prev,
      searchGuideCompleted: true,
    }))
  }, [updateState])

  const resetSearchGuide = useCallback(() => {
    updateState(prev => ({
      ...prev,
      searchGuideCompleted: false,
    }))
  }, [updateState])

  const resetOnboarding = useCallback(() => {
    sessionDismissedRef.current = false
    const fresh = { ...getInitialStateForFlow(flowRef.current), startedAt: new Date().toISOString() }
    setState(fresh)
    saveState(fresh)
  }, [saveState])

  // Both owners and members see the onboarding wizard — just different flows.
  const shouldShowOnboarding =
    !state.completed &&
    !state.dismissed &&
    !sessionDismissedRef.current &&
    !!user &&
    !!currentOrganization

  const progress = getProgressPercentage(state.currentStep, onboardingFlow)

  return (
    <OnboardingContext.Provider
      value={{
        state,
        shouldShowOnboarding,
        isLoading,
        progress,
        onboardingFlow,
        nextStep,
        previousStep,
        goToStep,
        completeStep,
        skipStep,
        updatePersonalization,
        completeOnboarding,
        dismissOnboarding,
        markGuideCompleted,
        markProductGuideCompleted,
        markSearchGuideCompleted,
        resetSearchGuide,
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
