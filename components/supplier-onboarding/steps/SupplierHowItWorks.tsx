'use client'

import { useSupplierOnboarding } from '@/lib/supplier-onboarding'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, LayoutDashboard, Building2, ClipboardList, Package } from 'lucide-react'

const features = [
  {
    icon: LayoutDashboard,
    title: 'Your Dashboard',
    description: 'An overview of your activity: data requests, products, and quick stats at a glance.',
  },
  {
    icon: Building2,
    title: 'Company Profile',
    description: 'Tell your customers who you are: your company details, industry, and sustainability practices.',
  },
  {
    icon: ClipboardList,
    title: 'Data Requests',
    description: 'When customers need environmental data for their supply chain, their requests appear here.',
  },
  {
    icon: Package,
    title: 'Products',
    description: 'Catalogue your products with verified environmental impact data across climate, water, waste, and nature.',
  },
]

export function SupplierHowItWorks() {
  const { completeStep, previousStep } = useSupplierOnboarding()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-display font-bold tracking-tight text-foreground">
            How it works.
          </h2>
          <p className="text-sm text-muted-foreground">
            Your supplier portal has four key areas. Here&apos;s what each one does.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map(feature => (
            <div
              key={feature.title}
              className="rounded-[6px] border border-border bg-card p-4 space-y-2"
            >
              <div className="w-10 h-10 rounded-[6px] bg-secondary flex items-center justify-center">
                <feature.icon className="w-5 h-5 text-studio-forest" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-studio-dim text-center">
          Everything is free for suppliers, no subscription required.
        </p>

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
