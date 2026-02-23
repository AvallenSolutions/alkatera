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
    description: 'Review the request and share the relevant environmental impact data for your products — climate, water, waste, and nature metrics.',
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
          <h2 className="text-2xl font-serif font-bold text-white">
            Understanding Data Requests
          </h2>
          <p className="text-sm text-white/50">
            Data requests are the core of how you collaborate with your customers on sustainability.
          </p>
        </div>

        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div
              key={step.title}
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 flex gap-4 items-start"
            >
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-lg bg-[#ccff00]/10 border border-[#ccff00]/20 flex items-center justify-center relative">
                  <step.icon className="w-5 h-5 text-[#ccff00]" />
                  <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-[#ccff00] text-black text-[10px] font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                <p className="text-xs text-white/50 mt-1 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#ccff00]/5 border border-[#ccff00]/20 rounded-xl p-4 text-center">
          <p className="text-xs text-white/60">
            You&apos;ll find all your data requests under{' '}
            <span className="text-[#ccff00] font-medium">Data Requests</span> in the navigation bar.
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-white/40 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={completeStep}
            className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
