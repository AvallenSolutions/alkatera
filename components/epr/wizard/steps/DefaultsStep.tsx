'use client'

import { useState, useEffect } from 'react'
import { useEPRSettings } from '@/hooks/data/useEPRSettings'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  ArrowRight,
  SkipForward,
  Settings2,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'

interface DefaultsStepProps {
  onComplete: () => void
  onBack: () => void
  onSkip?: () => void
}

const PACKAGING_ACTIVITY_OPTIONS = [
  { value: 'brand', label: 'Brand Owner' },
  { value: 'packed_filled', label: 'Packed/Filled' },
  { value: 'imported', label: 'Imported' },
  { value: 'empty', label: 'Empty Packaging Seller' },
  { value: 'hired', label: 'Hired/Loaned' },
  { value: 'marketplace', label: 'Online Marketplace' },
] as const

const UK_NATION_OPTIONS = [
  { value: 'england', label: 'England' },
  { value: 'scotland', label: 'Scotland' },
  { value: 'wales', label: 'Wales' },
  { value: 'northern_ireland', label: 'Northern Ireland' },
] as const

export function DefaultsStep({ onComplete, onBack, onSkip }: DefaultsStepProps) {
  const { settings, loading, saveSettings } = useEPRSettings()

  const [defaultActivity, setDefaultActivity] = useState<string>('')
  const [defaultNation, setDefaultNation] = useState<string>('')
  const [drsExclusions, setDrsExclusions] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Seed form from loaded settings
  useEffect(() => {
    if (settings) {
      setDefaultActivity(settings.default_packaging_activity || '')
      setDefaultNation(settings.default_uk_nation || '')
      setDrsExclusions(settings.drs_applies ?? false)
    }
  }, [settings])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await saveSettings({
        default_packaging_activity: defaultActivity,
        default_uk_nation: defaultNation,
        drs_applies: drsExclusions,
      })
      onComplete()
    } catch (err) {
      console.error('Error saving EPR defaults:', err)
      toast.error('Failed to save defaults. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">Loading settings</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-[6px] border border-border bg-card flex items-center justify-center">
            <Settings2 className="w-8 h-8 text-room-accent" />
          </div>
          <h3 className="text-xl font-display font-bold text-foreground">
            Set your packaging defaults
          </h3>
          <p className="text-sm text-muted-foreground">
            These defaults will apply to new packaging items, saving you time.
            You can always override them on individual products.
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-[6px] border border-border bg-card p-6 space-y-5">
          {/* Default Packaging Activity */}
          <div className="space-y-2">
            <Label htmlFor="epr-default-activity" className="text-sm font-medium text-muted-foreground">
              Default Packaging Activity
            </Label>
            <Select value={defaultActivity} onValueChange={setDefaultActivity}>
              <SelectTrigger
                id="epr-default-activity"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground/50"
              >
                <SelectValue placeholder="Select activity..." />
              </SelectTrigger>
              <SelectContent>
                {PACKAGING_ACTIVITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground/70">
              Most drinks brands select &quot;Brand Owner&quot;.
            </p>
          </div>

          {/* Default UK Nation */}
          <div className="space-y-2">
            <Label htmlFor="epr-default-nation" className="text-sm font-medium text-muted-foreground">
              Default UK Nation
            </Label>
            <Select value={defaultNation} onValueChange={setDefaultNation}>
              <SelectTrigger
                id="epr-default-nation"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground/50"
              >
                <SelectValue placeholder="Select nation..." />
              </SelectTrigger>
              <SelectContent>
                {UK_NATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground/70">
              The primary nation where your products are sold.
            </p>
          </div>

          {/* DRS Exclusions Toggle */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="epr-drs-toggle" className="text-sm font-medium text-muted-foreground">
                DRS Exclusions
              </Label>
              <p className="text-xs text-muted-foreground/70">
                Enable if your drinks containers fall under the Deposit Return Scheme.
              </p>
            </div>
            <Switch
              id="epr-drs-toggle"
              checked={drsExclusions}
              onCheckedChange={setDrsExclusions}
            />
          </div>
        </div>

        {/* Help text */}
        <div className="flex items-start gap-2 px-1">
          <Info className="w-4 h-4 text-muted-foreground/70 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground/70">
            These defaults are applied automatically when you add new packaging items.
            Existing items are not changed. Use the Bulk Edit step to update
            multiple existing items at once.
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={onBack}
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
                className="text-muted-foreground hover:text-foreground hover:bg-muted text-sm"
              >
                <SkipForward className="w-4 h-4 mr-1" />
                Skip
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full"
            >
              {isSaving ? (
                <>
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
