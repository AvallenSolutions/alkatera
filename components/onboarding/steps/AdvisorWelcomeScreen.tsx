'use client'

import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { Briefcase, ArrowRight } from 'lucide-react'
import { Eyebrow, PillButton } from '@/components/studio'

export function AdvisorWelcomeScreen() {
  const { completeStep } = useOnboarding()
  const { currentOrganization } = useOrganization()

  const orgName = currentOrganization?.name || 'your client'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4 animate-in fade-in duration-700">
      {/* Icon area */}
      <div className="w-20 h-20 rounded-[6px] bg-studio-cream border border-studio-hairline flex items-center justify-center">
        <Briefcase className="w-10 h-10 text-studio-forest" />
      </div>

      <div className="space-y-4 max-w-md">
        <Eyebrow tone="dim" className="justify-center flex">Advisor onboarding</Eyebrow>
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

      <PillButton onClick={completeStep} variant="ink" size="md" className="px-6">
        Get Started
        <ArrowRight className="h-4 w-4" />
      </PillButton>
    </div>
  )
}
