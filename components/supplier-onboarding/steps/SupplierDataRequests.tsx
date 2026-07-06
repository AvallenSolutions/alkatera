'use client'

import { useSupplierOnboarding } from '@/lib/supplier-onboarding'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, Bell, ClipboardCheck, BarChart3 } from 'lucide-react'

const steps = [
  {
    icon: Bell,
    title: 'You receive a request',
    description: 'When your customers need environmental data for their products, they send a data request through alkatera.',
  },
  {
    icon: ClipboardCheck,
    title: 'You provide your data',
    description: 'Review the request and share the relevant environmental impact data for your products: climate, water, waste, and nature metrics.',
  },
  {
    icon: BarChart3,
    title: 'It feeds their calculations',
    description: 'Your data flows directly into your customers\' sustainability assessments, helping build accurate supply chain footprints.',
  },
]

export function SupplierDataRequests() {
  const { completeStep, previousStep } = useSupplierOnboarding()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-display font-bold tracking-tight text-foreground">
            Understanding data requests.
          </h2>
          <p className="text-sm text-muted-foreground">
            Data requests are the core of how you collaborate with your customers on sustainability.
          </p>
        </div>

        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div
              key={step.title}
              className="rounded-[6px] border border-border bg-card p-4 flex gap-4 items-start"
            >
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-[6px] bg-secondary flex items-center justify-center">
                  <step.icon className="w-5 h-5 text-studio-forest" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] font-bold tabular-nums text-studio-forest">
                    0{idx + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[6px] border border-border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground">
            You&apos;ll find all your data requests under{' '}
            <span className="text-studio-forest font-medium">Data Requests</span> in the navigation bar.
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-muted-foreground hover:text-foreground hover:bg-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={completeStep}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
