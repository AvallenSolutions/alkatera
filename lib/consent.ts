'use client'

import { useEffect, useState } from 'react'

/**
 * Lightweight cookie-consent state for optional analytics (GA + PostHog).
 *
 * Under PECR / UK GDPR, non-essential analytics cookies require prior opt-in.
 * Analytics only initialise once `getConsent() === 'accepted'`. Stored in
 * localStorage so the choice persists; a custom event keeps GA, PostHog and the
 * banner in sync within the tab.
 */
export type ConsentValue = 'accepted' | 'rejected'

const STORAGE_KEY = 'alkatera-cookie-consent'
const CHANGE_EVENT = 'alkatera-consent-change'

export function getConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === 'accepted' || v === 'rejected' ? v : null
}

export function setConsent(value: ConsentValue): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, value)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/**
 * Reactive consent state. Returns `undefined` until mounted (so server and
 * first client render agree and analytics never run during SSR), then the
 * stored value or `null` if no choice has been made yet.
 */
export function useConsent(): ConsentValue | null | undefined {
  const [consent, setConsentState] = useState<ConsentValue | null | undefined>(undefined)

  useEffect(() => {
    const sync = () => setConsentState(getConsent())
    sync()
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return consent
}
