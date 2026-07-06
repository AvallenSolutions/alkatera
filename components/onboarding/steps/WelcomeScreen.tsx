'use client'

import { useOnboarding } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { Leaf, ArrowRight } from 'lucide-react'

export function WelcomeScreen() {
  const { completeStep } = useOnboarding()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4 animate-in fade-in duration-700">
      {/* Logo mark */}
      <div className="w-24 h-24 rounded-[6px] border border-border bg-card flex items-center justify-center">
        <Leaf className="w-12 h-12 text-studio-forest" />
      </div>

      <div className="space-y-4 max-w-md">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
          Your sustainability control centre.
        </h1>
        <p className="text-lg text-muted-foreground">
          Let&apos;s get your account set up. It only takes about 10 minutes to see your estimated carbon footprint.
        </p>
      </div>

      <Button
        onClick={completeStep}
        size="lg"
        className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base rounded-[6px] px-8 py-4 h-auto"
      >
        Get Started
        <ArrowRight className="w-5 h-5 ml-2" />
      </Button>

      <p className="text-xs text-muted-foreground">You can skip steps and come back to complete your setup later.</p>
    </div>
  )
}
