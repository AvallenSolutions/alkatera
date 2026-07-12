'use client'

import { Dog, MessageCircle } from 'lucide-react'
import { ROSA_WIZARD_MESSAGES, type EPRWizardStep } from '@/lib/epr/wizard-types'
import { cn } from '@/lib/utils'

interface RosaGuideProps {
  step: EPRWizardStep
  className?: string
}

/**
 * Rosa Guide — contextual assistant panel for the EPR wizard.
 *
 * Quiet paper treatment: hairline-bordered avatar tile and a step-specific
 * message card. Responsive: side panel on desktop, top banner on mobile.
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
      <div className="w-16 h-16 rounded-[6px] border border-studio-hairline bg-studio-paper flex items-center justify-center flex-shrink-0">
        <Dog className="w-8 h-8 text-room-accent" />
      </div>

      {/* Name */}
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">Rosa</p>
        <p className="text-xs text-studio-dim">Your sustainability guide</p>
      </div>

      {/* Message */}
      <div className="w-full rounded-[6px] border border-studio-hairline bg-studio-paper p-4">
        <div className="flex items-start gap-2">
          <MessageCircle className="w-4 h-4 text-studio-dim flex-shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/80 leading-relaxed">{message}</p>
        </div>
      </div>
    </div>
  )
}
