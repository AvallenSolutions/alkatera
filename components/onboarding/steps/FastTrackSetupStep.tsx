'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import type { BeverageType, CompanySize } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowRight, Building2, Globe, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { CountrySelect } from '@/components/shared/CountrySelect'
import { COUNTRIES } from '@/lib/countries'
import { RosaIntro } from './RosaIntro'

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
  // We store the ISO 3166 alpha-2 code in state so the dropdown stays in
  // sync; on save we convert to the human-readable label (back-compat with
  // existing freeform country text in organizations.country and elsewhere).
  // Existing legacy values (full names) get matched back to ISO so the
  // dropdown shows them as selected on a re-visit.
  const [countryCode, setCountryCode] = useState<string>(() => {
    const raw = state.personalization?.country
    if (!raw) return ''
    const direct = COUNTRIES.find(c => c.value === raw)
    if (direct) return direct.value
    const byLabel = COUNTRIES.find(c => c.label.toLowerCase() === raw.toLowerCase())
    return byLabel?.value ?? ''
  })
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
  // Track which fields the background crawl filled, so we can show a small
  // "from your website" caption + avoid clobbering anything the user has
  // already typed.
  const [autofilledFromSite, setAutofilledFromSite] = useState<Set<'country' | 'foundingYear' | 'description' | 'logo'>>(new Set())
  const crawlInflightRef = useRef<string | null>(null)

  // Lightweight URL check: accept anything that has a dot (domain) and no
  // whitespace. Don't require a scheme — the import route normalises that.
  // Empty is OK (the website field is optional). Declared up here so the
  // background-crawl effect below can gate on it.
  const websiteUrlError = useMemo(() => {
    const trimmed = websiteUrl.trim()
    if (!trimmed) return null
    if (/\s/.test(trimmed)) return 'No spaces, please'
    if (!/^(?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/.*)?$/i.test(trimmed)) {
      return "That doesn't look like a website URL"
    }
    return null
  }, [websiteUrl])

  // Background website crawl: when the user finishes typing a URL (and we
  // pass URL validation), kick off the import in the background. When it
  // returns brand_metadata, gently pre-fill any fields the user hasn't
  // already touched. Empty/invalid URL cancels in-flight work.
  useEffect(() => {
    const trimmed = websiteUrl.trim()
    if (!trimmed) { crawlInflightRef.current = null; return }
    // Debounce so we don't fire on every keystroke.
    const handle = setTimeout(async () => {
      // Bail if URL doesn't look right or already crawling this one.
      if (websiteUrlError) return
      if (crawlInflightRef.current === trimmed) return
      crawlInflightRef.current = trimmed
      try {
        const start = await fetch('/api/products/import-from-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed }),
        })
        const startBody = await start.json().catch(() => ({}))
        if (!start.ok || !startBody?.jobId) return
        const jobId = startBody.jobId as string

        // Poll up to ~60s. The crawl typically finishes well before that.
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000))
          // User wiped the field or typed something else; abort.
          if (crawlInflightRef.current !== trimmed) return
          const poll = await fetch(`/api/products/import-from-url/${jobId}`)
          const data = await poll.json().catch(() => ({}))
          if (data?.status === 'completed') {
            applyBrandPrefill(data.brandMetadata ?? null, data.orgDescription ?? null)
            return
          }
          if (data?.status === 'failed') return
        }
      } catch (err) {
        console.warn('[fast-track-setup] background crawl failed:', err)
      }
    }, 1200)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteUrl, websiteUrlError])

  // Apply scraped brand metadata to empty fields only. Never overwrite
  // what the user typed.
  const applyBrandPrefill = (
    brand: {
      founding_year?: number | null
      logo_url?: string | null
      mission?: string | null
    } | null,
    orgDescription: string | null,
  ) => {
    const filled = new Set(autofilledFromSite)
    if (!countryCode) {
      // brand_metadata doesn't carry a country directly, so we leave it
      // alone. Could be enhanced by reading distribution_markets[0].
    }
    if (!foundingYear && brand?.founding_year) {
      setFoundingYear(String(brand.founding_year))
      filled.add('foundingYear')
    }
    if (!description) {
      const candidate = brand?.mission || orgDescription || null
      if (candidate) {
        setDescription(candidate)
        filled.add('description')
      }
    }
    if (!logoUrl && brand?.logo_url) {
      setLogoUrl(brand.logo_url)
      filled.add('logo')
    }
    if (filled.size > 0) setAutofilledFromSite(filled)
  }

  const isValid =
    companyName.trim().length > 0 && teamSize !== null && beverageType !== null && !websiteUrlError

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Logo must be under 10MB'); return }

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

    const countryLabel = COUNTRIES.find(c => c.value === countryCode)?.label

    // Save to personalization (used by estimate + ROSA). Persist the
    // human-readable label to keep parity with existing freeform consumers.
    updatePersonalization({
      websiteUrl: websiteUrl.trim() || undefined,
      country: countryLabel || undefined,
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
      if (countryLabel) updates.country = countryLabel
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

        <RosaIntro message="Tell me about your company. If you give me a website, I'll go and read it while you finish, which saves you typing." />

        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-card border border-border rounded-[6px] flex items-center justify-center">
            <Building2 className="w-8 h-8 text-studio-forest" />
          </div>
          <h3 className="text-xl font-display font-bold tracking-tight text-foreground">Your company.</h3>
          <p className="text-sm text-muted-foreground">This goes straight into your account profile.</p>
        </div>

        {/* Company name */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Company name <span className="text-studio-dim">(required)</span></Label>
          <Input
            placeholder='e.g., "Oxford Artisan Distillery"'
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
          />
        </div>

        {/* Logo */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Logo</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
            disabled={uploadingLogo}
          />
          {logoUrl ? (
            <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-[6px]">
              <img
                src={logoUrl}
                alt="Company logo"
                className="h-12 w-12 rounded-[6px] object-contain bg-secondary p-1"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Logo uploaded</p>
              </div>
              <button
                onClick={() => { setLogoUrl(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className="text-studio-dim hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="w-full flex items-center gap-3 p-4 bg-card border border-dashed border-border hover:bg-secondary hover:border-studio-ink/25 rounded-[6px] transition-colors text-left"
            >
              <Upload className="w-5 h-5 text-studio-dim shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">{uploadingLogo ? 'Uploading...' : 'Upload your logo'}</p>
                <p className="text-xs text-studio-dim">PNG, JPG or SVG, max 10MB</p>
              </div>
            </button>
          )}
        </div>

        {/* Website */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Website</Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-studio-dim" />
            <Input
              placeholder="www.yourcompany.com"
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              aria-invalid={!!websiteUrlError}
              className={cn(
                'pl-9',
                websiteUrlError && 'border-studio-stale/60',
              )}
            />
          </div>
          {websiteUrlError ? (
            <p className="text-xs text-studio-stale">{websiteUrlError}</p>
          ) : (
            <p className="text-xs text-studio-dim">We'll scan this to import your products automatically in the next step.</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">About your company</Label>
          <Textarea
            placeholder="A few words about what you make and your sustainability ambitions..."
            value={description}
            onChange={e => { setDescription(e.target.value); autofilledFromSite.delete('description') }}
            rows={2}
            className="resize-none"
          />
          {autofilledFromSite.has('description') && (
            <p className="text-xs text-studio-forest">Pulled from your website, edit if needed.</p>
          )}
        </div>

        {/* Country + Year */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Country</Label>
            <CountrySelect
              value={countryCode}
              onChange={setCountryCode}
              placeholder="Select country"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Year founded</Label>
            <Input
              placeholder="e.g., 2018"
              value={foundingYear}
              onChange={e => { setFoundingYear(e.target.value.replace(/\D/g, '').slice(0, 4)); autofilledFromSite.delete('foundingYear') }}
            />
            {autofilledFromSite.has('foundingYear') && (
              <p className="text-xs text-studio-forest">From your website</p>
            )}
          </div>
        </div>

        {/* Drink type — maps to organizations.product_type */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">What do you make? <span className="text-studio-dim">(required)</span></Label>
          <div className="grid grid-cols-3 gap-2">
            {BEVERAGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setBeverageType(opt.value)}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-[6px] border text-xs font-medium transition-colors',
                  beverageType === opt.value
                    ? 'bg-secondary border-studio-forest text-studio-forest'
                    : 'bg-card border-border text-muted-foreground hover:bg-secondary hover:border-studio-ink/25'
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
          <Label className="text-sm font-medium text-foreground">Team size <span className="text-studio-dim">(required)</span></Label>
          <div className="grid grid-cols-4 gap-2">
            {TEAM_SIZE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTeamSize(opt.value)}
                className={cn(
                  'py-2 px-3 rounded-[6px] border text-xs font-semibold transition-colors',
                  teamSize === opt.value
                    ? 'bg-secondary border-studio-forest text-studio-forest'
                    : 'bg-card border-border text-muted-foreground hover:bg-secondary hover:border-studio-ink/25'
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
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full"
        >
          {isSaving ? (
            <>Saving...</>
          ) : (
            <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
          )}
        </Button>

      </div>
    </div>
  )
}
