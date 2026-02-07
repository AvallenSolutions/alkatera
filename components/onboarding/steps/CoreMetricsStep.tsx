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
          <h3 className="text-xl font-serif font-bold text-foreground">
            What Will You Track?
          </h3>
          <p className="text-sm text-muted-foreground">
            For drinks producers, these are the essential metrics to track. We&apos;ll start with these core areas:
          </p>
        </div>

        {/* Core metrics */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-[#ccff00] uppercase tracking-wider mb-2">
            Core Metrics (Pre-selected)
          </p>
          <div className="bg-card/50 border border-border rounded-xl p-3 space-y-2">
            {CORE_METRICS.map(metric => (
              <div key={metric.name} className="flex items-start gap-3 py-1">
                <CheckSquare className="w-5 h-5 text-[#ccff00] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">{metric.name}</p>
                  <p className="text-xs text-muted-foreground">{metric.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Additional metrics */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Additional (Add later as you grow)
          </p>
          <div className="bg-card/30 border border-border/50 rounded-xl p-3 space-y-2 opacity-60">
            {ADDITIONAL_METRICS.map(metric => (
              <div key={metric.name} className="flex items-start gap-3 py-1">
                <Square className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">{metric.name}</p>
                  <p className="text-xs text-muted-foreground/60">{metric.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipStep} className="text-muted-foreground text-sm">
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
