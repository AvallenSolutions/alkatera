'use client'

import { useSupplierOnboarding } from '@/lib/supplier-onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { Button } from '@/components/ui/button'
import { Leaf } from 'lucide-react'

export function SupplierWelcome() {
  const { completeStep } = useSupplierOnboarding()
  const { currentOrganization } = useOrganization()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4 animate-in fade-in duration-700">
      {/* Animated logo area */}
      <div className="relative">
        <div className="w-24 h-24 rounded-3xl bg-[#ccff00]/20 backdrop-blur-md border border-[#ccff00]/30 flex items-center justify-center animate-in zoom-in duration-500">
          <Leaf className="w-12 h-12 text-[#ccff00]" />
        </div>
        <div className="absolute -inset-4 rounded-[2rem] bg-[#ccff00]/5 animate-pulse" />
      </div>

      <div className="space-y-4 max-w-md">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-white">
          Welcome to alka<span className="font-bold">tera</span>
        </h1>
        {currentOrganization?.name ? (
          <p className="text-lg text-white/60">
            You&apos;ve been invited by <span className="text-[#ccff00] font-medium">{currentOrganization.name}</span> to share your sustainability data.
          </p>
        ) : (
          <p className="text-lg text-white/60">
            You&apos;ve been invited to share your sustainability data with your customers.
          </p>
        )}
      </div>

      <p className="text-sm text-white/40 max-w-sm">
        Together, we&apos;re building a more transparent supply chain for the drinks industry.
        This quick setup takes about 10 minutes — you can pause and come back anytime.
      </p>

      <Button
        size="lg"
        onClick={completeStep}
        className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium text-base px-8 rounded-xl"
      >
        Let&apos;s Go
      </Button>
    </div>
  )
}
