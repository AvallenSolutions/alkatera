'use client'

import { useOnboarding } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle2, Factory, Package, BarChart3 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

export function FoundationComplete() {
  const { completeStep, state } = useOnboarding()

  const completedItems = [
    { label: 'Company profile configured', icon: CheckCircle2 },
    { label: 'Personalised experience set up', icon: CheckCircle2 },
  ]

  // Check if user completed optional steps
  if (state.completedSteps.includes('first-product')) {
    completedItems.push({ label: 'First product added', icon: Package })
  }
  if (state.completedSteps.includes('facilities-setup')) {
    completedItems.push({ label: 'Facility mapped', icon: Factory })
  }
  if (state.completedSteps.includes('core-metrics')) {
    completedItems.push({ label: 'Core metrics selected', icon: BarChart3 })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-500 text-center">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3">
          <div className="text-4xl">&#127881;</div>
          <h3 className="text-2xl font-serif font-bold text-white">
            Your Foundation is Set!
          </h3>
          <p className="text-sm text-white/50">
            Great progress! Here&apos;s what you&apos;ve accomplished:
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 space-y-3 text-left">
          {completedItems.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-[#ccff00] flex-shrink-0" />
              <span className="text-sm text-white">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Progress</span>
            <span className="font-medium text-white">75%</span>
          </div>
          <Progress value={75} indicatorColor="lime" />
        </div>

        <div className="bg-emerald-400/5 backdrop-blur-md border border-emerald-400/20 rounded-xl p-4">
          <p className="text-sm text-white">
            <span className="font-medium text-emerald-400">Next up:</span>{' '}
            Discover the powerful features that will help you on your sustainability journey.
          </p>
        </div>

        <Button
          size="lg"
          onClick={completeStep}
          className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium text-base px-8 rounded-xl w-full"
        >
          See what&apos;s possible
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
