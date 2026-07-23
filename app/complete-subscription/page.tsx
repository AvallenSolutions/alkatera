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
import Image from 'next/image'

type BillingInterval = 'monthly' | 'annual'

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
      router.push('/create-organization')
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
      router.push('/create-organization')
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
      <div className="relative min-h-screen">
        <Image
          src="/images/starry-night-bg.jpg"
          alt="Starry night sky"
          fill
          className="object-cover"
          priority
          quality={85}
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 text-center px-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 border border-white/20">
              <CheckCircle2 className="h-10 w-10 text-[#F2F1EA]" />
            </div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-[#F2F1EA]">{isTrialParam ? "You're all set." : 'Payment received.'}</h1>
            <p className="text-lg text-white/70 max-w-md">
              {isTrialParam
                ? 'Setting up your free trial...'
                : `Setting up your ${tierParam ? tierParam.charAt(0).toUpperCase() + tierParam.slice(1) : ''} subscription...`}
            </p>
            <p className="text-sm text-white/40">This should only take a moment.</p>
            {showContinueButton && (
              <button
                onClick={async () => {
                  if (mutate) await mutate()
                  router.push('/desk/')
                }}
                className="mt-4 px-8 py-3 bg-[#F2F1EA] text-[#1A1B1D] font-mono uppercase text-xs tracking-[0.22em] font-bold rounded-full hover:bg-white transition-colors"
              >
                Continue to dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (isOrgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1B1D]">
        <p className="font-mono text-sm uppercase tracking-[0.22em] text-[#F2F1EA]/70">Loading...</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
      <Image
        src="/images/starry-night-bg.jpg"
        alt="Starry night sky"
        fill
        className="object-cover"
        priority
        quality={85}
      />
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 container mx-auto px-6 md:px-20 py-12 max-w-7xl">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Link href="/">
            <img
              src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png"
              alt="alkatera"
              className="h-10 md:h-14 w-auto object-contain mix-blend-screen brightness-125 contrast-150"
              style={{ mixBlendMode: 'screen' }}
            />
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-display font-medium tracking-tight text-4xl md:text-6xl lg:text-7xl text-[#F2F1EA] mb-4">
            Welcome to alka<span className="font-bold">tera</span>.
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Your organisation <strong className="text-white">{currentOrganization?.name}</strong> has been created.
            Choose a plan below to start your sustainability journey.
          </p>
        </div>

        {/* Free Trial Hero — primary path for new orgs */}
        <div className="relative z-10 max-w-3xl mx-auto mb-12">
          <div className="border border-[#F2F1EA]/60 bg-white/5 rounded-[6px] p-8 text-center backdrop-blur-md">
            <p className="font-mono text-[#F2F1EA]/80 text-[10px] tracking-[0.22em] uppercase font-bold mb-4">
              Not ready to commit?
            </p>
            <h2 className="font-display font-bold tracking-tight text-3xl md:text-4xl text-[#F2F1EA] mb-3">
              Start your 30-day free trial.
            </h2>
            <p className="text-white/70 text-sm md:text-base max-w-xl mx-auto mb-6 leading-relaxed">
              Add a facility, build a product LCA and explore the platform. We ask for a card to keep
              things secure, but you won&apos;t be charged anything automatically. Choose a plan
              whenever you&apos;re ready.
            </p>
            <button
              onClick={handleStartTrial}
              disabled={processingCheckout}
              className="px-10 py-4 bg-[#F2F1EA] text-[#1A1B1D] font-mono uppercase text-xs tracking-[0.22em] font-bold rounded-full hover:bg-white transition-colors disabled:opacity-50"
            >
              {processingTier === 'trial' ? 'Starting trial...' : 'Start free trial'}
            </button>
            <p className="text-white/40 text-[11px] mt-4">
              30 days free. No automatic charge. Your card stays on file so choosing a plan later is one click.
            </p>
          </div>
          <div className="flex items-center gap-4 mt-10">
            <div className="flex-1 h-px bg-white/10" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
              Or choose a plan now
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setBillingInterval('monthly')}
            className={cn(
              "font-mono text-xs uppercase tracking-widest px-5 py-2.5 rounded-full transition-all",
              billingInterval === 'monthly'
                ? "bg-[#F2F1EA] text-[#1A1B1D] font-bold"
                : "border border-white/20 text-white/50 hover:text-white hover:border-white/40"
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval('annual')}
            className={cn(
              "font-mono text-xs uppercase tracking-widest px-5 py-2.5 rounded-full transition-all",
              billingInterval === 'annual'
                ? "bg-[#F2F1EA] text-[#1A1B1D] font-bold"
                : "border border-white/20 text-white/50 hover:text-white hover:border-white/40"
            )}
          >
            Annual
          </button>
        </div>

        {/* Founding partner note */}
        <div className="flex justify-center mb-8">
          <span className="font-mono font-bold text-[#F2F1EA]/80 text-xs tracking-[0.22em] uppercase">
            Founding partner pricing: limited availability
          </span>
        </div>

        {/* Plans Grid */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch mb-12">
          {tiers.map((tier, idx) => {
            const isProcessing = processingTier === tier.tierKey

            return (
              <div
                key={idx}
                className={cn(
                  "border p-8 flex flex-col transition-all duration-500 group relative rounded-[6px] backdrop-blur-md",
                  tier.highlight
                    ? "border-[#F2F1EA]/60 bg-white/10 md:-translate-y-4"
                    : "border-white/10 bg-white/5 hover:border-white/30"
                )}
              >
                {tier.highlight && (
                  <div className="absolute top-0 right-0 bg-[#F2F1EA] text-[#1A1B1D] text-[10px] font-mono font-bold uppercase px-3 py-1 tracking-[0.22em] rounded-tr-[6px] rounded-bl-[6px]">
                    Recommended
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <h4
                    className={cn(
                      "font-display font-bold tracking-tight text-3xl",
                      tier.highlight ? "text-[#F2F1EA]" : "text-white"
                    )}
                  >
                    {tier.name}
                  </h4>
                  <tier.icon className={tier.highlight ? "text-[#F2F1EA]" : "text-white/40"} />
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-white/40 text-lg line-through font-display">
                      £{billingInterval === 'monthly' ? tier.monthly.original : tier.annual.original.toLocaleString()}
                    </span>
                    <span
                      className={cn(
                        "font-display font-bold tracking-tight text-4xl tabular-nums",
                        tier.highlight ? "text-[#F2F1EA]" : "text-white"
                      )}
                    >
                      £{billingInterval === 'monthly' ? tier.monthly.founder : tier.annual.founder.toLocaleString()}
                    </span>
                    <span className="text-white/40 text-sm">/{billingInterval === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  <div className="mb-3">
                    <span className="font-mono text-[#F2F1EA]/80 text-[10px] tracking-[0.22em] uppercase font-bold">
                      Save £{billingInterval === 'monthly'
                        ? tier.monthly.saving
                        : tier.annual.saving.toLocaleString()}{billingInterval === 'monthly' ? '/mo' : '/yr'}
                    </span>
                  </div>
                  <p className="text-white/60 text-sm leading-relaxed">{tier.tagline}</p>
                </div>

                {/* Limits */}
                <div className="grid grid-cols-2 gap-2 mb-8 p-4 bg-white/5 rounded">
                  {tier.limits.map((limit, lIdx) => (
                    <div
                      key={lIdx}
                      className="font-mono text-[10px] uppercase tracking-wider text-white/50"
                    >
                      {limit}
                    </div>
                  ))}
                </div>

                <ul className="space-y-3 mb-12 flex-1">
                  {tier.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-3 text-sm group/item">
                      <div
                        className={cn(
                          "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 transition-colors",
                          tier.highlight
                            ? "bg-[#F2F1EA]"
                            : "bg-white/40 group-hover/item:bg-white"
                        )}
                      />
                      <span
                        className={cn(
                          "leading-relaxed transition-colors",
                          tier.highlight
                            ? "text-white"
                            : "text-white/60 group-hover/item:text-white",
                          feat.startsWith("Everything") &&
                            "font-display font-medium text-white/90 border-b border-white/10 pb-1 w-full"
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
                    "w-full py-5 font-mono uppercase text-xs tracking-[0.22em] font-bold transition-colors duration-200 text-center block rounded-full disabled:opacity-50",
                    tier.highlight
                      ? "bg-[#F2F1EA] text-[#1A1B1D] hover:bg-white"
                      : "border border-[#F2F1EA]/40 text-[#F2F1EA] hover:border-[#F2F1EA]"
                  )}
                >
                  {isProcessing ? "Processing..." : "Get Started"}
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer Note */}
        <div className="text-center text-sm text-white/40">
          <p>All plans include a 14-day money-back guarantee. Cancel anytime.</p>
          <p className="mt-2">
            Questions? <a href="/contact" className="text-[#F2F1EA] underline underline-offset-4 hover:text-white">Contact our team</a>
          </p>
        </div>

        {/* Photo Credit */}
        <div className="text-center mt-8 text-[10px] text-white/20">
          Photo by{' '}
          <a
            href="https://unsplash.com/@beyzaayurtkuran"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/40"
          >
            Beyza Yurtkuran
          </a>
          {' '}on{' '}
          <a
            href="https://unsplash.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/40"
          >
            Unsplash
          </a>
        </div>
      </div>
    </div>
  )
}

export default function CompleteSubscriptionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#1A1B1D]">
        <p className="font-mono text-sm uppercase tracking-[0.22em] text-[#F2F1EA]/70">Loading...</p>
      </div>
    }>
      <CompleteSubscriptionContent />
    </Suspense>
  )
}
