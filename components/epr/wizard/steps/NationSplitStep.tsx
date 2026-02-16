'use client'

import { useState, useEffect, useMemo } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { useEPRSettings } from '@/hooks/data/useEPRSettings'
import { toast } from 'sonner'
import type { NationEstimationResult } from '@/lib/epr/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  ArrowRight,
  SkipForward,
  Loader2,
  MapPin,
  Sparkles,
  AlertCircle,
} from 'lucide-react'

interface NationSplitStepProps {
  onComplete: () => void
  onBack: () => void
  onSkip?: () => void
}

const DEFAULT_SPLITS = {
  england: 84.3,
  scotland: 8.2,
  wales: 4.7,
  ni: 2.8,
}

const CONFIDENCE_BADGE_STYLES: Record<string, string> = {
  high: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-red-500/20 text-red-400 border-red-500/30',
}

interface NationField {
  key: 'england' | 'scotland' | 'wales' | 'ni'
  label: string
  flag: string
}

const NATIONS: NationField[] = [
  { key: 'england', label: 'England', flag: '\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F' },
  { key: 'scotland', label: 'Scotland', flag: '\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F' },
  { key: 'wales', label: 'Wales', flag: '\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73\uDB40\uDC7F' },
  { key: 'ni', label: 'Northern Ireland', flag: '\uD83C\uDDEC\uD83C\uDDE7' },
]

export function NationSplitStep({ onComplete, onBack, onSkip }: NationSplitStepProps) {
  const { currentOrganization } = useOrganization()
  const { settings, loading: settingsLoading, saveSettings } = useEPRSettings()

  const [splits, setSplits] = useState({
    england: DEFAULT_SPLITS.england,
    scotland: DEFAULT_SPLITS.scotland,
    wales: DEFAULT_SPLITS.wales,
    ni: DEFAULT_SPLITS.ni,
  })
  const [method, setMethod] = useState<'manual' | 'auto_estimated'>('manual')
  const [estimating, setEstimating] = useState(false)
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low' | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Pre-populate from existing settings
  useEffect(() => {
    if (settings) {
      setSplits({
        england: settings.nation_sales_england_pct ?? DEFAULT_SPLITS.england,
        scotland: settings.nation_sales_scotland_pct ?? DEFAULT_SPLITS.scotland,
        wales: settings.nation_sales_wales_pct ?? DEFAULT_SPLITS.wales,
        ni: settings.nation_sales_ni_pct ?? DEFAULT_SPLITS.ni,
      })
      if (settings.nation_sales_method === 'auto_estimated') {
        setMethod('auto_estimated')
      }
    }
  }, [settings])

  const total = useMemo(() => {
    return splits.england + splits.scotland + splits.wales + splits.ni
  }, [splits])

  const isValid = useMemo(() => {
    return Math.abs(total - 100) <= 0.5
  }, [total])

  const handleSplitChange = (key: keyof typeof splits, value: string) => {
    const num = parseFloat(value)
    setSplits((prev) => ({
      ...prev,
      [key]: isNaN(num) ? 0 : num,
    }))
    setMethod('manual')
    setConfidence(null)
  }

  const handleAutoEstimate = async () => {
    if (!currentOrganization?.id) return

    setEstimating(true)
    try {
      const response = await fetch('/api/epr/estimate-nations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: currentOrganization.id }),
      })

      if (!response.ok) throw new Error('Failed to estimate nation splits')

      const data: NationEstimationResult = await response.json()

      setSplits({
        england: data.england_pct,
        scotland: data.scotland_pct,
        wales: data.wales_pct,
        ni: data.ni_pct,
      })
      setMethod('auto_estimated')
      setConfidence(data.confidence)
      toast.success(`Nation split estimated from ${data.sample_size} delivery records.`)
    } catch (err) {
      console.error('Error estimating nation splits:', err)
      toast.error('Could not estimate nation splits. Please enter values manually.')
    } finally {
      setEstimating(false)
    }
  }

  const handleContinue = async () => {
    if (!isValid) {
      toast.error('Nation percentages must add up to 100%.')
      return
    }

    setIsSaving(true)
    try {
      await saveSettings({
        nation_sales_england_pct: splits.england,
        nation_sales_scotland_pct: splits.scotland,
        nation_sales_wales_pct: splits.wales,
        nation_sales_ni_pct: splits.ni,
        nation_sales_method: method,
        nation_sales_last_estimated_at:
          method === 'auto_estimated' ? new Date().toISOString() : undefined,
      })
      onComplete()
    } catch (err) {
      console.error('Error saving nation splits:', err)
      toast.error('Failed to save nation splits. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-neon-lime animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-neon-lime/20 backdrop-blur-md border border-neon-lime/30 rounded-2xl flex items-center justify-center">
            <MapPin className="w-8 h-8 text-neon-lime" />
          </div>
          <h3 className="text-xl font-serif font-bold text-foreground">
            Nation Sales Split
          </h3>
          <p className="text-sm text-muted-foreground">
            How are your product sales distributed across the UK nations?
          </p>
        </div>

        {/* Auto-estimate button */}
        <Button
          variant="outline"
          onClick={handleAutoEstimate}
          disabled={estimating || isSaving}
          className="w-full border-border bg-muted/50 text-foreground hover:bg-muted hover:text-foreground"
        >
          {estimating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Estimating from your data...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2 text-neon-lime" />
              Auto-Estimate from Delivery Data
            </>
          )}
        </Button>

        {/* Method + confidence indicators */}
        {method === 'auto_estimated' && confidence && (
          <div className="flex items-center justify-center gap-2 animate-in fade-in duration-200">
            <Badge variant="outline" className="bg-neon-lime/10 text-neon-lime border-neon-lime/30 text-xs">
              Auto-estimated
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs ${CONFIDENCE_BADGE_STYLES[confidence] || ''}`}
            >
              {confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
            </Badge>
          </div>
        )}

        {/* Nation split inputs */}
        <div className="bg-muted/50 backdrop-blur-md border border-border rounded-2xl p-6 space-y-4">
          {NATIONS.map((nation) => (
            <div key={nation.key} className="flex items-center gap-3">
              <span className="text-lg w-8 text-center" role="img" aria-label={nation.label}>
                {nation.flag}
              </span>
              <Label
                htmlFor={`epr-nation-${nation.key}`}
                className="text-sm font-medium text-muted-foreground w-32 flex-shrink-0"
              >
                {nation.label}
              </Label>
              <div className="relative flex-1">
                <Input
                  id={`epr-nation-${nation.key}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={splits[nation.key]}
                  onChange={(e) => handleSplitChange(nation.key, e.target.value)}
                  disabled={isSaving}
                  className="pr-8 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-neon-lime/50 text-right"
                />
                <span className="absolute inset-y-0 right-3 flex items-center text-muted-foreground/70 text-sm pointer-events-none">
                  %
                </span>
              </div>
            </div>
          ))}

          {/* Sum indicator */}
          <div className="pt-3 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span
                className={`text-sm font-mono font-semibold ${
                  isValid ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {total.toFixed(1)}%
              </span>
            </div>
            {!isValid && (
              <div className="flex items-center gap-2 mt-2 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">
                  Percentages must add up to 100% (currently {total.toFixed(1)}%).
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={isSaving}
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {onSkip && (
              <Button
                variant="ghost"
                onClick={onSkip}
                disabled={isSaving}
                className="text-muted-foreground hover:text-foreground hover:bg-muted text-sm"
              >
                <SkipForward className="w-4 h-4 mr-1" />
                Skip
              </Button>
            )}
            <Button
              onClick={handleContinue}
              disabled={isSaving || !isValid}
              className="bg-neon-lime text-black hover:bg-neon-lime/80 font-medium rounded-xl"
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
    </div>
  )
}
