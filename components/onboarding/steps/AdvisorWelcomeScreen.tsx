'use client'

import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { Button } from '@/components/ui/button'
import { Briefcase } from 'lucide-react'
import { Eyebrow } from '@/components/studio'

export function AdvisorWelcomeScreen() {
  const { completeStep } = useOnboarding()
  const { currentOrganization } = useOrganization()

  const orgName = currentOrganization?.name || 'your client'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4 animate-in fade-in duration-700">
      {/* Icon area */}
      <div className="w-20 h-20 rounded-[6px] bg-card border border-border flex items-center justify-center">
        <Briefcase className="w-10 h-10 text-studio-forest" />
      </div>

      <div className="space-y-4 max-w-md">
        <Eyebrow tone="inherit" className="text-studio-forest">Advisor onboarding</Eyebrow>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-foreground">
          You&apos;re advising {orgName}.
        </h1>
        <p className="text-lg text-muted-foreground">
          Welcome aboard. You&apos;ve joined as a sustainability advisor, working
          directly inside {orgName}&apos;s data to help them measure and reduce
          their impact.
        </p>
      </div>

      <p className="text-sm text-studio-dim max-w-sm">
        Here&apos;s a quick orientation on what you can do and who you&apos;re
        helping. It takes less than a minute.
      </p>

      <Button
        size="lg"
        onClick={completeStep}
        className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-base px-8 rounded-full"
      >
        Get Started
      </Button>
    </div>
  )
}
