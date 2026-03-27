'use client'

import { useState, useEffect } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { useEPRHMRCDetails } from '@/hooks/data/useEPRHMRCDetails'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, SkipForward, Loader2, Package } from 'lucide-react'
import { HMRC_PACKAGING_ACTIVITY_LABELS } from '@/lib/epr/constants'
import type { HMRCPackagingActivityLevel } from '@/lib/epr/types'

interface PackagingActivitiesStepProps {
  onComplete: () => void
  onBack: () => void
  onSkip?: () => void
}

type ActivityKey = keyof typeof HMRC_PACKAGING_ACTIVITY_LABELS

const ACTIVITY_KEYS: ActivityKey[] = ['so', 'pf', 'im', 'se', 'hl', 'om', 'sl']

const LEVEL_OPTIONS: HMRCPackagingActivityLevel[] = ['Primary', 'Secondary', 'No']

const DEFAULT_ACTIVITIES: Record<ActivityKey, HMRCPackagingActivityLevel> = {
  so: 'Primary',
  pf: 'No',
  im: 'No',
  se: 'No',
  hl: 'No',
  om: 'No',
  sl: 'No',
}

export function PackagingActivitiesStep({ onComplete, onBack, onSkip }: PackagingActivitiesStepProps) {
  const { currentOrganization } = useOrganization()
  const { data, loading, saveOrgDetails } = useEPRHMRCDetails()

  const [activities, setActivities] = useState<Record<ActivityKey, HMRCPackagingActivityLevel>>(
    { ...DEFAULT_ACTIVITIES }
  )
  const [isSaving, setIsSaving] = useState(false)

  // Pre-populate from existing data
  useEffect(() => {
    if (data.orgDetails) {
      setActivities({
        so: data.orgDetails.activity_so || DEFAULT_ACTIVITIES.so,
        pf: data.orgDetails.activity_pf || DEFAULT_ACTIVITIES.pf,
        im: data.orgDetails.activity_im || DEFAULT_ACTIVITIES.im,
        se: data.orgDetails.activity_se || DEFAULT_ACTIVITIES.se,
        hl: data.orgDetails.activity_hl || DEFAULT_ACTIVITIES.hl,
        om: data.orgDetails.activity_om || DEFAULT_ACTIVITIES.om,
        sl: data.orgDetails.activity_sl || DEFAULT_ACTIVITIES.sl,
      })
    }
  }, [data.orgDetails])

  const handleActivityChange = (key: ActivityKey, level: HMRCPackagingActivityLevel) => {
    setActivities((prev) => ({ ...prev, [key]: level }))
  }

  const handleContinue = async () => {
    if (!currentOrganization) return

    setIsSaving(true)
    try {
      await saveOrgDetails({
        activity_so: activities.so,
        activity_pf: activities.pf,
        activity_im: activities.im,
        activity_se: activities.se,
        activity_hl: activities.hl,
        activity_om: activities.om,
        activity_sl: activities.sl,
      })
      onComplete()
    } catch (err) {
      console.error('Error saving packaging activities:', err)
      toast.error('Failed to save packaging activities. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-neon-lime animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-neon-lime/20 backdrop-blur-md border border-neon-lime/30 rounded-2xl flex items-center justify-center">
            <Package className="w-8 h-8 text-neon-lime" />
          </div>
          <h3 className="text-xl font-serif font-bold text-foreground">
            Packaging Activities
          </h3>
          <p className="text-sm text-muted-foreground">
            Select the level of each packaging activity your organisation undertakes.
            Most drinks producers will have &quot;Sold (Brand Owner)&quot; as their primary activity.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-muted/50 backdrop-blur-md border border-border rounded-2xl p-6 space-y-4">
          {ACTIVITY_KEYS.map((key) => {
            const activity = HMRC_PACKAGING_ACTIVITY_LABELS[key]
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {activity.label}
                      <span className="ml-2 text-xs text-muted-foreground/60 font-normal">
                        ({activity.code})
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      {activity.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {LEVEL_OPTIONS.map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => handleActivityChange(key, level)}
                        disabled={isSaving}
                        className={`
                          px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                          ${
                            activities[key] === level
                              ? level === 'No'
                                ? 'bg-muted-foreground/20 text-foreground border border-muted-foreground/30'
                                : 'bg-neon-lime/20 text-neon-lime border border-neon-lime/30'
                              : 'bg-muted/30 text-muted-foreground/60 border border-transparent hover:bg-muted/50 hover:text-muted-foreground'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                {key !== ACTIVITY_KEYS[ACTIVITY_KEYS.length - 1] && (
                  <div className="border-b border-border/50" />
                )}
              </div>
            )
          })}
        </div>

        <p className="text-xs text-muted-foreground/70 text-center">
          &quot;Primary&quot; means this is your main activity. &quot;Secondary&quot; means you do it but
          it is not your core activity. &quot;No&quot; means it does not apply.
        </p>

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
              disabled={isSaving}
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
