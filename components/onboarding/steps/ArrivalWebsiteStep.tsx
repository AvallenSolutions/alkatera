'use client'

import { useEffect, useRef, useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import type { BeverageType, AnnualProductionBucket } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { readDomainGuess } from '@/lib/enrich/arrival-handoff'
import { trackOnboarding } from '@/lib/onboarding/telemetry'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CountrySelect } from '@/components/shared/CountrySelect'
import { COUNTRIES } from '@/lib/countries'
import { Eyebrow, PillButton } from '@/components/studio'
import { ArrowRight, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The no-website archetype tiles. Each drink type selects a benchmark
 * category (the same names ArrivalEstimateStep maps to) so the estimate is
 * real, not a placeholder. */
const DRINK_OPTIONS: { value: BeverageType; label: string }[] = [
  { value: 'spirits', label: 'Spirits' },
  { value: 'beer', label: 'Beer' },
  { value: 'cider', label: 'Cider' },
  { value: 'wine', label: 'Wine' },
  { value: 'rtd', label: 'Ready to drink' },
  { value: 'non_alcoholic', label: 'Soft drinks' },
]

const VOLUME_OPTIONS: { value: AnnualProductionBucket; label: string; sublabel: string }[] = [
  { value: '<10k', label: 'A few thousand bottles', sublabel: 'Micro / craft' },
  { value: '10k-100k', label: 'Tens of thousands', sublabel: 'Small producer' },
  { value: '100k-1M', label: 'Hundreds of thousands', sublabel: 'Regional brand' },
  { value: '1M+', label: 'Millions', sublabel: 'Large producer' },
]

/**
 * Screen 1 of 6: the front door itself. One question — "Where can we find
 * you?" — does double duty as the welcome (one sentence about alkatera
 * above the input) and the org-creation step: submitting silently calls the
 * same create-organization edge function app/create-organization/page.tsx
 * used to, then fires the same background website scrape
 * FastTrackSetupStep triggers, and advances immediately — the scrape keeps
 * running while the user answers the next couple of questions, and
 * arrival-confirm picks up its jobId to show live progress without
 * starting a second crawl.
 *
 * Defensive compat path: an in-flight arrival user from the old 5-step
 * shape can land here with 'arrival-welcome' remapped onto this step (see
 * OnboardingContext's load-time compat shim) while already having an
 * organisation (the old flow created it via /create-organization before the
 * ritual even started). In that case this step never creates a second org —
 * it just captures the website/name for personalization and moves on.
 */

/** Strip scheme/www/path, drop the TLD (and a few common two-part ones),
 * title-case what's left, hyphens/underscores → spaces. A provisional name
 * only — arrival-confirm lets the user fix it with one tap. */
function deriveNameFromDomain(rawUrl: string): string {
  const withoutScheme = rawUrl.trim().replace(/^https?:\/\//i, '')
  const host = withoutScheme.split(/[/?#]/)[0].replace(/^www\./i, '').toLowerCase()
  const labels = host.split('.').filter(Boolean)
  if (labels.length === 0) return 'Your Company'
  const TWO_PART_TLDS = new Set(['co.uk', 'com.au', 'co.nz', 'co.za', 'com.br', 'co.jp', 'org.uk', 'me.uk'])
  const lastTwo = labels.slice(-2).join('.')
  const base =
    labels.length > 1 && TWO_PART_TLDS.has(lastTwo)
      ? labels.slice(0, -2)
      : labels.length > 1
        ? labels.slice(0, -1)
        : labels
  const words = base.join(' ').split(/[-_]+/).filter(Boolean)
  if (!words.length) return 'Your Company'
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/** Same permissive check FastTrackSetupStep uses elsewhere: accepts bare
 * domains, no scheme required. */
function validateWebsiteUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Enter your website, or tell us you do not have one.'
  if (/\s/.test(trimmed)) return 'No spaces, please.'
  if (!/^(?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/.*)?$/i.test(trimmed)) {
    return "That doesn't look like a website."
  }
  return null
}

export function ArrivalWebsiteStep() {
  const { completeStep, updatePersonalization, attachOrganizationId } = useOnboarding()
  const { currentOrganization, mutate } = useOrganization()

  const [mode, setMode] = useState<'website' | 'name'>('website')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prefilled, setPrefilled] = useState(false)
  const submittedRef = useRef(false)
  // The no-website path is a three-tap archetype flow (name + country → drink →
  // volume) so the desk arrives benchmark-warm instead of sparse.
  const [nameStep, setNameStep] = useState<'name' | 'drink' | 'volume'>('name')
  const [countryCode, setCountryCode] = useState('')
  const [drinkType, setDrinkType] = useState<BeverageType | null>(null)

  // Compat: an in-flight 'arrival-welcome' user already has an org from the
  // old /create-organization detour — never create a second one.
  const alreadyHasOrg = !!currentOrganization

  // Pre-fill the URL from the domain the signup form already recognised, so
  // the front door usually opens with the answer in place (one tap, no
  // typing). Client-only + guarded so there is no hydration mismatch; only
  // fills an empty field, never fights the user.
  useEffect(() => {
    if (websiteUrl) return
    const guess = readDomainGuess()
    if (guess && !guess.isConsumer && guess.domain) {
      setWebsiteUrl(guess.domain)
      setPrefilled(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function createOrganizationSilently(name: string): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Please sign in again.')
    const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-organization`
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ name, product_type: null }),
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "That didn't work. Try again.")
    }
    // Claim the new org ID before mutate() lands so OnboardingContext's
    // org-appeared refetch doesn't reset our in-memory arrival progress.
    attachOrganizationId(result.organization.id)
    await mutate({ organization: result.organization, role: result.role, user: session.user })
    return result.organization.id as string
  }

  /** Fire the same background crawl FastTrackSetupStep triggers, and hand
   * its job ID to personalization so arrival-confirm resumes it instead of
   * starting a second scrape of the same site. Never blocks — a failure
   * here just means arrival-confirm's fields stay blank for hand-filling. */
  async function fireScrape(url: string): Promise<string | undefined> {
    try {
      const res = await fetch('/api/products/import-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const body = await res.json().catch(() => ({}))
      return res.ok && body?.jobId ? String(body.jobId) : undefined
    } catch (err) {
      console.warn('[arrival-website] scrape kickoff failed:', err)
      return undefined
    }
  }

  /** Fire the Companies House lookup in parallel and stash whatever comes
   * back into personalization, so arrival-confirm can show "From Companies
   * House." facts. Never awaited and never blocks: a miss (or no API key)
   * just means the confirm screen has one fewer pre-filled fact. */
  function fireCompaniesHouse(name: string): void {
    void (async () => {
      try {
        const res = await fetch(`/api/enrich/company?name=${encodeURIComponent(name)}`)
        const body = await res.json().catch(() => ({}))
        const p = body?.profile
        if (!p?.companyNumber || !p?.name) return
        updatePersonalization({
          companiesHouse: {
            companyNumber: p.companyNumber,
            name: p.name,
            incorporationYear: p.incorporationYear ?? undefined,
            country: p.registeredAddress?.country ?? undefined,
            registeredAddress: p.registeredAddress
              ? {
                  line1: p.registeredAddress.line1 ?? undefined,
                  city: p.registeredAddress.city ?? undefined,
                  postalCode: p.registeredAddress.postalCode ?? undefined,
                  country: p.registeredAddress.country ?? undefined,
                }
              : undefined,
          },
        })
      } catch (err) {
        console.warn('[arrival-website] companies house lookup failed:', err)
      }
    })()
  }

  const handleWebsiteSubmit = async () => {
    if (isSubmitting || submittedRef.current) return
    const trimmed = websiteUrl.trim()
    const validationError = validateWebsiteUrl(trimmed)
    if (validationError) {
      setError(validationError)
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const derivedName = deriveNameFromDomain(trimmed)
      const orgId = alreadyHasOrg
        ? currentOrganization?.id
        : await createOrganizationSilently(derivedName)
      submittedRef.current = true
      // Recognition rate (spec §11): did the user accept the URL we pre-filled
      // from their email domain, or type/correct it themselves?
      trackOnboarding({
        organizationId: orgId,
        flow: 'arrival',
        step: 'arrival-website',
        event: 'complete',
        meta: { metric: 'recognition', prefilledAccepted: prefilled, path: 'website' },
      })
      fireCompaniesHouse(derivedName)
      const jobId = await fireScrape(trimmed)
      updatePersonalization({ websiteUrl: trimmed, ...(jobId ? { scrapeJobId: jobId } : {}) })
      completeStep()
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.")
      setIsSubmitting(false)
    }
  }

  const handleNameNext = () => {
    if (!companyName.trim()) { setError('Enter your company name.'); return }
    if (!countryCode) { setError('Where are you based?'); return }
    setError(null)
    setNameStep('drink')
  }

  const selectDrink = (value: BeverageType) => {
    setDrinkType(value)
    setError(null)
    setNameStep('volume')
  }

  /** Final archetype step: create the org and seed the benchmark inputs
   * (drink category, country, volume bucket) so the confirm screen reads warm
   * and the estimate step's benchmark path produces a real number — no scrape,
   * no products to seed, everything provenance 'estimated'. */
  const selectVolume = async (bucket: AnnualProductionBucket) => {
    if (isSubmitting || submittedRef.current) return
    const trimmed = companyName.trim()
    setIsSubmitting(true)
    setError(null)
    try {
      if (!alreadyHasOrg) {
        await createOrganizationSilently(trimmed)
      }
      submittedRef.current = true
      fireCompaniesHouse(trimmed)
      const countryLabel = COUNTRIES.find(c => c.value === countryCode)?.label
      updatePersonalization({
        ...(drinkType ? { beverageTypes: [drinkType] } : {}),
        ...(countryLabel ? { country: countryLabel } : {}),
        annualProductionBucket: bucket,
      })
      completeStep()
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 text-center animate-in fade-in duration-700">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-3">
          <Eyebrow tone="dim" className="justify-center flex">Welcome</Eyebrow>
          <h1 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.02em] text-foreground">
            alka<strong>tera</strong> turns what your business already does into a real sustainability picture.
          </h1>
        </div>

        {mode === 'website' ? (
          <div className="space-y-3 text-left">
            <Label className="text-sm font-medium text-foreground">Where can we find you?</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-studio-dim" />
              <Input
                placeholder="www.yourcompany.com"
                value={websiteUrl}
                onChange={e => { setWebsiteUrl(e.target.value); setError(null); setPrefilled(false) }}
                onKeyDown={e => { if (e.key === 'Enter') handleWebsiteSubmit() }}
                disabled={isSubmitting}
                aria-invalid={!!error}
                className="h-11 pl-9"
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-studio-stale">{error}</p>}
            {prefilled && !error && (
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-studio-good">
                From your email. Right?
              </p>
            )}
            <PillButton onClick={handleWebsiteSubmit} disabled={isSubmitting} variant="ink" size="md" className="w-full">
              {isSubmitting ? 'One moment…' : (<>Continue<ArrowRight className="h-4 w-4" /></>)}
            </PillButton>
            <button
              type="button"
              onClick={() => { setMode('name'); setError(null) }}
              disabled={isSubmitting}
              className="block w-full text-center font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-opacity duration-150 ease-studio hover:text-foreground disabled:opacity-50"
            >
              We do not have a website.
            </button>
          </div>
        ) : (
          <div className="space-y-3 text-left">
            {nameStep === 'name' && (
              <>
                <Label className="text-sm font-medium text-foreground">What is your company called?</Label>
                <Input
                  placeholder='e.g., "Oxford Artisan Distillery"'
                  value={companyName}
                  onChange={e => { setCompanyName(e.target.value); setError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') handleNameNext() }}
                  disabled={isSubmitting}
                  aria-invalid={!!error}
                  className="h-11"
                  autoFocus
                />
                <Label className="text-sm font-medium text-foreground">Where are you based?</Label>
                <CountrySelect value={countryCode} onChange={code => { setCountryCode(code); setError(null) }} placeholder="Select country" />
                {error && <p className="text-xs text-studio-stale">{error}</p>}
                <PillButton onClick={handleNameNext} disabled={isSubmitting} variant="ink" size="md" className="w-full">
                  Continue<ArrowRight className="h-4 w-4" />
                </PillButton>
                <button
                  type="button"
                  onClick={() => { setMode('website'); setError(null) }}
                  disabled={isSubmitting}
                  className="block w-full text-center font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-opacity duration-150 ease-studio hover:text-foreground disabled:opacity-50"
                >
                  Actually, I do have a website.
                </button>
              </>
            )}

            {nameStep === 'drink' && (
              <>
                <p className="text-center font-display text-lg font-bold tracking-tight text-foreground">What do you make?</p>
                <div className="grid grid-cols-2 gap-2">
                  {DRINK_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => selectDrink(opt.value)}
                      className="rounded-[6px] border border-studio-hairline bg-studio-cream p-4 text-center text-sm font-semibold text-foreground transition-colors hover:border-studio-ink/25 hover:bg-secondary"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setNameStep('name'); setError(null) }}
                  className="block w-full text-center font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-opacity duration-150 ease-studio hover:text-foreground"
                >
                  Back
                </button>
              </>
            )}

            {nameStep === 'volume' && (
              <>
                <p className="text-center font-display text-lg font-bold tracking-tight text-foreground">Roughly how much a year?</p>
                <div className="grid grid-cols-2 gap-2">
                  {VOLUME_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => selectVolume(opt.value)}
                      className={cn(
                        'flex flex-col gap-0.5 rounded-[6px] border border-studio-hairline bg-studio-cream p-3 text-left transition-colors hover:border-studio-ink/25 hover:bg-secondary disabled:opacity-60',
                      )}
                    >
                      <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.sublabel}</span>
                    </button>
                  ))}
                </div>
                {error && <p className="text-xs text-studio-stale">{error}</p>}
                {isSubmitting && <p className="text-center font-mono text-[11px] uppercase tracking-[0.16em] text-studio-dim">One moment…</p>}
                <button
                  type="button"
                  onClick={() => { setNameStep('drink'); setError(null) }}
                  disabled={isSubmitting}
                  className="block w-full text-center font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-opacity duration-150 ease-studio hover:text-foreground disabled:opacity-50"
                >
                  Back
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
