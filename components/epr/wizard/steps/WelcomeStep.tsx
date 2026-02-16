'use client'

import { Dog, CheckCircle2, ArrowRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WelcomeStepProps {
  onComplete: () => void
  onBack: () => void
  onSkip?: () => void
}

const FEATURES = [
  'Set up your organisation details',
  'Complete packaging EPR data',
  'Generate your RPD submission',
] as const

export function WelcomeStep({ onComplete }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Rosa avatar */}
      <div className="relative">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 backdrop-blur-md border border-emerald-400/30 flex items-center justify-center animate-in zoom-in duration-500">
          <Dog className="w-12 h-12 text-emerald-400" />
        </div>
        <div className="absolute -inset-4 rounded-[2rem] bg-emerald-400/5 animate-pulse" />
      </div>

      {/* Heading */}
      <div className="space-y-4 max-w-lg">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
          Let&apos;s Get Your EPR Sorted
        </h1>
        <p className="text-lg text-muted-foreground">
          Extended Producer Responsibility is the UK&apos;s packaging waste law.
          Every producer placing packaging on the market must report to Defra.
        </p>
      </div>

      {/* What this wizard helps with */}
      <div className="bg-muted/50 backdrop-blur-md border border-border rounded-2xl p-6 w-full max-w-md space-y-4">
        <p className="text-sm font-medium text-muted-foreground">
          This wizard will walk you through:
        </p>
        <ul className="space-y-3 text-left">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-neon-lime flex-shrink-0" />
              <span className="text-sm text-foreground/80">{feature}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Estimated time: ~13 minutes total
          </span>
        </div>
      </div>

      {/* CTA */}
      <Button
        size="lg"
        onClick={onComplete}
        className="bg-neon-lime text-black hover:bg-neon-lime/80 font-medium text-base px-8 rounded-xl"
      >
        Let&apos;s Begin
        <ArrowRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  )
}
