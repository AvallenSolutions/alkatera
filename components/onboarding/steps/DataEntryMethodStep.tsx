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
          <h3 className="text-xl font-display font-bold text-foreground">
            How you&apos;ll add your data.
          </h3>
          <p className="text-sm text-muted-foreground">
            Choose your preferred method:
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setSelected('guided')}
            className={cn(
              'w-full text-left p-4 rounded-[6px] border transition-all',
              selected === 'guided'
                ? 'border-studio-forest bg-secondary'
                : 'border-border bg-card hover:border-foreground/30'
            )}
          >
            <div className="flex items-start gap-3">
              <ClipboardList className="w-6 h-6 text-studio-forest flex-shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">Guided Setup</p>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-forest">Recommended</span>
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
              'w-full text-left p-4 rounded-[6px] border transition-all',
              selected === 'bulk'
                ? 'border-studio-forest bg-secondary'
                : 'border-border bg-card hover:border-foreground/30'
            )}
          >
            <div className="flex items-start gap-3">
              <Upload className="w-6 h-6 text-studio-forest flex-shrink-0 mt-0.5" />
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
          <Button variant="ghost" onClick={previousStep} className="text-muted-foreground hover:text-foreground hover:bg-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipStep} className="text-muted-foreground hover:text-foreground hover:bg-secondary text-sm">
              <SkipForward className="w-4 h-4 mr-1" />
              Skip
            </Button>
            <Button
              onClick={completeStep}
              disabled={!selected}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-[6px]"
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
