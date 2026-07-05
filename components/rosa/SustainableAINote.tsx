'use client'

import { useEffect, useState } from 'react'
import { Leaf, X } from 'lucide-react'

const STORAGE_KEY = 'alkatera.rosa.sustainableAINote.dismissed'

/**
 * Small dismissible banner on the /rosa/ hub explaining that Rosa now runs
 * on Gemini rather than Anthropic, and why. Dismissal is persisted in
 * localStorage so the banner shows once or twice then quiets.
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
      // best-effort; banner just won't persist its dismissed state
    }
  }

  return (
    <div
      role="region"
      aria-label="About Rosa's AI"
      className="rounded-[6px] border border-border bg-card px-4 py-3 sm:px-5 sm:py-4 mb-4 flex items-start gap-3"
    >
      <Leaf className="w-4 h-4 text-studio-forest shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Rosa now runs on more sustainable AI.
        </p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          We&apos;ve moved alka<strong>tera</strong>&apos;s AI from Anthropic to Google
          Gemini. Anthropic&apos;s partnership with xAI ties their roadmap to the
          Colossus datacentre, which has a heavy carbon and local-pollution
          footprint. Gemini runs on Google Cloud&apos;s lower-carbon
          infrastructure, which fits better with what we ask of our customers.
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 -mr-1 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors duration-200 ease-studio"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
