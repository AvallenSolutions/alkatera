'use client'

import { useEffect, useMemo, useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import type { PrimaryGoal } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { ArrowRight, Target, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

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
          <div className="mx-auto h-12 w-12 rounded-xl bg-[#ccff00]/15 flex items-center justify-center">
            <Target className="w-6 h-6 text-[#ccff00]" />
          </div>
          <h3 className="text-2xl font-serif font-bold text-white">Set your first target</h3>
          <p className="text-sm text-white/50">
            {baseline
              ? `Your baseline is ~${baseline.toLocaleString()} tonnes CO₂e/year. Rosa will track progress against this.`
              : 'Rosa will track your reduction journey against this target.'}
          </p>
        </div>

        {/* Reduction % buttons */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-white/60 uppercase tracking-wide">Reduce by</p>
          <div className="grid grid-cols-5 gap-2">
            {REDUCTION_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setPct(option)}
                className={cn(
                  'rounded-xl border py-3 text-center transition-all',
                  pct === option
                    ? 'bg-[#ccff00]/15 border-[#ccff00]/50 text-[#ccff00]'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20',
                )}
              >
                <span className="text-sm font-semibold">{option}%</span>
              </button>
            ))}
          </div>
        </div>

        {/* Year buttons */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-white/60 uppercase tracking-wide">By</p>
          <div className="grid grid-cols-4 gap-2">
            {YEAR_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setYear(option)}
                className={cn(
                  'rounded-xl border py-3 text-center transition-all',
                  year === option
                    ? 'bg-[#ccff00]/15 border-[#ccff00]/50 text-[#ccff00]'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20',
                )}
              >
                <span className="text-sm font-semibold">{option}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Live preview of what the target means */}
        {targetTonnes !== null && reductionTonnes !== null && (
          <div className="rounded-2xl border border-[#ccff00]/30 bg-[#ccff00]/10 p-4 space-y-2">
            <p className="text-xs uppercase tracking-wide text-[#ccff00]/70">Your target</p>
            <p className="text-base text-white">
              Cut <span className="font-semibold text-[#ccff00]">{reductionTonnes.toLocaleString()} t CO&#8322;e</span>{' '}
              to reach <span className="font-semibold text-[#ccff00]">{targetTonnes.toLocaleString()} t CO&#8322;e</span>{' '}
              by {year}.
            </p>
            {perYearTonnes !== null && yearsToGo > 0 && (
              <p className="text-xs text-white/50">
                ~{perYearTonnes.toLocaleString()} t CO&#8322;e per year, over {yearsToGo} year{yearsToGo === 1 ? '' : 's'}.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={skipStep}
            className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-white/10 bg-white/3 hover:bg-white/5 transition-colors"
          >
            <span className="text-sm text-white/60">Skip for now</span>
          </button>
          <Button
            onClick={handleContinue}
            disabled={isSaving}
            className="flex-1 bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
            ) : (
              <>Lock in target <ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
