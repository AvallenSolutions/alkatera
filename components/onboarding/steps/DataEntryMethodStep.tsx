'use client'

import { useOnboarding } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, SkipForward, ClipboardList, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export function DataEntryMethodStep() {
  const { completeStep, previousStep, skipStep } = useOnboarding()
  const [selected, setSelected] = useState<'guided' | 'bulk' | null>(null)

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-serif font-bold text-foreground">
            How would you like to add your data?
          </h3>
          <p className="text-sm text-muted-foreground">
            Choose your preferred method:
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setSelected('guided')}
            className={cn(
              'w-full text-left p-4 rounded-xl border transition-all',
              selected === 'guided'
                ? 'border-[#ccff00] bg-[#ccff00]/10'
                : 'border-border bg-card hover:border-muted-foreground/30'
            )}
          >
            <div className="flex items-start gap-3">
              <ClipboardList className="w-6 h-6 text-[#ccff00] flex-shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">Guided Setup</p>
                  <span className="text-xs bg-[#ccff00]/20 text-[#ccff00] px-2 py-0.5 rounded-full">Recommended</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  We&apos;ll walk you through step-by-step
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">~5-8 minutes</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setSelected('bulk')}
            className={cn(
              'w-full text-left p-4 rounded-xl border transition-all',
              selected === 'bulk'
                ? 'border-[#ccff00] bg-[#ccff00]/10'
                : 'border-border bg-card hover:border-muted-foreground/30'
            )}
          >
            <div className="flex items-start gap-3">
              <Upload className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Bulk Import from Files</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload CSV or Excel
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">~2 minutes (if files ready)</p>
              </div>
            </div>
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          You can mix & match these anytime.
        </p>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipStep} className="text-muted-foreground text-sm">
              <SkipForward className="w-4 h-4 mr-1" />
              Skip
            </Button>
            <Button
              onClick={completeStep}
              disabled={!selected}
              className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
