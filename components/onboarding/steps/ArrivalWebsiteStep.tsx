'use client'

import { useRef, useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eyebrow, PillButton } from '@/components/studio'
import { ArrowRight, Globe } from 'lucide-react'

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
  const submittedRef = useRef(false)

  // Compat: an in-flight 'arrival-welcome' user already has an org from the
  // old /create-organization detour — never create a second one.
  const alreadyHasOrg = !!currentOrganization

  async function createOrganizationSilently(name: string): Promise<void> {
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
      if (!alreadyHasOrg) {
        await createOrganizationSilently(deriveNameFromDomain(trimmed))
      }
      submittedRef.current = true
      const jobId = await fireScrape(trimmed)
      updatePersonalization({ websiteUrl: trimmed, ...(jobId ? { scrapeJobId: jobId } : {}) })
      completeStep()
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.")
      setIsSubmitting(false)
    }
  }

  const handleNoWebsiteSubmit = async () => {
    if (isSubmitting || submittedRef.current) return
    const trimmed = companyName.trim()
    if (!trimmed) {
      setError('Enter your company name.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      if (!alreadyHasOrg) {
        await createOrganizationSilently(trimmed)
      }
      submittedRef.current = true
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
                onChange={e => { setWebsiteUrl(e.target.value); setError(null) }}
                onKeyDown={e => { if (e.key === 'Enter') handleWebsiteSubmit() }}
                disabled={isSubmitting}
                aria-invalid={!!error}
                className="h-11 pl-9"
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-studio-stale">{error}</p>}
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
            <Label className="text-sm font-medium text-foreground">What is your company called?</Label>
            <Input
              placeholder='e.g., "Oxford Artisan Distillery"'
              value={companyName}
              onChange={e => { setCompanyName(e.target.value); setError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') handleNoWebsiteSubmit() }}
              disabled={isSubmitting}
              aria-invalid={!!error}
              className="h-11"
              autoFocus
            />
            {error && <p className="text-xs text-studio-stale">{error}</p>}
            <PillButton onClick={handleNoWebsiteSubmit} disabled={isSubmitting} variant="ink" size="md" className="w-full">
              {isSubmitting ? 'One moment…' : (<>Continue<ArrowRight className="h-4 w-4" /></>)}
            </PillButton>
            <button
              type="button"
              onClick={() => { setMode('website'); setError(null) }}
              disabled={isSubmitting}
              className="block w-full text-center font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-opacity duration-150 ease-studio hover:text-foreground disabled:opacity-50"
            >
              Actually, I do have a website.
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
