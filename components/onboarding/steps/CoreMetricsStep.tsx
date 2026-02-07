'use client'

import { useOnboarding } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, SkipForward, CheckSquare, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricItem {
  name: string
  description: string
  core: boolean
}

const CORE_METRICS: MetricItem[] = [
  { name: 'Scope 1 Emissions', description: 'Direct: heating, company vehicles', core: true },
  { name: 'Scope 2 Emissions', description: 'Electricity & purchased energy', core: true },
  { name: 'Scope 3 Emissions', description: 'Supply chain, distribution, waste', core: true },
  { name: 'Water Usage', description: 'Critical for brewing/distilling', core: true },
  { name: 'Waste Generation & Diversion', description: 'Including spent grain, wastewater', core: true },
]

const ADDITIONAL_METRICS: MetricItem[] = [
  { name: 'Packaging materials breakdown', description: 'Detailed packaging analysis', core: false },
  { name: 'Transportation modes', description: 'Logistics emission tracking', core: false },
  { name: 'Renewable energy generation', description: 'On-site generation tracking', core: false },
  { name: 'Biodiversity impact', description: 'Nature and land use', core: false },
]

export function CoreMetricsStep() {
  const { completeStep, previousStep, skipStep } = useOnboarding()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-serif font-bold text-white">
            What Will You Track?
          </h3>
          <p className="text-sm text-white/50">
            For drinks producers, these are the essential metrics to track. We&apos;ll start with these core areas:
          </p>
        </div>

        {/* Core metrics */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-[#ccff00] uppercase tracking-wider mb-2">
            Core Metrics (Pre-selected)
          </p>
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 space-y-2">
            {CORE_METRICS.map(metric => (
              <div key={metric.name} className="flex items-start gap-3 py-1">
                <CheckSquare className="w-5 h-5 text-[#ccff00] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">{metric.name}</p>
                  <p className="text-xs text-white/50">{metric.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Additional metrics */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
            Additional (Add later as you grow)
          </p>
          <div className="bg-white/[0.03] backdrop-blur-md border border-white/[0.07] rounded-xl p-3 space-y-2 opacity-60">
            {ADDITIONAL_METRICS.map(metric => (
              <div key={metric.name} className="flex items-start gap-3 py-1">
                <Square className="w-5 h-5 text-white/30 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white/30">{metric.name}</p>
                  <p className="text-xs text-white/20">{metric.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-white/40 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipStep} className="text-white/40 hover:text-white hover:bg-white/10 text-sm">
              <SkipForward className="w-4 h-4 mr-1" />
              Skip
            </Button>
            <Button
              onClick={completeStep}
              className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
            >
              Continue with core metrics
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
