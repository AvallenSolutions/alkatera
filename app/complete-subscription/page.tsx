'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { PRICING_TIERS as tiers } from '@/lib/stripe/pricing-tiers'

type BillingInterval = 'monthly' | 'annual'

/** The studio leaf, for the header and the faint corner watermark. */
function LeafMark({ size, className }: { size: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className={className}>
      <path d="M24 7 C 31 19 37 24 37 29 A 13 13 0 1 1 11 29 C 11 24 17 19 24 7 Z" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <line x1="24" y1="14" x2="24" y2="41" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="24" y1="27" x2="31" y2="20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="24" y1="27" x2="17" y2="20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function CompleteSubscriptionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentOrganization, isLoading: isOrgLoading, userRole, mutate } = useOrganization()
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly')
  const [processingCheckout, setProcessingCheckout] = useState(false)
  const [processingTier, setProcessingTier] = useState<string | null>(null)
  const [hasShownToast, setHasShownToast] = useState(false)

  const isPaymentSuccess = searchParams.get('success') === 'true'
  const isCanceled = searchParams.get('canceled') === 'true'
  const tierParam = searchParams.get('tier')
  const isTrialParam = searchParams.get('trial') === 'true'

  // Suppliers should never see the subscription page - redirect to their portal
  useEffect(() => {
    if (!isOrgLoading && userRole === 'supplier') {
      router.push('/supplier-portal')
    }
  }, [isOrgLoading, userRole, router])

  // Poll for subscription activation after successful payment
  useEffect(() => {
    if (!isPaymentSuccess || !currentOrganization?.id) return

    const orgId = currentOrganization.id
    const supabase = getSupabaseBrowserClient()
    let pollCount = 0
    const maxPolls = 30 // 30 seconds max

    const pollInterval = setInterval(async () => {
      pollCount++
      console.log(`[CompleteSubscription] Polling for active subscription... (${pollCount}/${maxPolls})`)

      // Query Supabase directly for fresh status
      const { data, error } = await supabase
        .from('organizations')
        .select('subscription_status')
        .eq('id', orgId)
        .single()

      console.log(`[CompleteSubscription] Poll result:`, data?.subscription_status, error?.message)

      const status = data?.subscription_status
      if (status === 'active' || status === 'trial') {
        clearInterval(pollInterval)
        // Refresh org context so dashboard has fresh data
        if (mutate) await mutate()
        toast.success(isTrialParam ? 'Your free trial is ready!' : 'Subscription activated successfully!', {
          description: isTrialParam
            ? 'Welcome to alkatera. Add a facility and build your first LCA.'
            : `Welcome to the ${tierParam || ''} plan.`,
        })
        router.push('/desk/')
        return
      }

      if (pollCount >= maxPolls) {
        clearInterval(pollInterval)
        // Refresh org context before redirecting
        if (mutate) await mutate()
        toast.success('Payment received!', {
          description: 'Your subscription is being set up. You can access your dashboard shortly.',
        })
        router.push('/desk/')
      }
    }, 2000) // Poll every 2s to give webhook time

    return () => clearInterval(pollInterval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaymentSuccess, currentOrganization?.id])

  // Show canceled toast
  useEffect(() => {
    if (isCanceled && !hasShownToast) {
      toast.info('Checkout canceled. You can try again when you\'re ready.')
      setHasShownToast(true)
    }
  }, [isCanceled, hasShownToast])

  useEffect(() => {
    if (!isOrgLoading && currentOrganization && !hasShownToast && !isPaymentSuccess && !isCanceled) {
      toast.success('Organisation created successfully!', {
        description: 'Now choose a plan to get started with alkatera.',
      })
      setHasShownToast(true)
    }
  }, [isOrgLoading, currentOrganization, hasShownToast, isPaymentSuccess, isCanceled])

  async function handleStartTrial() {
    if (!currentOrganization) {
      toast.error('No organisation found. Please try again.')
      router.push('/desk/')
      return
    }

    setProcessingCheckout(true)
    setProcessingTier('trial')

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trial: true,
          tierName: 'seed',
          billingInterval: 'monthly',
          organizationId: currentOrganization.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start free trial')
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (error: any) {
      console.error('Error starting free trial:', error)
      toast.error(error.message || 'Failed to start free trial')
    } finally {
      setProcessingCheckout(false)
      setProcessingTier(null)
    }
  }

  async function handleSelectPlan(tierName: string) {
    console.log('[CompleteSubscription] handleSelectPlan called:', { tierName, currentOrganization: currentOrganization?.id, billingInterval })

    if (!currentOrganization) {
      console.error('[CompleteSubscription] No current organization!')
      toast.error('No organisation found. Please try again.')
      router.push('/desk/')
      return
    }

    setProcessingCheckout(true)
    setProcessingTier(tierName)

    try {
      console.log('[CompleteSubscription] Creating checkout session...')
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierName,
          billingInterval,
          organizationId: currentOrganization.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (error: any) {
      console.error('Error creating checkout session:', error)
      toast.error(error.message || 'Failed to start checkout')
    } finally {
      setProcessingCheckout(false)
      setProcessingTier(null)
    }
  }

  const [showContinueButton, setShowContinueButton] = useState(false)

  // Show continue button after 10 seconds
  useEffect(() => {
    if (!isPaymentSuccess) return
    const timer = setTimeout(() => setShowContinueButton(true), 10000)
    return () => clearTimeout(timer)
  }, [isPaymentSuccess])

  // Show success/processing state after payment
  if (isPaymentSuccess) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-studio-paper px-6">
        <LeafMark size={560} className="pointer-events-none absolute -bottom-36 -right-36 text-studio-ink opacity-[0.08]" />
        <div className="relative w-full max-w-md rounded-[6px] border border-studio-hairline bg-studio-cream p-10 text-center">
          <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full border border-studio-forest/40">
            <CheckCircle2 className="h-8 w-8 text-studio-forest" />
          </div>
          <h1 className="mb-3 font-display text-3xl font-bold tracking-tight text-studio-ink">
            {isTrialParam ? "You're all set." : 'Payment received.'}
          </h1>
          <p className="mb-2 text-sm leading-relaxed text-studio-dim">
            {isTrialParam
              ? 'Setting up your free trial...'
              : `Setting up your ${tierParam ? tierParam.charAt(0).toUpperCase() + tierParam.slice(1) : ''} subscription...`}
          </p>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
            This should only take a moment
          </p>
          {showContinueButton && (
            <button
              onClick={async () => {
                if (mutate) await mutate()
                router.push('/desk/')
              }}
              className="mt-6 rounded-full bg-studio-ink px-8 py-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-studio-cream transition-colors hover:bg-studio-ink/90"
            >
              Continue to the studio
            </button>
          )}
        </div>
      </div>
    )
  }

  if (isOrgLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-studio-paper">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-studio-dim">Loading…</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-studio-paper">
      <LeafMark size={560} className="pointer-events-none absolute -bottom-36 -right-36 text-studio-ink opacity-[0.08]" />

      <div className="relative z-10 container mx-auto max-w-6xl px-6 py-12 md:px-12">
        {/* The mark */}
        <div className="mb-8 flex justify-center">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <LeafMark size={22} className="text-studio-forest" />
            <span className="font-display text-lg text-studio-ink">
              <span className="font-medium">alka</span>
              <span className="font-bold">tera</span>
            </span>
          </Link>
        </div>

        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 font-display text-4xl font-medium tracking-tight text-studio-ink md:text-6xl">
            Welcome to alka<span className="font-bold">tera</span>.
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-studio-dim">
            Your organisation <strong className="font-semibold text-studio-ink">{currentOrganization?.name}</strong> has
            been created. Choose a plan below to start your sustainability journey.
          </p>
        </div>

        {/* Free trial hero — the primary path for new orgs */}
        <div className="mx-auto mb-12 max-w-3xl">
          <div className="rounded-[6px] border border-studio-hairline bg-studio-cream p-8 text-center">
            <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
              Not ready to commit?
            </p>
            <h2 className="mb-3 font-display text-3xl font-bold tracking-tight text-studio-ink md:text-4xl">
              Start your 30-day free trial.
            </h2>
            <p className="mx-auto mb-6 max-w-xl text-sm leading-relaxed text-studio-dim md:text-base">
              Add a facility, build a product LCA and explore the platform. We ask for a card to keep
              things secure, but you won&apos;t be charged anything automatically. Choose a plan
              whenever you&apos;re ready.
            </p>
            <button
              onClick={handleStartTrial}
              disabled={processingCheckout}
              className="rounded-full bg-studio-ink px-10 py-4 font-mono text-xs font-bold uppercase tracking-[0.22em] text-studio-cream transition-colors hover:bg-studio-ink/90 disabled:opacity-50"
            >
              {processingTier === 'trial' ? 'Starting trial…' : 'Start free trial'}
            </button>
            <p className="mt-4 text-[11px] text-studio-dim">
              30 days free. No automatic charge. Your card stays on file so choosing a plan later is one click.
            </p>
          </div>
          <div className="mt-10 flex items-center gap-4">
            <div className="h-px flex-1 bg-studio-hairline" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-studio-dim">
              Or choose a plan now
            </span>
            <div className="h-px flex-1 bg-studio-hairline" />
          </div>
        </div>

        {/* Billing toggle */}
        <div className="mb-8 flex items-center justify-center gap-3">
          {(['monthly', 'annual'] as const).map((interval) => (
            <button
              key={interval}
              onClick={() => setBillingInterval(interval)}
              className={cn(
                'rounded-full px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.18em] transition-all',
                billingInterval === interval
                  ? 'bg-studio-ink text-studio-cream'
                  : 'border border-studio-hairline text-studio-dim hover:border-studio-ink hover:text-studio-ink'
              )}
            >
              {interval}
            </button>
          ))}
        </div>

        {/* Founding partner note */}
        <div className="mb-10 flex justify-center">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-ochre-ink">
            Founding partner pricing · Limited availability
          </span>
        </div>

        {/* Plans */}
        <div className="mb-12 grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
          {tiers.map((tier, idx) => {
            const isProcessing = processingTier === tier.tierKey

            return (
              <div
                key={idx}
                className={cn(
                  'relative flex flex-col rounded-[6px] bg-studio-cream p-8',
                  tier.highlight
                    ? 'border-[1.5px] border-studio-ink'
                    : 'border border-studio-hairline'
                )}
              >
                {tier.highlight && (
                  <p className="absolute -top-2.5 left-7 rounded-full bg-studio-ink px-2.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.2em] text-studio-cream">
                    Recommended
                  </p>
                )}

                <div className="mb-4 flex items-center justify-between">
                  <h4 className="font-display text-3xl font-bold tracking-tight text-studio-ink">
                    {tier.name}
                  </h4>
                  <tier.icon className={tier.highlight ? 'text-studio-forest' : 'text-studio-dim'} />
                </div>

                <div className="mb-6">
                  <div className="mb-1 flex items-baseline gap-2">
                    <span
                      className="font-display text-4xl font-bold tabular-nums tracking-tight text-studio-ink"
                    >
                      £{billingInterval === 'monthly' ? tier.monthly.founder : tier.annual.founder.toLocaleString()}
                    </span>
                    <span className="font-display text-lg text-studio-dim line-through">
                      £{billingInterval === 'monthly' ? tier.monthly.original : tier.annual.original.toLocaleString()}
                    </span>
                    <span className="text-sm text-studio-dim">/{billingInterval === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  <div className="mb-3">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-ochre-ink">
                      Save £{billingInterval === 'monthly'
                        ? tier.monthly.saving
                        : tier.annual.saving.toLocaleString()}{billingInterval === 'monthly' ? '/mo' : '/yr'}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-studio-dim">{tier.tagline}</p>
                </div>

                {/* Limits */}
                <div className="mb-8 grid grid-cols-2 gap-2 rounded-[4px] bg-studio-paper p-4">
                  {tier.limits.map((limit, lIdx) => (
                    <div key={lIdx} className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-studio-dim">
                      {limit}
                    </div>
                  ))}
                </div>

                <ul className="mb-10 flex-1 space-y-3">
                  {tier.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-3 text-sm">
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-studio-forest" />
                      <span
                        className={cn(
                          'leading-relaxed text-studio-ink',
                          feat.startsWith('Everything') &&
                            'w-full border-b border-studio-hairline pb-1 font-semibold'
                        )}
                      >
                        {feat}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(tier.tierKey)}
                  disabled={processingCheckout}
                  className={cn(
                    'block w-full rounded-full py-4 text-center font-mono text-xs font-bold uppercase tracking-[0.22em] transition-colors disabled:opacity-50',
                    tier.highlight
                      ? 'bg-studio-ink text-studio-cream hover:bg-studio-ink/90'
                      : 'border border-studio-ink text-studio-ink hover:bg-studio-ink/5'
                  )}
                >
                  {isProcessing ? 'Processing…' : 'Get started'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer note */}
        <div className="text-center text-sm text-studio-dim">
          <p>All plans include a 14-day money-back guarantee. Cancel anytime.</p>
          <p className="mt-2">
            Questions?{' '}
            <a href="/contact" className="font-medium text-studio-forest underline underline-offset-4">
              Contact our team
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function CompleteSubscriptionPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-studio-paper">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-studio-dim">Loading…</p>
      </div>
    }>
      <CompleteSubscriptionContent />
    </Suspense>
  )
}
