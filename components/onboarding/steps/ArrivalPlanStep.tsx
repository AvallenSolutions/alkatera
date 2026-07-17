'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { PRICING_TIERS, type TierKey } from '@/lib/stripe/pricing-tiers'
import { Eyebrow, BigNumber, PillButton } from '@/components/studio'
import { RosaIntro } from './RosaIntro'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type BillingInterval = 'monthly' | 'annual'
type Phase = 'plan' | 'checking' | 'forest'

/** Read once at mount — never re-derived, so cleaning the query string later
 * (via history.replaceState, not a Next navigation) can't flip this back. */
function arrivalCompleteFromUrl(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('arrival') === 'complete'
}

/**
 * Screen 6 of 6: the trial/plan choice, restyled for the studio and moved
 * to the END of the ritual — the user sees their number (arrival-estimate)
 * before ever being asked for a card. Reuses complete-subscription's
 * checkout-session call verbatim (same API, same business rules, same
 * PRICING_TIERS copy), just with returnPath: '/desk/' so Stripe's
 * success_url lands back inside the wizard instead of on the standalone
 * page — see app/api/stripe/create-checkout-session/route.ts.
 *
 * On return (?arrival=complete in the URL), polls the org's
 * subscription_status until Stripe's webhook has flipped it to
 * trial/active (mirroring /complete-subscription's own poll pattern) —
 * AppLayout's payment gate already tolerates 'pending' while the arrival
 * flow is incomplete, so there's no risk of being bounced mid-poll. Once
 * confirmed, fires the same day-one Rosa seed call the old
 * ArrivalEstimateStep used to fire at its "forest" close (moved here along
 * with the close itself), and shows the "your forest has started" moment.
 * completeOnboarding() only fires on the final "Go to your desk" tap —
 * flipping state.completed earlier would unmount this component (the
 * overlay) before the reveal ever rendered.
 */
export function ArrivalPlanStep() {
  const { state, completeOnboarding } = useOnboarding()
  const { currentOrganization } = useOrganization()
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>(() => (arrivalCompleteFromUrl() ? 'checking' : 'plan'))
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly')
  const [processingTier, setProcessingTier] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)
  const finishedRef = useRef(false)

  const displayTonnes = state.personalization?.estimateTonnesCO2e ?? 0

  useEffect(() => {
    if (phase !== 'checking' || !currentOrganization?.id) return
    const orgId = currentOrganization.id
    const supabase = getSupabaseBrowserClient()
    let cancelled = false
    let pollCount = 0
    const maxPolls = 30 // ~60s, matching /complete-subscription's own poll budget

    const finish = async () => {
      if (finishedRef.current) return
      finishedRef.current = true
      try {
        await fetch('/api/onboarding/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: orgId }),
        })
      } catch (err) {
        console.error('[arrival-plan] seed call failed:', err)
      }
      // Strip '?arrival=complete' without a navigation (that would remount
      // this component) — a reload from the forest screen should stay put.
      window.history.replaceState({}, '', '/desk/')
      if (!cancelled) setPhase('forest')
    }

    const interval = setInterval(async () => {
      pollCount++
      const { data } = await supabase
        .from('organizations')
        .select('subscription_status')
        .eq('id', orgId)
        .single()
      const status = data?.subscription_status
      if (status === 'trial' || status === 'active') {
        clearInterval(interval)
        finish()
      } else if (pollCount >= maxPolls) {
        // Webhook lag past a minute — the plan choice is already committed
        // on Stripe's side; treat this as a provisional success rather than
        // leaving the user stuck on a spinner (see plan Risks).
        clearInterval(interval)
        finish()
      }
    }, 2000)

    return () => { cancelled = true; clearInterval(interval) }
  }, [phase, currentOrganization?.id])

  async function startCheckout(body: Record<string, unknown>) {
    const res = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, organizationId: currentOrganization?.id, returnPath: '/desk/' }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to start checkout')
    if (!data.url) throw new Error('No checkout URL returned')
    window.location.href = data.url
  }

  const handleStartTrial = async () => {
    if (!currentOrganization || processingTier) return
    setProcessingTier('trial')
    setCheckoutError(null)
    try {
      await startCheckout({ trial: true, tierName: 'seed', billingInterval: 'monthly' })
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Failed to start free trial. Try again.')
      setProcessingTier(null)
    }
  }

  const handleSelectPlan = async (tierKey: TierKey) => {
    if (!currentOrganization || processingTier) return
    setProcessingTier(tierKey)
    setCheckoutError(null)
    try {
      await startCheckout({ tierName: tierKey, billingInterval })
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Failed to start checkout. Try again.')
      setProcessingTier(null)
    }
  }

  const handleGoToDesk = async () => {
    if (launching) return
    setLaunching(true)
    await completeOnboarding()
    router.push('/desk/')
  }

  if (phase === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 text-center animate-in fade-in duration-500">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-studio-dim">Setting things up&hellip;</p>
      </div>
    )
  }

  if (phase === 'forest') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 text-center animate-in fade-in duration-700">
        <div className="w-full max-w-md space-y-6">
          <RosaIntro message="Lovely. I've got what I need to start. I'll show you what to look at first on your desk." />

          <div className="space-y-3">
            <Eyebrow tone="dim" className="justify-center flex">Your forest</Eyebrow>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Your forest has started.</h2>
          </div>

          <div className="inline-block rounded-[6px] border border-studio-hairline bg-studio-cream px-6 py-4">
            <BigNumber
              value={<span className="text-studio-forest">~{displayTonnes > 0 ? displayTonnes.toLocaleString() : '<1'}</span>}
              label="t CO₂e / year, estimated"
            />
          </div>

          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Every real number you add from here grows it further. Your desk will show you where to start.
          </p>

          <PillButton onClick={handleGoToDesk} disabled={launching} variant="ink" size="md" className="px-6">
            {launching ? 'Loading…' : 'Go to your desk'}
            {!launching && <ArrowRight className="h-4 w-4" />}
          </PillButton>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 animate-in fade-in duration-500">
      <div className="w-full max-w-lg space-y-6">
        <RosaIntro message="One last thing. Start a free trial to explore properly, or choose a plan now if you already know alkatera is for you." />

        <div className="text-center space-y-2">
          <Eyebrow tone="dim" className="justify-center flex">Your plan</Eyebrow>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Start your 30 day trial.</h2>
          <p className="text-sm text-muted-foreground">
            Add a facility, build a product LCA and explore properly. We ask for a card to keep things secure, but you will not be charged automatically.
          </p>
        </div>

        {checkoutError && <p className="text-center text-xs text-studio-stale">{checkoutError}</p>}

        <div className="rounded-[6px] border border-studio-forest/40 bg-studio-cream p-6 text-center space-y-3">
          <PillButton onClick={handleStartTrial} disabled={!!processingTier} variant="ink" size="md" className="px-8">
            {processingTier === 'trial' ? 'Starting trial…' : 'Start free trial'}
          </PillButton>
          <p className="text-xs text-studio-dim max-w-sm mx-auto">
            30 days free. No automatic charge. Choose a plan whenever you are ready.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-studio-hairline" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-studio-dim">Or choose a plan now</span>
          <div className="flex-1 h-px bg-studio-hairline" />
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setBillingInterval('monthly')}
            className={cn(
              'font-mono text-[10px] uppercase tracking-widest px-4 py-2 rounded-full transition-colors',
              billingInterval === 'monthly' ? 'bg-studio-ink text-studio-cream font-bold' : 'border border-studio-hairline text-muted-foreground hover:text-foreground',
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval('annual')}
            className={cn(
              'font-mono text-[10px] uppercase tracking-widest px-4 py-2 rounded-full transition-colors',
              billingInterval === 'annual' ? 'bg-studio-ink text-studio-cream font-bold' : 'border border-studio-hairline text-muted-foreground hover:text-foreground',
            )}
          >
            Annual
          </button>
        </div>

        <div className="space-y-3">
          {PRICING_TIERS.map(tier => {
            const isProcessing = processingTier === tier.tierKey
            const price = billingInterval === 'monthly' ? tier.monthly : tier.annual
            return (
              <button
                key={tier.tierKey}
                type="button"
                onClick={() => handleSelectPlan(tier.tierKey)}
                disabled={!!processingTier}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-[6px] border text-left transition-colors disabled:opacity-60',
                  tier.highlight ? 'border-studio-forest bg-secondary' : 'border-studio-hairline bg-card hover:border-studio-ink/25 hover:bg-secondary',
                )}
              >
                <tier.icon className={cn('w-6 h-6 shrink-0', tier.highlight ? 'text-studio-forest' : 'text-studio-dim')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="font-display font-bold text-foreground">{tier.name}</p>
                    {tier.highlight && (
                      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-studio-forest">Recommended</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{tier.tagline}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-bold text-foreground tabular-nums">
                    £{price.founder.toLocaleString()}<span className="text-xs text-muted-foreground font-normal">/{billingInterval === 'monthly' ? 'mo' : 'yr'}</span>
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-studio-dim">
                    {isProcessing ? 'Processing…' : 'Select'}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        <p className="text-center text-xs text-studio-dim">All plans include a 14-day money-back guarantee. Cancel any time.</p>
      </div>
    </div>
  )
}
