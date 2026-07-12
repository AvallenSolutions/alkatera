'use client'

import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { Users, ArrowRight } from 'lucide-react'
import { Eyebrow, PillButton } from '@/components/studio'

export function MemberWelcomeScreen() {
  const { completeStep } = useOnboarding()
  const { currentOrganization } = useOrganization()

  const orgName = currentOrganization?.name || 'your organisation'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4 animate-in fade-in duration-700">
      {/* Icon area */}
      <div className="w-20 h-20 rounded-[6px] bg-studio-cream border border-studio-hairline flex items-center justify-center">
        <Users className="w-10 h-10 text-studio-forest" />
      </div>

      <div className="space-y-4 max-w-md">
        <Eyebrow tone="dim" className="justify-center flex">Member onboarding</Eyebrow>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-foreground">
          Welcome to {orgName}.
        </h1>
        <p className="text-lg text-muted-foreground">
          You&apos;ve been invited to join the sustainability journey. Let&apos;s get you up to speed.
        </p>
      </div>

      <p className="text-sm text-studio-dim max-w-sm">
        We&apos;ll give you a quick tour of the platform and personalise your experience. This will only take a couple of minutes.
      </p>

      <PillButton onClick={completeStep} variant="ink" size="md" className="px-6">
        Let&apos;s Go
        <ArrowRight className="h-4 w-4" />
      </PillButton>
    </div>
  )
}
