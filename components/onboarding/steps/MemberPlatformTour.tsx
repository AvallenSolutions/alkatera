'use client'

import { useOnboarding } from '@/lib/onboarding'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ShieldCheck,
  Dog,
  FileText,
  BookOpen,
  Leaf,
} from 'lucide-react'
import { Eyebrow, PillButton } from '@/components/studio'

const PLATFORM_FEATURES = [
  {
    icon: BarChart3,
    title: 'Dashboard & Vitality Scores',
    description: 'View real-time sustainability metrics at a glance',
  },
  {
    icon: Leaf,
    title: 'Product Passports',
    description: 'Explore detailed environmental profiles for each product',
  },
  {
    icon: Dog,
    title: 'Ask Rosa',
    description: 'Your sustainability partner for instant insights',
  },
  {
    icon: ShieldCheck,
    title: 'Greenwash Guardian',
    description: 'Verify sustainability claims across your organisation',
  },
  {
    icon: FileText,
    title: 'Reports & Exports',
    description: 'Generate professional sustainability reports',
  },
  {
    icon: BookOpen,
    title: 'Knowledge Bank',
    description: 'Access comprehensive sustainability resources',
  },
]

export function MemberPlatformTour() {
  const { completeStep, previousStep } = useOnboarding()

  return (
    <div className="flex flex-col items-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <Eyebrow tone="dim" className="justify-center flex">Platform tour</Eyebrow>
          <h3 className="text-xl font-display font-bold tracking-tight text-foreground">
            What you can do.
          </h3>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s available to you on the platform
          </p>
        </div>

        <div className="grid gap-3">
          {PLATFORM_FEATURES.map(feature => (
            <div
              key={feature.title}
              className="flex items-start gap-3 p-3 rounded-[6px] bg-studio-cream border border-studio-hairline"
            >
              <feature.icon className="w-5 h-5 text-studio-forest flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">{feature.title}</p>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <PillButton variant="ghost" size="md" onClick={previousStep}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </PillButton>
          <PillButton variant="ink" size="md" onClick={completeStep}>
            Almost done!
            <ArrowRight className="w-4 h-4" />
          </PillButton>
        </div>
      </div>
    </div>
  )
}
