'use client'

import { useState, useEffect } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { useEPRHMRCDetails } from '@/hooks/data/useEPRHMRCDetails'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PillButton } from '@/components/studio/pill-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft, ArrowRight, SkipForward, UserPlus, Plus, Trash2,
} from 'lucide-react'

interface PartnersStepProps {
  onComplete: () => void
  onBack: () => void
  onSkip?: () => void
}

interface PartnerRow {
  first_name: string
  last_name: string
  phone: string
  email: string
}

const EMPTY_PARTNER: PartnerRow = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
}

export function PartnersStep({ onComplete, onBack, onSkip }: PartnersStepProps) {
  const { currentOrganization } = useOrganization()
  const { data, loading, savePartners } = useEPRHMRCDetails()

  const [partners, setPartners] = useState<PartnerRow[]>([{ ...EMPTY_PARTNER }])
  const [isSaving, setIsSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Pre-populate from saved partners
  useEffect(() => {
    if (data.partners.length > 0) {
      setPartners(
        data.partners.map(p => ({
          first_name: p.first_name || '',
          last_name: p.last_name || '',
          phone: p.phone || '',
          email: p.email || '',
        }))
      )
    }
  }, [data.partners])

  const updatePartner = (index: number, field: keyof PartnerRow, value: string) => {
    setPartners(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
    setValidationError(null)
  }

  const addPartner = () => {
    setPartners(prev => [...prev, { ...EMPTY_PARTNER }])
  }

  const removePartner = (index: number) => {
    setPartners(prev => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== index)
    })
  }

  const validate = (): boolean => {
    const hasAtLeastOne = partners.some(
      p => p.first_name.trim().length > 0 && p.last_name.trim().length > 0
    )
    if (!hasAtLeastOne) {
      setValidationError('Please add at least one partner with a first and last name.')
      return false
    }
    setValidationError(null)
    return true
  }

  const handleContinue = async () => {
    if (!currentOrganization) return
    if (!validate()) return

    setIsSaving(true)
    try {
      // Only save partners that have at least a name
      const partnersToSave = partners
        .filter(p => p.first_name.trim().length > 0 || p.last_name.trim().length > 0)
        .map(p => ({
          first_name: p.first_name.trim(),
          last_name: p.last_name.trim(),
          phone: p.phone.trim() || null,
          email: p.email.trim() || null,
        }))

      await savePartners(partnersToSave)
      onComplete()
    } catch (err) {
      console.error('Error saving partners:', err)
      toast.error('Failed to save partners. Please try again.')
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
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-[6px] border border-studio-hairline bg-studio-paper flex items-center justify-center">
            <UserPlus className="w-8 h-8 text-room-accent" />
          </div>
          <h3 className="text-xl font-display font-bold text-foreground">
            Partnership Details
          </h3>
          <p className="text-sm text-muted-foreground">
            List all partners in your partnership. This information is required for HMRC Template 3.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-[6px] border border-studio-hairline bg-studio-paper p-6 space-y-4">
          {/* Partner rows */}
          {partners.map((partner, index) => (
            <div key={index} className="space-y-3 pb-4 border-b border-border last:border-b-0 last:pb-0">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Partner {index + 1}
                </Label>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removePartner(index)}
                  disabled={isSaving || partners.length <= 1}
                  className="text-muted-foreground hover:text-studio-stale hover:bg-studio-stale/10 h-7 w-7"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`partner-${index}-first-name`} className="text-xs font-medium text-muted-foreground">
                    First name
                  </Label>
                  <Input
                    id={`partner-${index}-first-name`}
                    placeholder="First name"
                    value={partner.first_name}
                    onChange={(e) => updatePartner(index, 'first_name', e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`partner-${index}-last-name`} className="text-xs font-medium text-muted-foreground">
                    Last name
                  </Label>
                  <Input
                    id={`partner-${index}-last-name`}
                    placeholder="Last name"
                    value={partner.last_name}
                    onChange={(e) => updatePartner(index, 'last_name', e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`partner-${index}-phone`} className="text-xs font-medium text-muted-foreground">
                    Phone
                  </Label>
                  <Input
                    id={`partner-${index}-phone`}
                    placeholder="+44 7700 900000"
                    value={partner.phone}
                    onChange={(e) => updatePartner(index, 'phone', e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`partner-${index}-email`} className="text-xs font-medium text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    id={`partner-${index}-email`}
                    type="email"
                    placeholder="name@company.co.uk"
                    value={partner.email}
                    onChange={(e) => updatePartner(index, 'email', e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Validation error */}
          {validationError && (
            <p className="text-xs text-studio-stale">{validationError}</p>
          )}

          {/* Add partner button */}
          <Button
            variant="ghost"
            onClick={addPartner}
            disabled={isSaving}
            className="w-full border border-studio-hairline text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-room-accent/40"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Partner
          </Button>
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
            <PillButton variant="ink" onClick={handleContinue} disabled={isSaving}>
              {isSaving ? (
                'Saving...'
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </PillButton>
          </div>
        </div>
      </div>
    </div>
  )
}
