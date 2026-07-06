'use client'

import { useEffect, useMemo, useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import type { PrimaryGoal } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { ArrowRight, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Eyebrow } from '@/components/studio'

const REDUCTION_OPTIONS = [10, 20, 25, 30, 50] as const
const YEAR_OPTIONS = [2027, 2030, 2035, 2040] as const

/**
 * Pre-fill the target based on the user's primary goals. The numbers below
 * are deliberately conservative defaults; the user can always override.
 *  - get_certified → SBTi-style 30% by 2030 (close to the 4.2%/yr compound rate)
 *  - reduce_impact → 25% by 2030 (a clear ambition without being intimidating)
 *  - sustainability_reporting / understand_footprint / track_emissions → 20% by 2030
 *  - default → 20% by 2030
 */
function defaultFromGoals(goals?: PrimaryGoal[]): { pct: number; year: number } {
  if (!goals?.length) return { pct: 20, year: 2030 }
  if (goals.includes('get_certified')) return { pct: 30, year: 2030 }
  if (goals.includes('reduce_impact')) return { pct: 25, year: 2030 }
  return { pct: 20, year: 2030 }
}

export function FastTrackTargetStep() {
  const { completeStep, skipStep, state, updatePersonalization } = useOnboarding()

  const baseline = state.personalization?.estimateTonnesCO2e
  const defaults = useMemo(
    () => defaultFromGoals(state.personalization?.primaryGoals),
    [state.personalization?.primaryGoals],
  )

  const [pct, setPct] = useState<number>(state.personalization?.targetReductionPct ?? defaults.pct)
  const [year, setYear] = useState<number>(state.personalization?.targetYear ?? defaults.year)
  const [isSaving, setIsSaving] = useState(false)

  // Keep the in-flight selection in onboarding state so it survives a page
  // refresh mid-flow without an explicit save. The completion endpoint reads
  // these to write the sustainability_targets row.
  useEffect(() => {
    updatePersonalization({ targetReductionPct: pct, targetYear: year })
  }, [pct, year, updatePersonalization])

  const targetTonnes = baseline ? Math.round(baseline * (1 - pct / 100)) : null
  const reductionTonnes = baseline ? Math.round(baseline * (pct / 100)) : null
  const yearsToGo = year - new Date().getFullYear()
  const perYearTonnes = baseline && yearsToGo > 0 ? Math.round((baseline * (pct / 100)) / yearsToGo) : null

  const handleContinue = async () => {
    setIsSaving(true)
    // Final state save before moving on — the completion endpoint reads from here.
    updatePersonalization({ targetReductionPct: pct, targetYear: year })
    setIsSaving(false)
    completeStep()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-[6px] bg-card border border-border flex items-center justify-center">
            <Target className="w-6 h-6 text-studio-forest" />
          </div>
          <h3 className="text-2xl font-display font-bold tracking-tight text-foreground">Set your first target.</h3>
          <p className="text-sm text-muted-foreground">
            {baseline
              ? `Your baseline is ~${baseline.toLocaleString()} tonnes CO₂e/year. Rosa will track progress against this.`
              : 'Rosa will track your reduction journey against this target.'}
          </p>
        </div>

        {/* Reduction % buttons */}
        <div className="space-y-2">
          <Eyebrow tone="dim">Reduce by</Eyebrow>
          <div className="grid grid-cols-5 gap-2">
            {REDUCTION_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setPct(option)}
                className={cn(
                  'rounded-[6px] border py-3 text-center transition-colors',
                  pct === option
                    ? 'bg-secondary border-studio-forest text-studio-forest'
                    : 'bg-card border-border text-muted-foreground hover:bg-secondary hover:border-studio-ink/25',
                )}
              >
                <span className="text-sm font-semibold tabular-nums">{option}%</span>
              </button>
            ))}
          </div>
        </div>

        {/* Year buttons */}
        <div className="space-y-2">
          <Eyebrow tone="dim">By</Eyebrow>
          <div className="grid grid-cols-4 gap-2">
            {YEAR_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setYear(option)}
                className={cn(
                  'rounded-[6px] border py-3 text-center transition-colors',
                  year === option
                    ? 'bg-secondary border-studio-forest text-studio-forest'
                    : 'bg-card border-border text-muted-foreground hover:bg-secondary hover:border-studio-ink/25',
                )}
              >
                <span className="text-sm font-semibold tabular-nums">{option}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Live preview of what the target means */}
        {targetTonnes !== null && reductionTonnes !== null && (
          <div className="rounded-[6px] border border-border bg-card p-4 space-y-2">
            <Eyebrow tone="inherit" className="text-studio-forest">Your target</Eyebrow>
            <p className="text-base text-foreground">
              Cut <span className="font-semibold text-studio-forest tabular-nums">{reductionTonnes.toLocaleString()} t CO&#8322;e</span>{' '}
              to reach <span className="font-semibold text-studio-forest tabular-nums">{targetTonnes.toLocaleString()} t CO&#8322;e</span>{' '}
              by {year}.
            </p>
            {perYearTonnes !== null && yearsToGo > 0 && (
              <p className="text-xs text-muted-foreground">
                ~{perYearTonnes.toLocaleString()} t CO&#8322;e per year, over {yearsToGo} year{yearsToGo === 1 ? '' : 's'}.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={skipStep}
            className="flex-1 flex items-center justify-center gap-2 p-3 rounded-full border border-border bg-transparent hover:bg-secondary transition-colors"
          >
            <span className="text-sm text-muted-foreground">Skip for now</span>
          </button>
          <Button
            onClick={handleContinue}
            disabled={isSaving}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full"
          >
            {isSaving ? (
              <>Saving...</>
            ) : (
              <>Lock in target <ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
