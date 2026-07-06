'use client'

import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { Button } from '@/components/ui/button'
import { Users } from 'lucide-react'
import { Eyebrow } from '@/components/studio'

export function MemberWelcomeScreen() {
  const { completeStep } = useOnboarding()
  const { currentOrganization } = useOrganization()

  const orgName = currentOrganization?.name || 'your organisation'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4 animate-in fade-in duration-700">
      {/* Icon area */}
      <div className="w-20 h-20 rounded-[6px] bg-card border border-border flex items-center justify-center">
        <Users className="w-10 h-10 text-studio-forest" />
      </div>

      <div className="space-y-4 max-w-md">
        <Eyebrow tone="inherit" className="text-studio-forest">Member onboarding</Eyebrow>
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

      <Button
        size="lg"
        onClick={completeStep}
        className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-base px-8 rounded-full"
      >
        Let&apos;s Go
      </Button>
    </div>
  )
}
