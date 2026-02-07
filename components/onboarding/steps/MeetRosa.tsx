'use client'

import { useOnboarding } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { Bot, CheckCircle2, ArrowLeft } from 'lucide-react'

export function MeetRosa() {
  const { completeStep, previousStep } = useOnboarding()

  const capabilities = [
    'Answer your sustainability questions',
    'Help you find data and create reports',
    'Suggest improvements',
    'Celebrate your progress',
  ]

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4 animate-in slide-in-from-right duration-500">
      {/* Rosa avatar */}
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 flex items-center justify-center border border-emerald-400/30">
        <Bot className="w-10 h-10 text-emerald-400" />
      </div>

      <div className="space-y-4 max-w-md">
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground">
          Meet Rosa, Your Sustainability Guide
        </h2>
        <p className="text-muted-foreground">
          &quot;Hi! I&apos;m Rosa, your sustainability guide. I&apos;ll be here to help you throughout Alkatera.&quot;
        </p>
        <p className="text-sm text-muted-foreground">
          Think of me as your co-pilot. I can:
        </p>
      </div>

      <div className="space-y-3 text-left max-w-sm w-full">
        {capabilities.map((capability) => (
          <div
            key={capability}
            className="flex items-center gap-3 text-sm text-foreground"
          >
            <CheckCircle2 className="w-5 h-5 text-[#ccff00] flex-shrink-0" />
            <span>{capability}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground max-w-sm">
        You can always ask Rosa for help by clicking her icon in the sidebar.
      </p>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={previousStep}
          className="text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          size="lg"
          onClick={completeStep}
          className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium text-base px-8 rounded-xl"
        >
          Let&apos;s go!
        </Button>
      </div>
    </div>
  )
}
