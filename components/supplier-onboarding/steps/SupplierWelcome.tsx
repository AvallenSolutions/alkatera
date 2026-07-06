'use client'

import { useSupplierOnboarding } from '@/lib/supplier-onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { Button } from '@/components/ui/button'
import { Leaf } from 'lucide-react'
import { Eyebrow } from '@/components/studio'

export function SupplierWelcome() {
  const { completeStep } = useSupplierOnboarding()
  const { currentOrganization } = useOrganization()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4 animate-in fade-in duration-700">
      {/* Logo area */}
      <div className="w-20 h-20 rounded-[6px] bg-card border border-border flex items-center justify-center">
        <Leaf className="w-10 h-10 text-studio-forest" />
      </div>

      <div className="space-y-4 max-w-md">
        <Eyebrow tone="inherit" className="text-studio-forest">Supplier onboarding</Eyebrow>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-foreground">
          Welcome to alka<span className="font-bold">tera</span>.
        </h1>
        {currentOrganization?.name ? (
          <p className="text-lg text-muted-foreground">
            You&apos;ve been invited by <span className="text-studio-forest font-medium">{currentOrganization.name}</span> to share your sustainability data.
          </p>
        ) : (
          <p className="text-lg text-muted-foreground">
            You&apos;ve been invited to share your sustainability data with your customers.
          </p>
        )}
      </div>

      <p className="text-sm text-studio-dim max-w-sm">
        Together, we&apos;re building a more transparent supply chain for the drinks industry.
        This quick setup takes about 10 minutes. You can pause and come back anytime.
      </p>

      <Button
        size="lg"
        onClick={completeStep}
        className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-base px-8 rounded-full"
      >
        Let&apos;s Go
      </Button>
    </div>
  )
}
