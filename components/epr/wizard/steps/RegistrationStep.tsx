'use client'

import { useState, useEffect } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { useEPRSettings } from '@/hooks/data/useEPRSettings'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ArrowRight, SkipForward, Loader2, KeyRound } from 'lucide-react'

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
            <KeyRound className="w-8 h-8 text-[#ccff00]" />
          </div>
          <h3 className="text-xl font-serif font-bold text-white">
            RPD Registration Details
          </h3>
          <p className="text-sm text-white/50">
            Link your Alkatera account to the Defra RPD portal.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-5">
          {/* RPD Organisation ID */}
          <div className="space-y-2">
            <Label htmlFor="epr-rpd-org-id" className="text-sm font-medium text-white/70">
              RPD Organisation ID
            </Label>
            <Input
              id="epr-rpd-org-id"
              placeholder="e.g. 100123"
              value={rpdOrgId}
              onChange={(e) => setRpdOrgId(e.target.value)}
              disabled={isSaving}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
            />
            <p className="text-xs text-white/30">
              Found in your RPD portal account. Usually a 6-digit number.
            </p>
          </div>

          {/* RPD Subsidiary ID */}
          <div className="space-y-2">
            <Label htmlFor="epr-rpd-sub-id" className="text-sm font-medium text-white/70">
              Subsidiary ID
              <span className="ml-2 text-xs text-white/30 font-normal">(optional)</span>
            </Label>
            <Input
              id="epr-rpd-sub-id"
              placeholder="e.g. 001"
              value={rpdSubId}
              onChange={(e) => setRpdSubId(e.target.value)}
              disabled={isSaving}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
            />
            <p className="text-xs text-white/30">
              Only required if your organisation has multiple subsidiaries registered with RPD.
            </p>
          </div>
        </div>

        <p className="text-xs text-white/30 text-center">
          Don&apos;t have your RPD details yet? You can skip this step and add them later in EPR Settings.
        </p>

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
          <div className="flex items-center gap-2">
            {onSkip && (
              <Button
                variant="ghost"
                onClick={onSkip}
                disabled={isSaving}
                className="text-white/40 hover:text-white hover:bg-white/10 text-sm"
              >
                <SkipForward className="w-4 h-4 mr-1" />
                Skip
              </Button>
            )}
            <Button
              onClick={handleContinue}
              disabled={isSaving}
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
    </div>
  )
}
