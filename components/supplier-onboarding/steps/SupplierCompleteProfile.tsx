'use client'

import { useState, useEffect } from 'react'
import { useSupplierOnboarding } from '@/lib/supplier-onboarding'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, ArrowRight, Building2, SkipForward } from 'lucide-react'
import { toast } from 'sonner'

export function SupplierCompleteProfile() {
  const { completeStep, previousStep, skipStep, markProfileCompleted } = useSupplierOnboarding()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [industrySector, setIndustrySector] = useState('')
  const [country, setCountry] = useState('')
  const [website, setWebsite] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load existing profile data
  useEffect(() => {
    async function loadProfile() {
      const supabase = getSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('suppliers')
        .select('id, name, description, industry_sector, country, website, contact_name, contact_email')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (data) {
        setSupplierId(data.id)
        setName(data.name || '')
        setDescription(data.description || '')
        setIndustrySector(data.industry_sector || '')
        setCountry(data.country || '')
        setWebsite(data.website || '')
        setContactName(data.contact_name || '')
        setContactEmail(data.contact_email || '')
      }

      setIsLoading(false)
    }

    loadProfile()
  }, [])

  const handleSave = async () => {
    if (!supplierId) {
      // Still advance even if we can't find the supplier
      completeStep()
      return
    }

    setIsSaving(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: name.trim() || undefined,
          description: description.trim() || null,
          industry_sector: industrySector.trim() || null,
          country: country.trim() || null,
          website: website.trim() || null,
          contact_name: contactName.trim() || null,
          contact_email: contactEmail.trim() || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', supplierId)

      if (error) throw error

      toast.success('Profile updated')
      markProfileCompleted()
      completeStep()
    } catch (err) {
      console.error('Error saving profile:', err)
      toast.error('Failed to save profile. You can update this later from your profile page.')
      // Still advance even if save fails
      completeStep()
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">Loading&hellip;</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-[6px] bg-card border border-border flex items-center justify-center">
            <Building2 className="w-8 h-8 text-studio-forest" />
          </div>
          <h3 className="text-xl font-display font-bold tracking-tight text-foreground">
            Complete your company profile.
          </h3>
          <p className="text-sm text-muted-foreground">
            This helps your customers know who they&apos;re working with.
          </p>
        </div>

        <div className="rounded-[6px] border border-border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sup-name" className="text-sm font-medium text-foreground">
              Company Name <span className="text-studio-stale">*</span>
            </Label>
            <Input
              id="sup-name"
              placeholder="Your company name"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sup-description" className="text-sm font-medium text-foreground">
              Description
            </Label>
            <Textarea
              id="sup-description"
              placeholder="Tell your customers about your company and sustainability practices..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isSaving}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sup-industry" className="text-sm font-medium text-foreground">
                Industry
              </Label>
              <Input
                id="sup-industry"
                placeholder="e.g., Food & Beverage"
                value={industrySector}
                onChange={e => setIndustrySector(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-country" className="text-sm font-medium text-foreground">
                Country
              </Label>
              <Input
                id="sup-country"
                placeholder="e.g., United Kingdom"
                value={country}
                onChange={e => setCountry(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sup-website" className="text-sm font-medium text-foreground">
              Website
            </Label>
            <Input
              id="sup-website"
              type="url"
              placeholder="https://www.example.com"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sup-contact-name" className="text-sm font-medium text-foreground">
                Contact Name
              </Label>
              <Input
                id="sup-contact-name"
                placeholder="Your name"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-contact-email" className="text-sm font-medium text-foreground">
                Contact Email
              </Label>
              <Input
                id="sup-contact-email"
                type="email"
                placeholder="you@example.com"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-studio-dim text-center">
          You can add a logo and update these details anytime from your profile page.
        </p>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-muted-foreground hover:text-foreground hover:bg-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipStep} className="text-muted-foreground hover:text-foreground hover:bg-secondary text-sm">
              <SkipForward className="w-4 h-4 mr-1" />
              Skip
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full"
            >
              {isSaving ? (
                'Saving...'
              ) : (
                <>
                  Save & Continue
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
