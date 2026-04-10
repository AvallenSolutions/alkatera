'use client'

import { useOnboarding } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { Leaf, ArrowRight } from 'lucide-react'

export function WelcomeScreen() {
  const { completeStep } = useOnboarding()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4 animate-in fade-in duration-700">
      {/* Animated logo area */}
      <div className="relative">
        <div className="w-24 h-24 rounded-3xl bg-[#ccff00]/20 backdrop-blur-md border border-[#ccff00]/30 flex items-center justify-center animate-in zoom-in duration-500">
          <Leaf className="w-12 h-12 text-[#ccff00]" />
        </div>
        <div className="absolute -inset-4 rounded-[2rem] bg-[#ccff00]/5 animate-pulse" />
      </div>

      <div className="space-y-4 max-w-md">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-white">
          Welcome to Your Sustainability Control Centre
        </h1>
        <p className="text-lg text-white/60">
          Let&apos;s get your account set up. It only takes about 10 minutes to see your estimated carbon footprint.
        </p>
      </div>

      <Button
        onClick={completeStep}
        size="lg"
        className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-semibold text-base rounded-2xl px-8 py-4 h-auto"
      >
        Get Started
        <ArrowRight className="w-5 h-5 ml-2" />
      </Button>

      <p className="text-xs text-white/30">You can skip steps and come back to complete your setup later.</p>
    </div>
  )
}
