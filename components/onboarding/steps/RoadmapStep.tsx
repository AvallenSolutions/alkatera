'use client'

import { useOnboarding } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RoadmapPhase {
  title: string
  items: string[]
  status: 'current' | 'locked' | 'completed'
  unlockAt?: string
}

export function RoadmapStep() {
  const { completeStep, previousStep, state } = useOnboarding()

  const phases: RoadmapPhase[] = [
    {
      title: 'Phase 1: Foundation',
      status: 'current',
      items: [
        'Set up company profile',
        'Add products',
        'Add facilities',
        'Track core metrics (Scope 1, 2, 3)',
      ],
    },
    {
      title: 'Phase 2: Complete Products',
      status: 'locked',
      unlockAt: '30%',
      items: [
        'Add ingredients to products',
        'Add packaging details',
        'Calculate product LCAs',
      ],
    },
    {
      title: 'Phase 3: Measurement',
      status: 'locked',
      unlockAt: '60%',
      items: [
        'Complete facility data',
        'Enter utility bills',
        'Track waste & water',
      ],
    },
    {
      title: 'Phase 4: Insights & Reporting',
      status: 'locked',
      unlockAt: '90%',
      items: [
        'View complete carbon footprint',
        'Industry comparisons',
        'Generate reports',
      ],
    },
  ]

  const roleLabel = state.personalization.role
    ? state.personalization.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'User'
  const beverageLabel = state.personalization.beverageTypes?.[0]
    ? state.personalization.beverageTypes[0].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Beverages'
  const sizeLabel = state.personalization.companySize || ''

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-serif font-bold text-foreground">
            Your Personalised Sustainability Roadmap
          </h3>
          <p className="text-sm text-muted-foreground">
            Based on your role ({roleLabel}), category ({beverageLabel}){sizeLabel ? `, and size (${sizeLabel})` : ''}:
          </p>
        </div>

        <div className="space-y-4">
          {phases.map((phase, idx) => (
            <div
              key={phase.title}
              className={cn(
                'rounded-xl border p-4 transition-all',
                phase.status === 'current'
                  ? 'border-[#ccff00]/50 bg-[#ccff00]/5'
                  : 'border-border bg-card/50 opacity-70'
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm text-foreground">
                  {phase.title}
                </h4>
                {phase.status === 'current' && (
                  <span className="text-xs bg-[#ccff00]/20 text-[#ccff00] px-2 py-0.5 rounded-full font-medium">
                    You are here
                  </span>
                )}
                {phase.status === 'locked' && phase.unlockAt && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Unlock at {phase.unlockAt}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {phase.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    {phase.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#ccff00] flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>{item}</span>
                    {phase.status === 'current' && i === 0 && (
                      <span className="text-xs text-[#ccff00] ml-auto">Next</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={completeStep}
            className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
          >
            Start Foundation Phase
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
