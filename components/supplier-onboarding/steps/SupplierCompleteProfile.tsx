'use client'

import { useState, useEffect } from 'react'
import { useSupplierOnboarding } from '@/lib/supplier-onboarding'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, ArrowRight, Building2, SkipForward, Loader2 } from 'lucide-react'
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
        <Loader2 className="w-6 h-6 text-[#ccff00] animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-[#ccff00]/20 backdrop-blur-md border border-[#ccff00]/30 rounded-2xl flex items-center justify-center">
            <Building2 className="w-8 h-8 text-[#ccff00]" />
          </div>
          <h3 className="text-xl font-serif font-bold text-white">
            Complete Your Company Profile
          </h3>
          <p className="text-sm text-white/50">
            This helps your customers know who they&apos;re working with.
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sup-name" className="text-sm font-medium text-white/70">
              Company Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="sup-name"
              placeholder="Your company name"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isSaving}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sup-description" className="text-sm font-medium text-white/70">
              Description
            </Label>
            <Textarea
              id="sup-description"
              placeholder="Tell your customers about your company and sustainability practices..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isSaving}
              rows={3}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sup-industry" className="text-sm font-medium text-white/70">
                Industry
              </Label>
              <Input
                id="sup-industry"
                placeholder="e.g., Food & Beverage"
                value={industrySector}
                onChange={e => setIndustrySector(e.target.value)}
                disabled={isSaving}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-country" className="text-sm font-medium text-white/70">
                Country
              </Label>
              <Input
                id="sup-country"
                placeholder="e.g., United Kingdom"
                value={country}
                onChange={e => setCountry(e.target.value)}
                disabled={isSaving}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sup-website" className="text-sm font-medium text-white/70">
              Website
            </Label>
            <Input
              id="sup-website"
              type="url"
              placeholder="https://www.example.com"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              disabled={isSaving}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sup-contact-name" className="text-sm font-medium text-white/70">
                Contact Name
              </Label>
              <Input
                id="sup-contact-name"
                placeholder="Your name"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                disabled={isSaving}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-contact-email" className="text-sm font-medium text-white/70">
                Contact Email
              </Label>
              <Input
                id="sup-contact-email"
                type="email"
                placeholder="you@example.com"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                disabled={isSaving}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-white/30 text-center">
          You can add a logo and update these details anytime from your profile page.
        </p>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-white/40 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipStep} className="text-white/40 hover:text-white hover:bg-white/10 text-sm">
              <SkipForward className="w-4 h-4 mr-1" />
              Skip
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
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
