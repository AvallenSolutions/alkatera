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
import { CountrySelect } from '@/components/shared/CountrySelect'
import { COUNTRIES } from '@/lib/countries'
import { RosaIntro } from './RosaIntro'
import { UniversalDropzone } from '@/components/layouts/UniversalDropzone'
import { GROWTH_PALETTE, STUDIO } from '@/components/studio/theme'

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

// Inverse of the above, for guessing a beverage type from the scraped
// products' categories. "Beer & Cider" and "Non-Alcoholic" are ambiguous —
// we pick the more common of the two forms rather than trying to tell beer
// from cider on ingredient text alone.
const PRODUCT_CATEGORY_TO_BEVERAGE: Record<string, BeverageType> = {
  'Spirits': 'spirits',
  'Beer & Cider': 'beer',
  'Wine': 'wine',
  'Ready-to-Drink & Cocktails': 'rtd',
  'Non-Alcoholic': 'non_alcoholic',
}

/** Best-guess beverage type from the scraped product list's categories.
 * Only confident when one category clearly leads — mixed or empty results
 * leave the field blank rather than guessing. */
function guessBeverageTypeFromProducts(products: { product_category?: string }[]): BeverageType | null {
  if (!products.length) return null
  const counts = new Map<string, number>()
  for (const p of products) {
    if (!p.product_category) continue
    counts.set(p.product_category, (counts.get(p.product_category) ?? 0) + 1)
  }
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  if (!ranked.length) return null
  const [topCategory, topCount] = ranked[0]
  const runnerUpCount = ranked[1]?.[1] ?? 0
  if (topCount <= runnerUpCount) return null // tie or no clear majority
  return PRODUCT_CATEGORY_TO_BEVERAGE[topCategory] ?? null
}

/** Maps a free-text or ISO country string (from the site's JSON-LD address,
 * locale meta tag, or an LLM guess) onto the form's ISO alpha-2 codes. Only
 * matches exact codes, exact labels, or a short list of common aliases —
 * anything else is left blank rather than guessed. */
const COUNTRY_ALIASES: Record<string, string> = {
  uk: 'GB',
  'u.k.': 'GB',
  'united kingdom': 'GB',
  'great britain': 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'northern ireland': 'GB',
  usa: 'US',
  'u.s.a.': 'US',
  'u.s.': 'US',
  'united states of america': 'US',
  america: 'US',
}

function mapScrapedCountry(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  const byCode = COUNTRIES.find(c => c.value.toLowerCase() === trimmed.toLowerCase())
  if (byCode) return byCode.value
  const byLabel = COUNTRIES.find(c => c.label.toLowerCase() === trimmed.toLowerCase())
  if (byLabel) return byLabel.value
  return COUNTRY_ALIASES[trimmed.toLowerCase()] ?? null
}

/** Quiet mono label shown beside a field's Label when its value came from
 * the background website scrape, not the user's own typing. */
function FromWebsiteTag() {
  return (
    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-studio-forest">
      From your website.
    </span>
  )
}

/** Live states for the background website crawl, surfaced next to the
 * website field so it never looks like nothing is happening. */
type CrawlPhase = 'idle' | 'running' | 'done' | 'failed'

/** Tiny inline butterfly, adapted from the growth field's resident
 * (components/studio/growth/species/creatures.ts: two wing pairs around a
 * thin body). Flaps gently while `active`, stilled the instant the crawl
 * settles. prefers-reduced-motion is handled by the .onboarding-wing-flap
 * class itself (app/globals.css), which is only applied while active. */
function ScrapeButterfly({ active }: { active: boolean }) {
  const wingClass = active ? 'onboarding-wing-flap' : ''
  return (
    <svg width="16" height="14" viewBox="-8 -6 16 12" className="shrink-0" aria-hidden="true">
      <g className={wingClass}>
        <ellipse cx="-3" cy="-1" rx="3.4" ry="2.4" fill={GROWTH_PALETTE.butterfly} opacity={0.85} />
        <ellipse cx="-3.4" cy="1.6" rx="2.2" ry="1.5" fill={GROWTH_PALETTE.butterfly} opacity={0.6} />
      </g>
      <g className={wingClass}>
        <ellipse cx="3" cy="-1" rx="3.4" ry="2.4" fill={GROWTH_PALETTE.butterfly} opacity={0.7} />
        <ellipse cx="3.4" cy="1.6" rx="2.2" ry="1.5" fill={GROWTH_PALETTE.butterfly} opacity={0.5} />
      </g>
      <path d="M0,-3 L0,3" stroke={STUDIO.ink} strokeWidth={0.9} opacity={0.5} />
    </svg>
  )
}

/** Turns the job's real progress signals (phase_message, status from
 * product_import_jobs, exposed by GET /api/products/import-from-url/
 * [jobId]) into an honest, generic status line. Never claims a specific
 * page or step that isn't backed by what the job actually reports. */
function stageLabelForPoll(phaseMessage: string | null | undefined, status: string | undefined): string {
  const msg = (phaseMessage || '').toLowerCase()
  if (msg.includes('shopify') || msg.includes('catalogue') || msg.includes('extracting products')) {
    return 'Counting products.'
  }
  if (msg.includes('scanning') && msg.includes('pages')) {
    return 'Reading your pages.'
  }
  if (msg.includes('homepage')) {
    return 'Reading your website.'
  }
  // No specific phase yet (job still 'pending', or a message we don't
  // recognise) — a generic, honest default rather than guessing.
  return status === 'scraping' ? 'Reading your pages.' : 'Reading your website.'
}

export function FastTrackSetupStep() {
  const { completeStep, skipStep, updatePersonalization, state, onboardingFlow } = useOnboarding()
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
  const [logoError, setLogoError] = useState<string | null>(null)
  // Track which fields the background crawl filled, so we can show a small
  // "from your website" label next to the field + avoid clobbering anything
  // the user has already typed.
  type AutofillableField = 'country' | 'foundingYear' | 'description' | 'logo' | 'beverageType'
  const [autofilledFromSite, setAutofilledFromSite] = useState<Set<AutofillableField>>(new Set())
  // Fields that were *just* autofilled, for a brief highlight/fade as the
  // value lands — separate from autofilledFromSite, which persists the
  // label until the user edits the field.
  const [highlightedFields, setHighlightedFields] = useState<Set<AutofillableField>>(new Set())
  const crawlInflightRef = useRef<string | null>(null)
  // Live status for the background crawl, surfaced next to the website
  // field (see ScrapeButterfly + stageLabelForPoll above) so entering a
  // website never looks like nothing happened until results appear.
  const [crawlPhase, setCrawlPhase] = useState<CrawlPhase>('idle')
  const [crawlLabel, setCrawlLabel] = useState<string>('Reading your website.')
  const crawlSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearCrawlSettleTimer = () => {
    if (crawlSettleTimerRef.current) {
      clearTimeout(crawlSettleTimerRef.current)
      crawlSettleTimerRef.current = null
    }
  }

  // Marks fields as scrape-filled: adds the "From your website." label and
  // a ~1.4s highlight, quiet enough not to startle but visible enough that
  // the user notices the field just changed under them.
  const markAutofilled = (keys: AutofillableField[]) => {
    if (!keys.length) return
    setAutofilledFromSite(prev => {
      const next = new Set(prev)
      keys.forEach(k => next.add(k))
      return next
    })
    setHighlightedFields(prev => {
      const next = new Set(prev)
      keys.forEach(k => next.add(k))
      return next
    })
    setTimeout(() => {
      setHighlightedFields(prev => {
        const next = new Set(prev)
        keys.forEach(k => next.delete(k))
        return next
      })
    }, 1400)
  }
  const highlightClass = (field: AutofillableField) =>
    cn('transition-colors duration-700 ease-studio rounded-[6px]', highlightedFields.has(field) && 'bg-studio-forest/10')

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
  //
  // crawlPhase/crawlLabel (declared above) turn this from a silent black
  // box into a live indicator: 'running' while the job is in flight, with
  // the label re-derived from the job's real phase_message on every poll
  // (stageLabelForPoll); 'done' for a few seconds once products land;
  // 'failed' — quietly, no alarm — on an explicit failure or a 60s timeout.
  useEffect(() => {
    const trimmed = websiteUrl.trim()
    if (!trimmed) {
      crawlInflightRef.current = null
      clearCrawlSettleTimer()
      setCrawlPhase('idle')
      return
    }
    // Debounce so we don't fire on every keystroke.
    const handle = setTimeout(async () => {
      // Bail if URL doesn't look right or already crawling this one.
      if (websiteUrlError) return
      if (crawlInflightRef.current === trimmed) return
      crawlInflightRef.current = trimmed
      clearCrawlSettleTimer()
      setCrawlPhase('running')
      setCrawlLabel('Reading your website.')
      try {
        const start = await fetch('/api/products/import-from-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed }),
        })
        const startBody = await start.json().catch(() => ({}))
        if (!start.ok || !startBody?.jobId) {
          setCrawlPhase('failed')
          setCrawlLabel("I couldn't read the site. You can fill things in by hand.")
          crawlSettleTimerRef.current = setTimeout(() => setCrawlPhase('idle'), 6000)
          return
        }
        const jobId = startBody.jobId as string

        // Poll up to ~60s. The crawl typically finishes well before that.
        let settled = false
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000))
          // User wiped the field or typed something else; abort.
          if (crawlInflightRef.current !== trimmed) return
          const poll = await fetch(`/api/products/import-from-url/${jobId}`)
          const data = await poll.json().catch(() => ({}))
          if (data?.status === 'completed') {
            settled = true
            setCrawlPhase('done')
            setCrawlLabel('Done. Anything I found is tagged below.')
            crawlSettleTimerRef.current = setTimeout(() => setCrawlPhase('idle'), 4000)
            const products = Array.isArray(data.products) ? data.products : []
            applyBrandPrefill(data.brandMetadata ?? null, data.orgDescription ?? null, products)
            // Stash what the crawl found so the reveal step can show and
            // materialise it: the brand colour (for the room recolour), the
            // logo, and the product drafts (name plus whatever category and
            // size the scrape provided).
            const drafts = products
              .filter((p: any) => typeof p?.name === 'string' && p.name.trim())
              .slice(0, 12)
              .map((p: any) => ({
                name: String(p.name).trim(),
                category: typeof p.product_category === 'string' ? p.product_category : null,
                unitSizeValue: typeof p.unit_size_value === 'number' ? p.unit_size_value : null,
                unitSizeUnit: typeof p.unit_size_unit === 'string' ? p.unit_size_unit : null,
              }))
            updatePersonalization({
              ...(data.brandMetadata?.brand_colour ? { brandColour: data.brandMetadata.brand_colour } : {}),
              ...(data.brandMetadata?.logo_url ? { brandLogoUrl: data.brandMetadata.logo_url } : {}),
              ...(drafts.length
                ? { scrapedProducts: drafts, scrapedProductNames: drafts.map((d: { name: string }) => d.name) }
                : {}),
            })
            return
          }
          if (data?.status === 'failed') {
            settled = true
            setCrawlPhase('failed')
            setCrawlLabel("I couldn't read the site. You can fill things in by hand.")
            crawlSettleTimerRef.current = setTimeout(() => setCrawlPhase('idle'), 6000)
            return
          }
          // Still running — reflect the job's real phase in the status line.
          setCrawlLabel(stageLabelForPoll(data?.phaseMessage, data?.status))
        }
        // Exhausted the poll budget without the job reporting completed or
        // failed — treat it the same as a failure rather than leaving the
        // butterfly flapping forever.
        if (!settled) {
          setCrawlPhase('failed')
          setCrawlLabel("I couldn't read the site. You can fill things in by hand.")
          crawlSettleTimerRef.current = setTimeout(() => setCrawlPhase('idle'), 6000)
        }
      } catch (err) {
        console.warn('[fast-track-setup] background crawl failed:', err)
        setCrawlPhase('failed')
        setCrawlLabel("I couldn't read the site. You can fill things in by hand.")
        crawlSettleTimerRef.current = setTimeout(() => setCrawlPhase('idle'), 6000)
      }
    }, 1200)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteUrl, websiteUrlError])

  // Clean up the "settle" timer (the few quiet seconds a 'done'/'failed'
  // status line lingers for) if the step unmounts mid-countdown.
  useEffect(() => clearCrawlSettleTimer, [])

  // Apply scraped brand metadata to empty fields only. Never overwrite
  // what the user typed.
  const applyBrandPrefill = (
    brand: {
      founding_year?: number | null
      logo_url?: string | null
      mission?: string | null
      country?: string | null
    } | null,
    orgDescription: string | null,
    products: { product_category?: string }[],
  ) => {
    const filled: AutofillableField[] = []

    if (!foundingYear && brand?.founding_year) {
      setFoundingYear(String(brand.founding_year))
      filled.push('foundingYear')
    }
    if (!description) {
      const candidate = brand?.mission || orgDescription || null
      if (candidate) {
        setDescription(candidate)
        filled.push('description')
      }
    }
    if (!logoUrl && brand?.logo_url) {
      setLogoUrl(brand.logo_url)
      filled.push('logo')
    }
    if (!countryCode) {
      const mapped = mapScrapedCountry(brand?.country)
      if (mapped) {
        setCountryCode(mapped)
        filled.push('country')
      }
    }
    if (!beverageType) {
      const guess = guessBeverageTypeFromProducts(products)
      if (guess) {
        setBeverageType(guess)
        filled.push('beverageType')
      }
    }

    markAutofilled(filled)
  }

  // Clears a field's "from your website" state when the user edits it
  // themselves — the badge and any lingering highlight both go away.
  const clearAutofill = (key: AutofillableField) => {
    setAutofilledFromSite(prev => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
    setHighlightedFields(prev => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  const isValid =
    companyName.trim().length > 0 && teamSize !== null && beverageType !== null && !websiteUrlError

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError(null)
    if (!file.type.startsWith('image/')) { setLogoError('Please select an image file.'); return }
    if (file.size > 10 * 1024 * 1024) { setLogoError('Logo must be under 10MB.'); return }

    setUploadingLogo(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${currentOrganization?.id || 'org'}-${Date.now()}.${fileExt}`
      const { data, error } = await supabase.storage
        .from('report-assets')
        .upload(`logos/${fileName}`, file, { cacheControl: '3600', upsert: true })
      if (error) {
        console.warn('[fast-track-setup] logo upload failed:', error.message)
        setLogoError("The logo didn't upload. Try again, or skip it for now.")
        return
      }
      const { data: urlData } = supabase.storage.from('report-assets').getPublicUrl(data.path)
      setLogoUrl(urlData.publicUrl)
    } catch (err) {
      console.warn('[fast-track-setup] logo upload failed:', err)
      setLogoError("The logo didn't upload. Try again, or skip it for now.")
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
          <Label className="text-sm font-medium text-foreground flex items-center gap-2">
            Logo
            {autofilledFromSite.has('logo') && <FromWebsiteTag />}
          </Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
            disabled={uploadingLogo}
          />
          {logoUrl ? (
            <div className={cn('flex items-center gap-3 p-3 bg-card border border-border', highlightClass('logo'))}>
              <img
                src={logoUrl}
                alt="Company logo"
                className="h-12 w-12 rounded-[6px] object-contain bg-secondary p-1"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Logo uploaded</p>
              </div>
              <button
                onClick={() => {
                  setLogoUrl(null)
                  setLogoError(null)
                  clearAutofill('logo')
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="text-studio-dim hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setLogoError(null); fileInputRef.current?.click() }}
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
          {logoError && <p className="text-xs text-studio-stale">{logoError}</p>}
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
          ) : crawlPhase !== 'idle' ? (
            <div className="flex items-center gap-1.5 animate-in fade-in duration-300">
              <ScrapeButterfly active={crawlPhase === 'running'} />
              <p
                className={cn(
                  'font-mono text-xs',
                  crawlPhase === 'failed' ? 'text-studio-dim' : 'text-studio-forest',
                )}
              >
                {crawlLabel}
              </p>
            </div>
          ) : (
            <p className="text-xs text-studio-dim">We'll scan this to import your products automatically in the next step.</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground flex items-center gap-2">
            About your company
            {autofilledFromSite.has('description') && <FromWebsiteTag />}
          </Label>
          <Textarea
            placeholder="A few words about what you make and your sustainability ambitions..."
            value={description}
            onChange={e => { setDescription(e.target.value); clearAutofill('description') }}
            rows={2}
            className={cn('resize-none', highlightClass('description'))}
          />
        </div>

        {/* Country + Year */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground flex items-center gap-2">
              Country
              {autofilledFromSite.has('country') && <FromWebsiteTag />}
            </Label>
            <CountrySelect
              value={countryCode}
              onChange={code => { setCountryCode(code); clearAutofill('country') }}
              placeholder="Select country"
              className={highlightClass('country')}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground flex items-center gap-2">
              Year founded
              {autofilledFromSite.has('foundingYear') && <FromWebsiteTag />}
            </Label>
            <Input
              placeholder="e.g., 2018"
              value={foundingYear}
              onChange={e => { setFoundingYear(e.target.value.replace(/\D/g, '').slice(0, 4)); clearAutofill('foundingYear') }}
              className={highlightClass('foundingYear')}
            />
          </div>
        </div>

        {/* Drink type — maps to organizations.product_type */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground flex items-center gap-2">
            What do you make? <span className="text-studio-dim">(required)</span>
            {autofilledFromSite.has('beverageType') && <FromWebsiteTag />}
          </Label>
          <div className={cn('grid grid-cols-3 gap-2 p-1 -m-1', highlightClass('beverageType'))}>
            {BEVERAGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setBeverageType(opt.value); clearAutofill('beverageType') }}
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

        {/* Migration engine v1 (data-revolution plan, Pillar 2b): a quiet door
            for brands arriving with a prior consultant LCA, B Corp report or
            CDP/EcoVadis response — routes through the normal Smart Upload
            pipeline, same as every other document. */}
        <UniversalDropzone
          trigger={
            <button
              type="button"
              className="block w-full text-center text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground transition-colors"
            >
              Already have a sustainability report? Drop it here.
            </button>
          }
        />

        {/* Arrival flow only: this step is skippable there (see
            ARRIVAL_STEPS), and the fast-track flow has no equivalent
            top-chrome "skip step" control, so the affordance lives here. */}
        {onboardingFlow === 'arrival' && (
          <div className="text-center">
            <button
              type="button"
              onClick={skipStep}
              className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-opacity duration-150 ease-studio hover:text-foreground"
            >
              Skip for now
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
