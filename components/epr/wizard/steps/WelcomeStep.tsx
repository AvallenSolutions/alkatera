'use client'

import { Dog, CheckCircle2, ArrowRight, Clock } from 'lucide-react'
import { PillButton } from '@/components/studio/pill-button'

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
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4 animate-in fade-in duration-300">
      {/* Rosa avatar */}
      <div className="w-24 h-24 rounded-[6px] border border-studio-hairline bg-studio-paper flex items-center justify-center">
        <Dog className="w-12 h-12 text-room-accent" />
      </div>

      {/* Heading */}
      <div className="space-y-4 max-w-lg">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
          Let&apos;s Get Your EPR Sorted
        </h1>
        <p className="text-lg text-muted-foreground">
          Extended Producer Responsibility is the UK&apos;s packaging waste law.
          Every producer placing packaging on the market must report to Defra.
        </p>
      </div>

      {/* What this wizard helps with */}
      <div className="rounded-[6px] border border-studio-hairline bg-studio-paper p-6 w-full max-w-md space-y-4">
        <p className="text-sm font-medium text-muted-foreground">
          This wizard will walk you through:
        </p>
        <ul className="space-y-3 text-left">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-studio-good flex-shrink-0" />
              <span className="text-sm text-foreground/80">{feature}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 pt-2 border-t border-studio-hairline">
          <Clock className="w-4 h-4 text-studio-dim" />
          <span className="text-xs text-studio-dim">
            Estimated time: ~13 minutes total
          </span>
        </div>
      </div>

      {/* CTA */}
      <PillButton variant="ink" onClick={onComplete} className="px-8 text-base">
        Let&apos;s Begin
        <ArrowRight className="w-5 h-5" />
      </PillButton>
    </div>
  )
}
