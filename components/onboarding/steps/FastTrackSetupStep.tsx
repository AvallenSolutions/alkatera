'use client'

import { useState, useRef } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import type { BeverageType, CompanySize } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowRight, Building2, Globe, Upload, Loader2, Image as ImageIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const BEVERAGE_OPTIONS: { value: BeverageType; label: string; icon: string }[] = [
  { value: 'beer', label: 'Beer', icon: '🍺' },
  { value: 'cider', label: 'Cider', icon: '🍏' },
  { value: 'spirits', label: 'Spirits', icon: '🥃' },
  { value: 'wine', label: 'Wine', icon: '🍷' },
  { value: 'rtd', label: 'RTD', icon: '🥤' },
  { value: 'non_alcoholic', label: 'Non-Alcoholic', icon: '💧' },
  { value: 'functional', label: 'Functional', icon: '⚡' },
]

const TEAM_SIZE_OPTIONS: { value: CompanySize; label: string }[] = [
  { value: '1-10', label: '1–10' },
  { value: '11-50', label: '11–50' },
  { value: '51-200', label: '51–200' },
  { value: '201-1000', label: '200+' },
]

// Maps onboarding drink type to the organizations.product_type column value
const BEVERAGE_TO_PRODUCT_TYPE: Record<BeverageType, string> = {
  beer: 'Beer & Cider',
  cider: 'Beer & Cider',
  spirits: 'Spirits',
  wine: 'Wine',
  rtd: 'Ready-to-Drink & Cocktails',
  non_alcoholic: 'Non-Alcoholic',
  functional: 'Non-Alcoholic',
  other: 'Non-Alcoholic',
}

export function FastTrackSetupStep() {
  const { completeStep, updatePersonalization, state } = useOnboarding()
  const { currentOrganization, refreshOrganizations } = useOrganization()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Company identity fields — all map to existing organizations columns
  const [companyName, setCompanyName] = useState(currentOrganization?.name || '')
  const [logoUrl, setLogoUrl] = useState<string | null>(currentOrganization?.logo_url ?? null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [websiteUrl, setWebsiteUrl] = useState(state.personalization?.websiteUrl ?? '')
  const [description, setDescription] = useState('')
  const [country, setCountry] = useState(state.personalization?.country ?? '')
  const [foundingYear, setFoundingYear] = useState(
    state.personalization?.foundingYear ? String(state.personalization.foundingYear) : ''
  )
  const [beverageType, setBeverageType] = useState<BeverageType | null>(
    state.personalization?.beverageTypes?.[0] ?? null
  )
  const [teamSize, setTeamSize] = useState<CompanySize | null>(
    state.personalization?.companySize ?? null
  )
  const [isSaving, setIsSaving] = useState(false)

  const isValid = companyName.trim().length > 0 && teamSize !== null && beverageType !== null

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Logo must be under 5MB'); return }

    setUploadingLogo(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${currentOrganization?.id || 'org'}-${Date.now()}.${fileExt}`
      const { data, error } = await supabase.storage
        .from('report-assets')
        .upload(`logos/${fileName}`, file, { cacheControl: '3600', upsert: true })
      if (error) { toast.error('Logo upload failed'); return }
      const { data: urlData } = supabase.storage.from('report-assets').getPublicUrl(data.path)
      setLogoUrl(urlData.publicUrl)
    } catch {
      toast.error('Logo upload failed')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleContinue = async () => {
    if (!isValid) return
    setIsSaving(true)

    // Save to personalization (used by estimate + ROSA)
    updatePersonalization({
      websiteUrl: websiteUrl.trim() || undefined,
      country: country.trim() || undefined,
      foundingYear: foundingYear ? parseInt(foundingYear) : undefined,
      companySize: teamSize ?? undefined,
      beverageTypes: [beverageType!],
    })

    // Persist all fields to existing organizations columns — no new columns
    if (currentOrganization) {
      const updates: Record<string, unknown> = {}
      if (companyName.trim() && companyName.trim() !== currentOrganization.name) updates.name = companyName.trim()
      if (logoUrl) updates.logo_url = logoUrl
      if (websiteUrl.trim()) updates.website = websiteUrl.trim()
      if (description.trim()) updates.description = description.trim()
      if (country.trim()) updates.country = country.trim()
      if (foundingYear && !isNaN(parseInt(foundingYear))) updates.founding_year = parseInt(foundingYear)
      if (teamSize) updates.company_size = teamSize
      if (beverageType) updates.product_type = BEVERAGE_TO_PRODUCT_TYPE[beverageType]

      if (Object.keys(updates).length > 0) {
        await supabase.from('organizations').update(updates).eq('id', currentOrganization.id)
        await refreshOrganizations()
      }
    }

    setIsSaving(false)
    completeStep()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-6 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-5">

        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-[#ccff00]/20 backdrop-blur-md border border-[#ccff00]/30 rounded-2xl flex items-center justify-center">
            <Building2 className="w-8 h-8 text-[#ccff00]" />
          </div>
          <h3 className="text-xl font-serif font-bold text-white">Your company</h3>
          <p className="text-sm text-white/50">This goes straight into your account profile.</p>
        </div>

        {/* Company name */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-white/70">Company name <span className="text-white/30">(required)</span></Label>
          <Input
            placeholder='e.g., "Oxford Artisan Distillery"'
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
          />
        </div>

        {/* Logo */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-white/70">Logo</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
            disabled={uploadingLogo}
          />
          {logoUrl ? (
            <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
              <img
                src={logoUrl}
                alt="Company logo"
                className="h-12 w-12 rounded-lg object-contain bg-white/10 p-1"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/60 truncate">Logo uploaded</p>
              </div>
              <button
                onClick={() => { setLogoUrl(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="w-full flex items-center gap-3 p-4 bg-white/5 border border-dashed border-white/15 hover:bg-white/8 hover:border-white/25 rounded-xl transition-all text-left"
            >
              {uploadingLogo ? (
                <Loader2 className="w-5 h-5 text-white/40 animate-spin shrink-0" />
              ) : (
                <Upload className="w-5 h-5 text-white/40 shrink-0" />
              )}
              <div>
                <p className="text-sm text-white/60">{uploadingLogo ? 'Uploading...' : 'Upload your logo'}</p>
                <p className="text-xs text-white/30">PNG, JPG or SVG, max 5MB</p>
              </div>
            </button>
          )}
        </div>

        {/* Website */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-white/70">Website</Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              placeholder="www.yourcompany.com"
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50 pl-9"
            />
          </div>
          <p className="text-xs text-white/30">We'll scan this to import your products automatically in the next step.</p>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-white/70">About your company</Label>
          <Textarea
            placeholder="A few words about what you make and your sustainability ambitions..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50 resize-none"
          />
        </div>

        {/* Country + Year */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-white/70">Country</Label>
            <Input
              placeholder="e.g., United Kingdom"
              value={country}
              onChange={e => setCountry(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-white/70">Year founded</Label>
            <Input
              placeholder="e.g., 2018"
              value={foundingYear}
              onChange={e => setFoundingYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
            />
          </div>
        </div>

        {/* Drink type — maps to organizations.product_type */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-white/70">What do you make? <span className="text-white/30">(required)</span></Label>
          <div className="grid grid-cols-3 gap-2">
            {BEVERAGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setBeverageType(opt.value)}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-medium transition-all',
                  beverageType === opt.value
                    ? 'bg-[#ccff00]/15 border-[#ccff00]/50 text-[#ccff00]'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
                )}
              >
                <span className="text-xl">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Team size — maps to organizations.company_size */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-white/70">Team size <span className="text-white/30">(required)</span></Label>
          <div className="grid grid-cols-4 gap-2">
            {TEAM_SIZE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTeamSize(opt.value)}
                className={cn(
                  'py-2 px-3 rounded-xl border text-xs font-semibold transition-all',
                  teamSize === opt.value
                    ? 'bg-[#ccff00]/15 border-[#ccff00]/50 text-[#ccff00]'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleContinue}
          disabled={!isValid || isSaving}
          className="w-full bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
        >
          {isSaving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
          ) : (
            <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
          )}
        </Button>

      </div>
    </div>
  )
}
