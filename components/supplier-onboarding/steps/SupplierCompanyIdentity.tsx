'use client'

import { useState, useEffect, useRef } from 'react'
import { useSupplierOnboarding } from '@/lib/supplier-onboarding'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, ArrowRight, Building2, Upload, X, ImageIcon, SkipForward } from 'lucide-react'
import { toast } from 'sonner'

const MAX_LOGO_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function SupplierCompanyIdentity() {
  const { completeStep, previousStep, skipStep, markProfileCompleted } = useSupplierOnboarding()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load existing profile data
  useEffect(() => {
    async function loadProfile() {
      const supabase = getSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('suppliers')
        .select('id, name, description, website, logo_url')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (data) {
        setSupplierId(data.id)
        setName(data.name || '')
        setDescription(data.description || '')
        setWebsite(data.website || '')
        setLogoUrl(data.logo_url || null)
      }

      setIsLoading(false)
    }

    loadProfile()
  }, [])

  const handleLogoUpload = async (file: File) => {
    if (!supplierId) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Please upload a JPG, PNG, or WebP image')
      return
    }

    if (file.size > MAX_LOGO_SIZE) {
      toast.error('Logo must be under 10MB')
      return
    }

    setIsUploading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const ext = file.name.split('.').pop() || 'png'
      const path = `${supplierId}/logo-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('supplier-logos')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('supplier-logos')
        .getPublicUrl(path)

      // Save immediately to DB
      const { error: updateError } = await supabase
        .from('suppliers')
        .update({ logo_url: publicUrl })
        .eq('id', supplierId)

      if (updateError) throw updateError

      setLogoUrl(publicUrl)
      toast.success('Logo uploaded')
    } catch (err) {
      console.error('Error uploading logo:', err)
      toast.error('Failed to upload logo')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (!supplierId) return

    try {
      const supabase = getSupabaseBrowserClient()
      await supabase
        .from('suppliers')
        .update({ logo_url: null })
        .eq('id', supplierId)

      setLogoUrl(null)
      toast.success('Logo removed')
    } catch (err) {
      console.error('Error removing logo:', err)
      toast.error('Failed to remove logo')
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter your company name')
      return
    }

    if (!supplierId) {
      completeStep()
      return
    }

    setIsSaving(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          website: website.trim() || null,
          logo_url: logoUrl,
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
            Your company identity.
          </h3>
          <p className="text-sm text-muted-foreground">
            Add your logo and basic details so your customers know who they&apos;re working with.
          </p>
        </div>

        <div className="rounded-[6px] border border-border bg-card p-6 space-y-4">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="ci-name" className="text-sm font-medium text-foreground">
              Company Name <span className="text-studio-stale">*</span>
            </Label>
            <Input
              id="ci-name"
              placeholder="Your company name"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isSaving}
            />
          </div>

          {/* Logo Upload */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Logo</Label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="relative group">
                  <img
                    src={logoUrl}
                    alt="Company logo"
                    className="w-24 h-24 rounded-[6px] object-cover border border-border"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-24 h-24 rounded-[6px] border border-dashed border-border hover:border-studio-forest/50 bg-secondary/50 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  {isUploading ? (
                    <span className="text-[10px] text-muted-foreground">Uploading&hellip;</span>
                  ) : (
                    <>
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Upload</span>
                    </>
                  )}
                </button>
              )}

              {logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary text-xs"
                >
                  {isUploading ? (
                    'Uploading...'
                  ) : (
                    <>
                      <Upload className="w-3 h-3 mr-1" />
                      Change
                    </>
                  )}
                </Button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleLogoUpload(file)
                  e.target.value = ''
                }}
              />
            </div>
            <p className="text-[11px] text-studio-dim">JPG, PNG, or WebP. Max 10MB.</p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="ci-description" className="text-sm font-medium text-foreground">
              Description
            </Label>
            <Textarea
              id="ci-description"
              placeholder="Tell your customers about your company..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isSaving}
              rows={3}
            />
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="ci-website" className="text-sm font-medium text-foreground">
              Website
            </Label>
            <Input
              id="ci-website"
              type="url"
              placeholder="https://www.example.com"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              disabled={isSaving}
            />
          </div>
        </div>

        <p className="text-xs text-studio-dim text-center">
          You can update these details anytime from your profile page.
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
