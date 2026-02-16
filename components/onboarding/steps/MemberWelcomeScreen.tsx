'use client'

import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { Button } from '@/components/ui/button'
import { Users } from 'lucide-react'

export function MemberWelcomeScreen() {
  const { completeStep } = useOnboarding()
  const { currentOrganization } = useOrganization()

  const orgName = currentOrganization?.name || 'your organisation'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4 animate-in fade-in duration-700">
      {/* Animated icon area */}
      <div className="relative">
        <div className="w-24 h-24 rounded-3xl bg-[#ccff00]/20 backdrop-blur-md border border-[#ccff00]/30 flex items-center justify-center animate-in zoom-in duration-500">
          <Users className="w-12 h-12 text-[#ccff00]" />
        </div>
        <div className="absolute -inset-4 rounded-[2rem] bg-[#ccff00]/5 animate-pulse" />
      </div>

      <div className="space-y-4 max-w-md">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-white">
          Welcome to {orgName}!
        </h1>
        <p className="text-lg text-white/60">
          You&apos;ve been invited to join the sustainability journey. Let&apos;s get you up to speed.
        </p>
      </div>

      <p className="text-sm text-white/40 max-w-sm">
        We&apos;ll give you a quick tour of the platform and personalise your experience. This will only take a couple of minutes.
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
