'use client'

import { useOnboarding } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ShieldCheck,
  Dog,
  FileText,
  BookOpen,
  Leaf,
  CheckCircle2,
} from 'lucide-react'

const PLATFORM_FEATURES = [
  {
    icon: BarChart3,
    title: 'Dashboard & Vitality Scores',
    description: 'View real-time sustainability metrics at a glance',
    color: 'text-purple-400',
  },
  {
    icon: Leaf,
    title: 'Product Passports',
    description: 'Explore detailed environmental profiles for each product',
    color: 'text-emerald-400',
  },
  {
    icon: Dog,
    title: 'Ask Rosa',
    description: 'Your AI sustainability assistant for instant insights',
    color: 'text-amber-400',
  },
  {
    icon: ShieldCheck,
    title: 'Greenwash Guardian',
    description: 'Verify sustainability claims across your organisation',
    color: 'text-blue-400',
  },
  {
    icon: FileText,
    title: 'Reports & Exports',
    description: 'Generate professional sustainability reports',
    color: 'text-cyan-400',
  },
  {
    icon: BookOpen,
    title: 'Knowledge Bank',
    description: 'Access comprehensive sustainability resources',
    color: 'text-orange-400',
  },
]

export function MemberPlatformTour() {
  const { completeStep, previousStep } = useOnboarding()

  return (
    <div className="flex flex-col items-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="text-3xl">&#128640;</div>
          <h3 className="text-xl font-serif font-bold text-white">
            What You Can Do
          </h3>
          <p className="text-sm text-white/50">
            Here&apos;s what&apos;s available to you on the platform
          </p>
        </div>

        <div className="grid gap-3">
          {PLATFORM_FEATURES.map(feature => (
            <div
              key={feature.title}
              className="flex items-start gap-3 p-3 rounded-xl bg-white/5 backdrop-blur-md border border-white/10"
            >
              <CheckCircle2 className={`w-5 h-5 ${feature.color} flex-shrink-0 mt-0.5`} />
              <div>
                <p className="text-sm font-medium text-white">{feature.title}</p>
                <p className="text-xs text-white/40">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <Button variant="ghost" onClick={previousStep} className="text-white/40 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={completeStep}
            className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
          >
            Almost done!
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
