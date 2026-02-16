'use client'

import { Dog, MessageCircle } from 'lucide-react'
import { ROSA_WIZARD_MESSAGES, type EPRWizardStep } from '@/lib/epr/wizard-types'
import { cn } from '@/lib/utils'

interface RosaGuideProps {
  step: EPRWizardStep
  className?: string
}

/**
 * Rosa Guide — contextual AI assistant panel for the EPR wizard.
 *
 * Displays Rosa's Dog icon with an emerald gradient background and a
 * step-specific message in a speech-bubble style card. Responsive:
 * side panel on desktop (w-80), top banner on mobile.
 */
export function RosaGuide({ step, className }: RosaGuideProps) {
  const message = ROSA_WIZARD_MESSAGES[step]

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 p-5',
        'lg:sticky lg:top-6',
        className
      )}
    >
      {/* Rosa avatar */}
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 backdrop-blur-md flex items-center justify-center border border-emerald-400/30 flex-shrink-0">
        <Dog className="w-8 h-8 text-emerald-400" />
      </div>

      {/* Name */}
      <div className="text-center">
        <p className="text-sm font-semibold text-emerald-400">Rosa</p>
        <p className="text-xs text-muted-foreground">Your sustainability guide</p>
      </div>

      {/* Speech bubble */}
      <div className="relative w-full">
        {/* Bubble arrow */}
        <div className="hidden lg:block absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-emerald-500/10 border-t border-l border-emerald-400/20" />

        <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-start gap-2">
            <MessageCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/80 leading-relaxed">{message}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
