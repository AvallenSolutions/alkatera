'use client'

import { useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { AlertTriangle, CreditCard, Mail, ShieldCheck } from 'lucide-react'
import Image from 'next/image'

export default function SuspendedPage() {
  const { currentOrganization } = useOrganization()
  const [portalLoading, setPortalLoading] = useState(false)

  const handleUpdatePayment = async () => {
    if (!currentOrganization?.id) return
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: currentOrganization.id }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      window.location.href = '/settings?tab=billing'
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background */}
      <Image
        src="https://jbhccqmwrwlmkebiluwi.supabase.co/storage/v1/object/public/website-images/alkatera-bg.webp"
        alt=""
        fill
        className="object-cover"
        priority
      />
      <div className="absolute inset-0 bg-black/70" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-lg">
          {/* Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 md:p-10 text-center">
            {/* Icon */}
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>

            {/* Heading */}
            <h1 className="font-serif text-3xl md:text-4xl text-white mb-3">
              Account Suspended
            </h1>

            <p className="text-white/60 text-sm md:text-base mb-8 leading-relaxed">
              Your subscription payment could not be processed and the grace period has expired.
              Please update your payment method to restore access.
            </p>

            {/* Reassurance */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 mb-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold text-sm">Your data is safe</span>
              </div>
              <p className="text-white/50 text-xs">
                All your products, LCAs, reports and organisation data are kept intact.
                Once you update your payment, everything will be restored immediately.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleUpdatePayment}
                disabled={portalLoading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#ccff00] px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-black hover:bg-[#b8e600] transition-colors disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" />
                {portalLoading ? 'Opening...' : 'Update Payment Method'}
              </button>

              <a
                href="mailto:support@alkatera.com"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-mono text-sm uppercase tracking-wider text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Mail className="h-4 w-4" />
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
