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
          <h3 className="text-xl font-display font-bold text-foreground">
            What you&apos;ll track.
          </h3>
          <p className="text-sm text-muted-foreground">
            For drinks producers, these are the essential metrics to track. We&apos;ll start with these core areas:
          </p>
        </div>

        {/* Core metrics */}
        <div className="space-y-1">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-forest mb-2">
            Core metrics · pre-selected
          </p>
          <div className="rounded-[6px] border border-border bg-card p-3 space-y-2">
            {CORE_METRICS.map(metric => (
              <div key={metric.name} className="flex items-start gap-3 py-1">
                <CheckSquare className="w-5 h-5 text-studio-forest flex-shrink-0 mt-0.5" />
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
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim mb-2">
            Additional · add later as you grow
          </p>
          <div className="rounded-[6px] border border-border bg-card p-3 space-y-2 opacity-60">
            {ADDITIONAL_METRICS.map(metric => (
              <div key={metric.name} className="flex items-start gap-3 py-1">
                <Square className="w-5 h-5 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">{metric.name}</p>
                  <p className="text-xs text-muted-foreground/70">{metric.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-muted-foreground hover:text-foreground hover:bg-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipStep} className="text-muted-foreground hover:text-foreground hover:bg-secondary text-sm">
              <SkipForward className="w-4 h-4 mr-1" />
              Skip
            </Button>
            <Button
              onClick={completeStep}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-[6px]"
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
