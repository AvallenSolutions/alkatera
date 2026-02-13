'use client'

import { useState, useEffect, useCallback } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { useEPRSettings } from '@/hooks/data/useEPRSettings'
import { toast } from 'sonner'
import type { ObligationResult } from '@/lib/epr/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Scale,
  CalendarRange,
  PoundSterling,
} from 'lucide-react'

interface ObligationStepProps {
  onComplete: () => void
  onBack: () => void
  onSkip?: () => void
}

const OBLIGATION_BADGE_STYLES: Record<string, string> = {
  large: 'bg-red-500/20 text-red-400 border-red-500/30',
  small: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  below_threshold: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}

const OBLIGATION_LABELS: Record<string, string> = {
  large: 'Large Producer',
  small: 'Small Producer',
  below_threshold: 'Below Threshold',
}

export function ObligationStep({ onComplete, onBack }: ObligationStepProps) {
  const { currentOrganization } = useOrganization()
  const { settings, loading: settingsLoading, saveSettings } = useEPRSettings()

  const [turnover, setTurnover] = useState('')
  const [obligation, setObligation] = useState<ObligationResult | null>(null)
  const [fetchingObligation, setFetchingObligation] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Pre-populate from existing settings
  useEffect(() => {
    if (settings?.annual_turnover_gbp != null) {
      setTurnover(settings.annual_turnover_gbp.toString())
    }
  }, [settings])

  // Fetch obligation whenever turnover changes (debounced)
  const fetchObligation = useCallback(async () => {
    if (!currentOrganization?.id) return

    setFetchingObligation(true)
    try {
      const params = new URLSearchParams({
        organizationId: currentOrganization.id,
      })

      // Include turnover if provided
      const turnoverNum = parseFloat(turnover)
      if (!isNaN(turnoverNum) && turnoverNum > 0) {
        params.set('turnover', turnoverNum.toString())
      }

      const response = await fetch(`/api/epr/obligation?${params}`)
      if (!response.ok) throw new Error('Failed to fetch obligation')

      const data = await response.json()
      setObligation(data.obligation as ObligationResult)
    } catch (err) {
      console.error('Error fetching obligation:', err)
      // Don't toast on every debounce failure
    } finally {
      setFetchingObligation(false)
    }
  }, [currentOrganization?.id, turnover])

  useEffect(() => {
    if (!currentOrganization?.id) return
    const timer = setTimeout(fetchObligation, 600)
    return () => clearTimeout(timer)
  }, [fetchObligation, currentOrganization?.id])

  const handleContinue = async () => {
    const turnoverNum = parseFloat(turnover)
    if (isNaN(turnoverNum) || turnoverNum <= 0) {
      toast.error('Please enter a valid annual turnover amount.')
      return
    }

    setIsSaving(true)
    try {
      await saveSettings({
        annual_turnover_gbp: turnoverNum,
        obligation_size: obligation?.size || 'pending',
      })
      onComplete()
    } catch (err) {
      console.error('Error saving obligation details:', err)
      toast.error('Failed to save obligation details. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#ccff00] animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-[#ccff00]/20 backdrop-blur-md border border-[#ccff00]/30 rounded-2xl flex items-center justify-center">
            <Scale className="w-8 h-8 text-[#ccff00]" />
          </div>
          <h3 className="text-xl font-serif font-bold text-white">
            Your EPR Obligation
          </h3>
          <p className="text-sm text-white/50">
            Your turnover and packaging tonnage determine your reporting requirements.
          </p>
        </div>

        {/* Turnover input card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="epr-turnover" className="text-sm font-medium text-white/70">
              Annual Turnover (GBP)
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <PoundSterling className="w-4 h-4 text-white/30" />
              </div>
              <Input
                id="epr-turnover"
                type="number"
                min="0"
                step="1000"
                placeholder="e.g. 2500000"
                value={turnover}
                onChange={(e) => setTurnover(e.target.value)}
                disabled={isSaving}
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
              />
            </div>
            <p className="text-xs text-white/30">
              Your most recent full financial year turnover.
            </p>
          </div>

          {/* Packaging tonnage (auto-fetched) */}
          {obligation && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white/70">
                Estimated Packaging Tonnage
              </Label>
              <div className="flex items-center gap-3">
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-mono flex-1">
                  {obligation.total_packaging_tonnes.toFixed(2)} tonnes
                </div>
                {fetchingObligation && (
                  <Loader2 className="w-4 h-4 text-white/40 animate-spin flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-white/30">
                Calculated from your packaging data in Alkatera.
              </p>
            </div>
          )}
        </div>

        {/* Obligation result */}
        {obligation && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/70">Obligation Size</span>
              <Badge
                variant="outline"
                className={OBLIGATION_BADGE_STYLES[obligation.size] || 'bg-white/10 text-white/60'}
              >
                {OBLIGATION_LABELS[obligation.size] || obligation.size}
              </Badge>
            </div>

            <p className="text-sm text-white/60 leading-relaxed">
              {obligation.explanation}
            </p>

            {/* Reporting frequency */}
            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
              <CalendarRange className="w-4 h-4 text-white/40" />
              <span className="text-sm text-white/50">
                Reporting frequency:{' '}
                <span className="text-white/80 font-medium">
                  {obligation.reporting_frequency === 'biannual'
                    ? 'Biannual (H1 + H2)'
                    : obligation.reporting_frequency === 'annual'
                      ? 'Annual'
                      : 'Not required'}
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={isSaving}
            className="text-white/40 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleContinue}
            disabled={isSaving || !turnover}
            className="bg-[#ccff00] text-black hover:bg-[#b8e600] font-medium rounded-xl"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
