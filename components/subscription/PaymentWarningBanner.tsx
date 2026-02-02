'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, X, CreditCard } from 'lucide-react'

interface PaymentWarningBannerProps {
  organizationId: string
}

export function PaymentWarningBanner({ organizationId }: PaymentWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [daysLeft, setDaysLeft] = useState<number | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    // Fetch grace period end from org data
    async function fetchGracePeriod() {
      try {
        const res = await fetch(`/api/organizations/${organizationId}/grace-period`)
        if (res.ok) {
          const data = await res.json()
          if (data.grace_period_end) {
            const end = new Date(data.grace_period_end)
            const now = new Date()
            const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            setDaysLeft(Math.max(0, diff))
          }
        }
      } catch {
        // Fallback: show banner without countdown
      }
    }
    fetchGracePeriod()
  }, [organizationId])

  const handleUpdatePayment = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      // Fallback to settings
      window.location.href = '/settings?tab=billing'
    } finally {
      setPortalLoading(false)
    }
  }

  if (dismissed) return null

  return (
    <div className="relative bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-200">
            <span className="font-semibold">Payment failed.</span>
            {' '}
            {daysLeft !== null
              ? `Your account will be suspended in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. `
              : 'Please update your payment method to avoid suspension. '
            }
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleUpdatePayment}
            disabled={portalLoading}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            <CreditCard className="h-3.5 w-3.5" />
            {portalLoading ? 'Loading...' : 'Update Payment'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-500/60 hover:text-amber-500 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
