'use client'

import { useState, useEffect } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { useEPRHMRCDetails } from '@/hooks/data/useEPRHMRCDetails'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft, ArrowRight, SkipForward, Loader2, Users, ChevronDown, ChevronRight,
} from 'lucide-react'
import {
  HMRC_CONTACT_TYPE_NAMES,
  HMRC_CONTACT_TYPE_DESCRIPTIONS,
} from '@/lib/epr/constants'
import type { HMRCContactType } from '@/lib/epr/types'

interface ContactsStepProps {
  onComplete: () => void
  onBack: () => void
  onSkip?: () => void
}

interface ContactForm {
  first_name: string
  last_name: string
  phone: string
  email: string
  job_title: string
}

const EMPTY_CONTACT: ContactForm = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  job_title: '',
}

const REQUIRED_TYPES: HMRCContactType[] = ['approved_person', 'primary_contact']
const OPTIONAL_TYPES: HMRCContactType[] = ['delegated_person', 'secondary_contact']

export function ContactsStep({ onComplete, onBack, onSkip }: ContactsStepProps) {
  const { currentOrganization } = useOrganization()
  const { data, loading, saveContacts } = useEPRHMRCDetails()

  const [contacts, setContacts] = useState<Record<HMRCContactType, ContactForm>>({
    approved_person: { ...EMPTY_CONTACT },
    delegated_person: { ...EMPTY_CONTACT },
    primary_contact: { ...EMPTY_CONTACT },
    secondary_contact: { ...EMPTY_CONTACT },
  })
  const [expandedOptional, setExpandedOptional] = useState<Record<string, boolean>>({
    delegated_person: false,
    secondary_contact: false,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Pre-populate from saved contacts
  useEffect(() => {
    if (data.contacts.length > 0) {
      const updated = { ...contacts }
      for (const c of data.contacts) {
        const type = c.contact_type as HMRCContactType
        if (updated[type]) {
          updated[type] = {
            first_name: c.first_name || '',
            last_name: c.last_name || '',
            phone: c.phone || '',
            email: c.email || '',
            job_title: c.job_title || '',
          }
          // Auto-expand optional sections if they have data
          if (OPTIONAL_TYPES.includes(type) && (c.first_name || c.last_name)) {
            setExpandedOptional(prev => ({ ...prev, [type]: true }))
          }
        }
      }
      setContacts(updated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.contacts])

  const updateContact = (type: HMRCContactType, field: keyof ContactForm, value: string) => {
    setContacts(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }))
    // Clear validation error for this field
    setValidationErrors(prev => {
      const key = `${type}.${field}`
      if (prev[key]) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return prev
    })
  }

  const toggleOptional = (type: string) => {
    setExpandedOptional(prev => ({ ...prev, [type]: !prev[type] }))
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    for (const type of REQUIRED_TYPES) {
      if (!contacts[type].first_name.trim()) {
        errors[`${type}.first_name`] = 'First name is required'
      }
      if (!contacts[type].last_name.trim()) {
        errors[`${type}.last_name`] = 'Last name is required'
      }
    }
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleContinue = async () => {
    if (!currentOrganization) return
    if (!validate()) {
      toast.error('Please fill in the required contact details.')
      return
    }

    setIsSaving(true)
    try {
      // Build array of contacts, only include ones with at least a name
      const contactsToSave = (Object.entries(contacts) as [HMRCContactType, ContactForm][])
        .filter(([, form]) => form.first_name.trim() || form.last_name.trim())
        .map(([type, form]) => ({
          contact_type: type,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          job_title: form.job_title.trim() || null,
        }))

      await saveContacts(contactsToSave)
      onComplete()
    } catch (err) {
      console.error('Error saving contacts:', err)
      toast.error('Failed to save contacts. Please try again.')
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

  const renderContactSection = (type: HMRCContactType, isRequired: boolean) => {
    const isOptional = OPTIONAL_TYPES.includes(type)
    const isExpanded = !isOptional || expandedOptional[type]

    return (
      <div key={type} className="space-y-4">
        {/* Section header */}
        <div
          className={`flex items-center justify-between ${isOptional ? 'cursor-pointer' : ''}`}
          onClick={isOptional ? () => toggleOptional(type) : undefined}
        >
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">
              {HMRC_CONTACT_TYPE_NAMES[type]}
            </h4>
            {isRequired ? (
              <span className="text-[10px] font-medium bg-neon-lime/20 text-neon-lime border border-neon-lime/30 rounded-full px-2 py-0.5">
                Required
              </span>
            ) : (
              <span className="text-[10px] font-medium bg-muted text-muted-foreground border border-border rounded-full px-2 py-0.5">
                Optional
              </span>
            )}
          </div>
          {isOptional && (
            isExpanded
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>

        <p className="text-xs text-muted-foreground/70">
          {HMRC_CONTACT_TYPE_DESCRIPTIONS[type]}
        </p>

        {isExpanded && (
          <div className="grid grid-cols-2 gap-3">
            {/* First name */}
            <div className="space-y-1.5">
              <Label htmlFor={`${type}-first-name`} className="text-xs font-medium text-muted-foreground">
                First name
              </Label>
              <Input
                id={`${type}-first-name`}
                placeholder="First name"
                value={contacts[type].first_name}
                onChange={(e) => updateContact(type, 'first_name', e.target.value)}
                disabled={isSaving}
                className={`bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-neon-lime/50 ${
                  validationErrors[`${type}.first_name`] ? 'border-red-500' : ''
                }`}
              />
              {validationErrors[`${type}.first_name`] && (
                <p className="text-[10px] text-red-400">{validationErrors[`${type}.first_name`]}</p>
              )}
            </div>

            {/* Last name */}
            <div className="space-y-1.5">
              <Label htmlFor={`${type}-last-name`} className="text-xs font-medium text-muted-foreground">
                Last name
              </Label>
              <Input
                id={`${type}-last-name`}
                placeholder="Last name"
                value={contacts[type].last_name}
                onChange={(e) => updateContact(type, 'last_name', e.target.value)}
                disabled={isSaving}
                className={`bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-neon-lime/50 ${
                  validationErrors[`${type}.last_name`] ? 'border-red-500' : ''
                }`}
              />
              {validationErrors[`${type}.last_name`] && (
                <p className="text-[10px] text-red-400">{validationErrors[`${type}.last_name`]}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor={`${type}-phone`} className="text-xs font-medium text-muted-foreground">
                Phone
              </Label>
              <Input
                id={`${type}-phone`}
                placeholder="+44 7700 900000"
                value={contacts[type].phone}
                onChange={(e) => updateContact(type, 'phone', e.target.value)}
                disabled={isSaving}
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-neon-lime/50"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor={`${type}-email`} className="text-xs font-medium text-muted-foreground">
                Email
              </Label>
              <Input
                id={`${type}-email`}
                type="email"
                placeholder="name@company.co.uk"
                value={contacts[type].email}
                onChange={(e) => updateContact(type, 'email', e.target.value)}
                disabled={isSaving}
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-neon-lime/50"
              />
            </div>

            {/* Job title - full width */}
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor={`${type}-job-title`} className="text-xs font-medium text-muted-foreground">
                Job title
              </Label>
              <Input
                id={`${type}-job-title`}
                placeholder="e.g. Managing Director"
                value={contacts[type].job_title}
                onChange={(e) => updateContact(type, 'job_title', e.target.value)}
                disabled={isSaving}
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 focus:ring-neon-lime/50"
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-neon-lime/20 backdrop-blur-md border border-neon-lime/30 rounded-2xl flex items-center justify-center">
            <Users className="w-8 h-8 text-neon-lime" />
          </div>
          <h3 className="text-xl font-serif font-bold text-foreground">
            HMRC Contacts
          </h3>
          <p className="text-sm text-muted-foreground">
            Add the people responsible for your EPR registration. At minimum, an Approved Person and Primary Contact are required.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-muted/50 backdrop-blur-md border border-border rounded-2xl p-6 space-y-6">
          {/* Required contacts */}
          {REQUIRED_TYPES.map(type => renderContactSection(type, true))}

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Optional contacts */}
          {OPTIONAL_TYPES.map(type => renderContactSection(type, false))}
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
