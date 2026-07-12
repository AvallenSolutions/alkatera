'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'alkatera.rosa.sustainableAINote.dismissed'

/**
 * One-paragraph quiet footnote for the bottom margins of the brief,
 * explaining that Rosa runs on Gemini rather than Anthropic, and why.
 * Dismissal is persisted in localStorage so the note shows once or
 * twice then quiets.
 */

export function SustainableAINote() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY) === '1'
      setVisible(!dismissed)
    } catch {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const handleDismiss = () => {
    setVisible(false)
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // best-effort; the note just won't persist its dismissed state
    }
  }

  return (
    <div role="region" aria-label="About Rosa's AI" className="flex items-start gap-2">
      <p className="min-w-0 flex-1 text-xs text-muted-foreground leading-relaxed">
        <span className="font-medium text-foreground">Rosa runs on more sustainable AI.</span>{' '}
        We moved alka<strong>tera</strong>&apos;s AI from Anthropic to Google Gemini because
        Gemini runs on lower-carbon infrastructure, which fits better with what we ask of
        our customers.
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 -mt-0.5 rounded-md px-1 text-sm leading-none text-muted-foreground hover:text-foreground transition-colors duration-200 ease-studio"
      >
        &times;
      </button>
    </div>
  )
}
