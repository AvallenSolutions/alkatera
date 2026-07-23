'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/lib/organizationContext'
import type { PlatformRoomKey } from '@/components/studio/platform-rooms'
import {
  OnboardingFlow,
  OnboardingState,
  OnboardingStep,
  PersonalizationData,
  INITIAL_MEMBER_ONBOARDING_STATE,
  INITIAL_ARRIVAL_STATE,
  getNextStep,
  getPreviousStep,
  getStepConfig,
  getProgressPercentage,
  getInitialStateForFlow,
  ARRIVAL_STEPS,
} from './types'
import { trackOnboarding } from './telemetry'

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
  /** Persistence status — drives the "Saved" indicator in the wizard chrome. */
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  /** ISO timestamp of the last successful save, or null. */
  lastSavedAt: string | null
  /** True when there's a previous step in the current flow. */
  canGoBack: boolean
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
  /** Reverse a dismissal — used by the resumable banner on /rosa/ */
  resumeOnboarding: () => void
  /** Mark the post-onboarding dashboard guide as completed */
  markGuideCompleted: () => void
  /** Mark the product page guide as completed */
  markProductGuideCompleted: () => void
  /** Mark the search guide as completed (dismissed) */
  markSearchGuideCompleted: () => void
  /** Re-enable the search guide */
  resetSearchGuide: () => void
  /** Dismiss the emissions guide */
  dismissEmissionsGuide: () => void
  /** Re-open the emissions guide after dismissal */
  reopenEmissionsGuide: () => void
  /** Mark the recipe sidebar first-run tour as completed (or skipped) */
  markRecipeSidebarTourCompleted: () => void
  /** Mark the factor-info hover hint coachmark as seen/dismissed */
  markFactorInfoHintCompleted: () => void
  /** Mark a room's first-visit intro as seen (RoomSetupPanel) */
  markRoomIntroSeen: (room: PlatformRoomKey) => void
  /** Hide a room's setup checklist (RoomSetupPanel) */
  dismissRoomChecklist: (room: PlatformRoomKey) => void
  /** Dismiss a coachmark by id (components/studio/coachmark.tsx) */
  dismissCoachmark: (id: string) => void
  /** Reset onboarding (for testing) */
  resetOnboarding: () => void
  /**
   * Called by ArrivalWebsiteStep the instant it creates the organisation
   * silently. Marks the new org ID as already "loaded" (so the org-appeared
   * refetch below doesn't clobber the in-memory arrival progress with a
   * fresh server state) and write-throughs the current state to
   * /api/onboarding so the row exists under the new org straight away.
   */
  attachOrganizationId: (organizationId: string) => void
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState>(INITIAL_ARRIVAL_STATE)
  const [isLoading, setIsLoading] = useState(true)
  const [onboardingFlow, setOnboardingFlow] = useState<OnboardingFlow>('arrival')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const { user } = useAuth()
  const { currentOrganization, userRole, isLoading: isOrgResolving } = useOrganization()
  const isOwner = userRole === 'owner'
  const isAdvisor = userRole === 'advisor'

  // Track which org ID we've loaded state for to avoid re-fetching on every
  // render. Also doubles as the pre-org sentinel ('PRE_ORG') and the
  // attachOrganizationId hand-off marker — see the fetch effect below.
  const loadedOrgIdRef = useRef<string | null>(null)
  // Track the org ID and flow for saves so the callback doesn't need them in deps
  const orgIdRef = useRef<string | null>(null)
  const flowRef = useRef<OnboardingFlow>('arrival')
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

  // Save onboarding state to the API — debounced (300ms) to prevent
  // overlapping saves when multiple rapid state updates fire (e.g. step
  // transitions with completion toggles). Uses orgIdRef/flowRef so it
  // doesn't depend on reactive values.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveState = useCallback((newState: OnboardingState): Promise<boolean> => {
    return new Promise((resolve) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      // The instant a save is scheduled, show "saving" — the indicator lags
      // by the 300ms debounce but that's an honest reflection of state.
      setSaveStatus('saving')
      saveTimerRef.current = setTimeout(async () => {
        const orgId = orgIdRef.current
        // Pre-org (the arrival ritual's first step, before ArrivalWebsiteStep
        // has created the organisation): there's nothing to save against yet.
        // This is expected, not a failure — stay quiet rather than flipping
        // the "Couldn't save" indicator on for a save that was never possible.
        if (!orgId) { setSaveStatus('idle'); resolve(false); return }

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
          if (res.ok) {
            setSaveStatus('saved')
            setLastSavedAt(new Date().toISOString())
          } else {
            setSaveStatus('error')
          }
          resolve(res.ok)
        } catch (err) {
          console.error('Failed to save onboarding state:', err)
          setSaveStatus('error')
          resolve(false)
        }
      }, 300)
    })
  }, []) // stable — no deps

  // Fetch state from the API for a given org ID — or, pre-org, seed the
  // arrival ritual from local state (see attachOrganizationId for the
  // hand-off the moment ArrivalWebsiteStep creates the organisation).
  useEffect(() => {
    // Org membership is still resolving (post-login bootstrap) — wait
    // rather than treating "no org yet" as settled.
    if (isOrgResolving) return

    const orgId = currentOrganization?.id ?? null

    if (!orgId) {
      // Pre-org: there is no organizationId to fetch or save against. A
      // fresh owner walks the arrival ritual (arrival-website first) from
      // local state only; suppliers and advisors never reach this branch —
      // AppLayout mounts the wizard here only for org-less non-advisor,
      // non-supplier users. Seed once; the AppLayout org-less render is what
      // actually shows the wizard full-screen.
      if (loadedOrgIdRef.current !== 'PRE_ORG') {
        loadedOrgIdRef.current = 'PRE_ORG'
        setOnboardingFlow('arrival')
        setState(prev => (prev.startedAt ? prev : { ...INITIAL_ARRIVAL_STATE, startedAt: new Date().toISOString() }))
      }
      setIsLoading(false)
      return
    }

    // attachOrganizationId already claimed this org ID (the arrival ritual
    // just created it and wrote the in-memory state through) — nothing to
    // fetch, the local state is already the source of truth.
    if (loadedOrgIdRef.current === orgId) {
      setIsLoading(false)
      return
    }
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
          // Legacy flow labels ('owner' 14-step, 'fast_track' 8-step) are
          // retired: their saved states never step again. Any such row --
          // including production rows arriving at cutover -- is treated as
          // completed under the arrival label; the desk's migration
          // orientation (desk-welcome) is the reorientation surface now.
          const rawFlow: string | null = data.flow || null
          const isLegacyFlow = rawFlow === 'owner' || rawFlow === 'fast_track'
          const serverFlow: OnboardingFlow = isLegacyFlow
            ? 'arrival'
            : (rawFlow as OnboardingFlow) || (isAdvisor ? 'advisor' : isOwner ? 'arrival' : 'member')
          setOnboardingFlow(serverFlow)

          if (data.state) {
            // Replay any updates the user made while we were fetching
            let merged = data.state as OnboardingState
            if (isLegacyFlow && !merged.completed) {
              merged = { ...merged, completed: true, completedAt: merged.completedAt ?? new Date().toISOString() }
            }
            // Compat: the arrival ritual's old 'arrival-welcome' (a single
            // continue button) and 'arrival-company' steps were retired when
            // org creation moved into arrival-website itself. An org-having
            // user parked on either one is mapped onto the nearest
            // equivalent in the new 6-step shape — they already have an
            // org, so arrival-website (which ArrivalWebsiteStep treats as a
            // no-op re-confirm when currentOrganization already exists)
            // isn't re-asked as if it were still step 1.
            if ((merged.currentStep as string) === 'arrival-welcome') {
              merged = { ...merged, currentStep: 'arrival-website' }
            } else if ((merged.currentStep as string) === 'arrival-company') {
              merged = { ...merged, currentStep: 'arrival-confirm' }
            }
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
  }, [currentOrganization?.id, isOrgResolving, isOwner, isAdvisor, saveState])

  const attachOrganizationId = useCallback((organizationId: string) => {
    orgIdRef.current = organizationId
    loadedOrgIdRef.current = organizationId
    // Write through whatever the arrival ritual currently holds in memory so
    // the onboarding_state row exists under the new org immediately — the
    // next debounced save (e.g. the persona step's choice) would otherwise
    // be the first write, and anything read before then (this org's own
    // GET /api/onboarding, should something else trigger it) would see
    // nothing.
    setState(prev => {
      saveState(prev)
      return prev
    })
  }, [saveState])

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
      trackOnboarding({
        organizationId: currentOrganization?.id,
        flow: flowRef.current,
        step: prev.currentStep,
        event: 'back',
      })
      return { ...prev, currentStep: prevStep }
    })
  }, [updateState, currentOrganization?.id])

  const goToStep = useCallback((step: OnboardingStep) => {
    updateState(prev => ({ ...prev, currentStep: step }))
  }, [updateState])

  const completeStep = useCallback(() => {
    updateState(prev => {
      const completedSteps = prev.completedSteps.includes(prev.currentStep)
        ? prev.completedSteps
        : [...prev.completedSteps, prev.currentStep]

      const next = getNextStep(prev.currentStep, flowRef.current)
      trackOnboarding({
        organizationId: currentOrganization?.id,
        flow: flowRef.current,
        step: prev.currentStep,
        event: 'complete',
      })

      return {
        ...prev,
        completedSteps,
        currentStep: next ?? prev.currentStep,
      }
    })
  }, [updateState, currentOrganization?.id])

  const skipStep = useCallback(() => {
    updateState(prev => {
      const config = getStepConfig(prev.currentStep)
      if (!config.skippable) return prev
      const next = getNextStep(prev.currentStep, flowRef.current)
      if (!next) return prev
      trackOnboarding({
        organizationId: currentOrganization?.id,
        flow: flowRef.current,
        step: prev.currentStep,
        event: 'skip',
      })

      return { ...prev, currentStep: next }
    })
  }, [updateState, currentOrganization?.id])

  const updatePersonalization = useCallback((data: Partial<PersonalizationData>) => {
    updateState(prev => ({
      ...prev,
      personalization: { ...prev.personalization, ...data },
    }))
  }, [updateState])

  const completeOnboarding = useCallback(async () => {
    // Use the appropriate completion step for the flow
    const completionStep =
      flowRef.current === 'member' ? 'member-completion' :
      flowRef.current === 'advisor' ? 'advisor-completion' :
      // arrival-plan (the trial/plan step) doubles as the "forest has
      // started" close — it's the last screen in the ritual.
      'arrival-plan'
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
    trackOnboarding({
      organizationId: currentOrganization?.id,
      flow: flowRef.current,
      step: completionStep,
      event: 'complete',
      meta: { final: true, completedSteps: completedState.completedSteps.length },
    })
    // Await the save so callers can wait for persistence before navigating
    await saveState(completedState)
  }, [state, saveState, currentOrganization?.id])

  const dismissOnboarding = useCallback(() => {
    sessionDismissedRef.current = true
    trackOnboarding({
      organizationId: currentOrganization?.id,
      flow: flowRef.current,
      step: state.currentStep,
      event: 'dismiss',
    })
    updateState(prev => ({
      ...prev,
      dismissed: true,
    }))
  }, [updateState, currentOrganization?.id, state.currentStep])

  // Reverse a dismissal so the wizard reappears at the step the user was on.
  // Used by the resumable banner that surfaces on /rosa/ when the user closed
  // onboarding without finishing.
  const resumeOnboarding = useCallback(() => {
    sessionDismissedRef.current = false
    updateState(prev => ({
      ...prev,
      dismissed: false,
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

  const markRecipeSidebarTourCompleted = useCallback(() => {
    updateState(prev => ({
      ...prev,
      recipeSidebarTourCompleted: true,
    }))
  }, [updateState])

  const markFactorInfoHintCompleted = useCallback(() => {
    updateState(prev => ({
      ...prev,
      factorInfoHintCompleted: true,
    }))
  }, [updateState])

  const markRoomIntroSeen = useCallback((room: PlatformRoomKey) => {
    updateState(prev => ({
      ...prev,
      rooms: { ...prev.rooms, [room]: { ...prev.rooms?.[room], introSeen: true } },
    }))
  }, [updateState])

  const dismissRoomChecklist = useCallback((room: PlatformRoomKey) => {
    updateState(prev => ({
      ...prev,
      rooms: { ...prev.rooms, [room]: { ...prev.rooms?.[room], checklistDismissed: true } },
    }))
  }, [updateState])

  const dismissCoachmark = useCallback((id: string) => {
    updateState(prev => ({
      ...prev,
      coachmarks: { ...prev.coachmarks, [id]: true },
    }))
  }, [updateState])

  const resetSearchGuide = useCallback(() => {
    updateState(prev => ({
      ...prev,
      searchGuideCompleted: false,
    }))
  }, [updateState])

  const dismissEmissionsGuide = useCallback(() => {
    updateState(prev => ({
      ...prev,
      emissionsGuideDismissed: true,
    }))
  }, [updateState])

  const reopenEmissionsGuide = useCallback(() => {
    updateState(prev => ({
      ...prev,
      emissionsGuideDismissed: false,
    }))
  }, [updateState])

  // setFlow is gone: the welcome screen that offered a flow switch went with
  // the owner and fast-track flows. The flow is decided by the API (or the
  // pre-org arrival branch) and never changes mid-ritual.

  const resetOnboarding = useCallback(() => {
    sessionDismissedRef.current = false
    const fresh = { ...getInitialStateForFlow(flowRef.current), startedAt: new Date().toISOString() }
    setState(fresh)
    saveState(fresh)
  }, [saveState])

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // Both owners and members see the onboarding wizard — just different
  // flows. No longer requires currentOrganization: a fresh, org-less owner
  // walks the arrival ritual's local-state pre-org branch (above) before
  // ArrivalWebsiteStep creates the org. AppLayout is what actually decides
  // whether this wizard is on screen for an org-less user (it mounts it only
  // for non-supplier, non-advisor users), so this stays permissive here.
  const shouldShowOnboarding =
    !state.completed &&
    !state.dismissed &&
    !sessionDismissedRef.current &&
    !!user

  const progress = getProgressPercentage(state.currentStep, onboardingFlow)
  const canGoBack = getPreviousStep(state.currentStep, onboardingFlow) !== null

  return (
    <OnboardingContext.Provider
      value={{
        state,
        shouldShowOnboarding,
        isLoading,
        progress,
        onboardingFlow,
        saveStatus,
        lastSavedAt,
        canGoBack,
        nextStep,
        previousStep,
        goToStep,
        completeStep,
        skipStep,
        updatePersonalization,
        completeOnboarding,
        dismissOnboarding,
        resumeOnboarding,
        markGuideCompleted,
        markProductGuideCompleted,
        markSearchGuideCompleted,
        resetSearchGuide,
        dismissEmissionsGuide,
        reopenEmissionsGuide,
        markRecipeSidebarTourCompleted,
        markFactorInfoHintCompleted,
        markRoomIntroSeen,
        dismissRoomChecklist,
        dismissCoachmark,
        resetOnboarding,
        attachOrganizationId,
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
