'use client'

import { useState, useEffect } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { useEPRSettings } from '@/hooks/data/useEPRSettings'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PillButton } from '@/components/studio/pill-button'
import { ArrowLeft, ArrowRight, SkipForward, KeyRound } from 'lucide-react'

interface RegistrationStepProps {
  onComplete: () => void
  onBack: () => void
  onSkip?: () => void
}

export function RegistrationStep({ onComplete, onBack, onSkip }: RegistrationStepProps) {
  const { currentOrganization } = useOrganization()
  const { settings, loading, saveSettings } = useEPRSettings()

  const [rpdOrgId, setRpdOrgId] = useState('')
  const [rpdSubId, setRpdSubId] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Pre-populate from existing settings
  useEffect(() => {
    if (settings) {
      setRpdOrgId(settings.rpd_organization_id || '')
      setRpdSubId(settings.rpd_subsidiary_id || '')
    }
  }, [settings])

  const handleContinue = async () => {
    if (!currentOrganization) return

    setIsSaving(true)
    try {
      await saveSettings({
        rpd_organization_id: rpdOrgId.trim() || null,
        rpd_subsidiary_id: rpdSubId.trim() || null,
      })
      onComplete()
    } catch (err) {
      console.error('Error saving registration details:', err)
      toast.error('Failed to save registration details. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-studio-dim">
          Loading...
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-[6px] border border-studio-hairline bg-studio-paper flex items-center justify-center">
            <KeyRound className="w-8 h-8 text-room-accent" />
          </div>
          <h3 className="text-xl font-display font-bold text-foreground">
            RPD Registration Details
          </h3>
          <p className="text-sm text-muted-foreground">
            Link your Alkatera account to the Defra RPD portal.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-[6px] border border-studio-hairline bg-studio-paper p-6 space-y-5">
          {/* RPD Organisation ID */}
          <div className="space-y-2">
            <Label htmlFor="epr-rpd-org-id" className="text-sm font-medium text-muted-foreground">
              RPD Organisation ID
            </Label>
            <Input
              id="epr-rpd-org-id"
              placeholder="e.g. 100123"
              value={rpdOrgId}
              onChange={(e) => setRpdOrgId(e.target.value)}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground/70">
              Found in your RPD portal account. Usually a 6-digit number.
            </p>
          </div>

          {/* RPD Subsidiary ID */}
          <div className="space-y-2">
            <Label htmlFor="epr-rpd-sub-id" className="text-sm font-medium text-muted-foreground">
              Subsidiary ID
              <span className="ml-2 text-xs text-muted-foreground/70 font-normal">(optional)</span>
            </Label>
            <Input
              id="epr-rpd-sub-id"
              placeholder="e.g. 001"
              value={rpdSubId}
              onChange={(e) => setRpdSubId(e.target.value)}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground/70">
              Only required if your organisation has multiple subsidiaries registered with RPD.
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground/70 text-center">
          Don&apos;t have your RPD details yet? You can skip this step and add them later in EPR Settings.
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
            <PillButton variant="ink" onClick={handleContinue} disabled={isSaving}>
              {isSaving ? (
                'Saving...'
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </PillButton>
          </div>
        </div>
      </div>
    </div>
  )
}
