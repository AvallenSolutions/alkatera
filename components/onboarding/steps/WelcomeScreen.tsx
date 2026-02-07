'use client'

import { useOnboarding } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { Leaf } from 'lucide-react'

export function WelcomeScreen() {
  const { completeStep } = useOnboarding()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4 animate-in fade-in duration-700">
      {/* Animated logo area */}
      <div className="relative">
        <div className="w-24 h-24 rounded-3xl bg-[#ccff00]/20 flex items-center justify-center animate-in zoom-in duration-500">
          <Leaf className="w-12 h-12 text-[#ccff00]" />
        </div>
        <div className="absolute -inset-4 rounded-[2rem] bg-[#ccff00]/5 animate-pulse" />
      </div>

      <div className="space-y-4 max-w-md">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
          Welcome to Your Sustainability Control Centre
        </h1>
        <p className="text-lg text-muted-foreground">
          Let&apos;s build something meaningful together.
        </p>
      </div>

      <p className="text-sm text-muted-foreground max-w-sm">
        We&apos;ll walk you through setting up your sustainability platform in about 20 minutes. You can pause and come back anytime.
      </p>

      <Button
        size="lg"
        onClick={completeStep}
        className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium text-base px-8 rounded-xl"
      >
        Continue
      </Button>
    </div>
  )
}
