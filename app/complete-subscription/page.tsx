'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Leaf, Flower2, TreeDeciduous, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import Image from 'next/image'

type BillingInterval = 'monthly' | 'annual'

// --- Seed Icon (matches /getaccess) ---
const SeedIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 10a6 6 0 0 0-6 6c0 3.3 2.7 6 6 6s6-2.7 6-6a6 6 0 0 0-6-6z" />
    <path d="M12 2v8" />
    <path d="M8 6c2-2 6-2 8 0" />
  </svg>
)

const tiers = [
  {
    name: "Seed",
    tierKey: "seed",
    monthly: { original: 199, founder: 99, saving: 100 },
    annual: { original: 1990, founder: 990, saving: 1000 },
    tagline: "For boutique brands establishing their sustainability foundations.",
    icon: SeedIcon,
    limits: ["5 Products", "5 LCA Calculations", "1 Team Member", "1 Facility", "5 Suppliers", "10 Reports/mo"],
    features: [
      "Dashboard & Vitality Score",
      "Carbon Footprint (GHG) per product",
      "Product Passport",
      "Company Emissions (Current Year)",
      "Rosa AI Assistant (25/mo)",
      "Greenwash Guardian (Website only)",
      "Knowledge Bank (Read)",
    ],
    buttonText: "Get Started",
    highlight: false,
  },
  {
    name: "Blossom",
    tierKey: "blossom",
    monthly: { original: 399, founder: 249, saving: 150 },
    annual: { original: 3990, founder: 2490, saving: 1500 },
    tagline: "For scaling brands ready to turn impact into a strategic advantage.",
    icon: Flower2,
    limits: ["20 Products", "20 LCA Calculations", "5 Team Members", "3 Facilities", "25 Suppliers", "50 Reports/mo"],
    features: [
      "Everything in Seed, plus:",
      "Water, Circularity, Land Use & Resource impacts",
      "Full Scope 3 Categories",
      "Vehicle Registry & Supply Chain Mapping",
      "People & Culture, Community Impact modules",
      "B Corp & CDP tracking",
      "Rosa AI (100/mo) & Greenwash Guardian (5 docs/mo)",
      "Knowledge Bank (Upload & Manage)",
    ],
    buttonText: "Get Started",
    highlight: true,
  },
  {
    name: "Canopy",
    tierKey: "canopy",
    monthly: { original: 899, founder: 599, saving: 300 },
    annual: { original: 8990, founder: 5990, saving: 3000 },
    tagline: "Comprehensive ecosystem management for established organisations.",
    icon: TreeDeciduous,
    limits: ["50 Products", "50 LCA Calculations", "10 Team Members", "8 Facilities", "100 Suppliers", "200 Reports/mo"],
    features: [
      "Everything in Blossom, plus:",
      "Year-over-Year Comparisons",
      "Advanced Data Quality Scoring & EF 3.1",
      "All ESG modules including Governance & Ethics",
      "All certifications: CSRD, GRI, ISO, SBTi",
      "Gap Analysis, Audit Packages & Verification Support",
      "Unlimited Rosa AI & Greenwash Guardian",
    ],
    buttonText: "Get Started",
    highlight: false,
  },
]

function CompleteSubscriptionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentOrganization, isLoading: isOrgLoading, mutate } = useOrganization()
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly')
  const [processingCheckout, setProcessingCheckout] = useState(false)
  const [processingTier, setProcessingTier] = useState<string | null>(null)
  const [hasShownToast, setHasShownToast] = useState(false)

  const isPaymentSuccess = searchParams.get('success') === 'true'
  const isCanceled = searchParams.get('canceled') === 'true'
  const tierParam = searchParams.get('tier')

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
        toast.success('Subscription activated successfully!', {
          description: `Welcome to the ${tierParam || ''} plan.`,
        })
        router.push('/dashboard')
        return
      }

      if (pollCount >= maxPolls) {
        clearInterval(pollInterval)
        // Refresh org context before redirecting
        if (mutate) await mutate()
        toast.success('Payment received!', {
          description: 'Your subscription is being set up. You can access your dashboard shortly.',
        })
        router.push('/dashboard')
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
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-neon-lime/20">
              <CheckCircle2 className="h-10 w-10 text-neon-lime" />
            </div>
            <h1 className="text-3xl font-bold text-white">Payment Successful!</h1>
            <p className="text-lg text-slate-300 max-w-md">
              Setting up your {tierParam ? tierParam.charAt(0).toUpperCase() + tierParam.slice(1) : ''} subscription...
            </p>
            <Loader2 className="h-8 w-8 animate-spin text-neon-lime" />
            <p className="text-sm text-slate-500">This should only take a moment.</p>
            {showContinueButton && (
              <button
                onClick={async () => {
                  if (mutate) await mutate()
                  router.push('/dashboard')
                }}
                className="mt-4 px-8 py-3 bg-[#ccff00] text-black font-mono uppercase text-xs tracking-widest font-bold rounded-xl hover:opacity-90 transition-all"
              >
                Continue to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (isOrgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-neon-lime" />
          <p className="text-sm text-slate-400 font-data">Loading...</p>
        </div>
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
          <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl text-white mb-4">
            Welcome to alka<span className="font-bold">tera</span>!
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Your organisation <strong className="text-white">{currentOrganization?.name}</strong> has been created.
            Choose a plan below to start your sustainability journey.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setBillingInterval('monthly')}
            className={cn(
              "font-mono text-xs uppercase tracking-widest px-5 py-2.5 rounded-full transition-all",
              billingInterval === 'monthly'
                ? "bg-[#ccff00] text-black font-bold"
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
                ? "bg-[#ccff00] text-black font-bold"
                : "border border-white/20 text-white/50 hover:text-white hover:border-white/40"
            )}
          >
            Annual
          </button>
        </div>

        {/* Founding Partner Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-5 py-2 border border-[#ccff00]/30 bg-[#ccff00]/5 rounded-full">
            <span className="font-mono text-[#ccff00] text-xs tracking-widest uppercase">
              Founding Partner Pricing — Limited Availability
            </span>
          </div>
        </div>

        {/* Radial glow */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#ccff00]/5 via-transparent to-transparent pointer-events-none" />

        {/* Plans Grid */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch mb-12">
          {tiers.map((tier, idx) => {
            const isProcessing = processingTier === tier.tierKey

            return (
              <div
                key={idx}
                className={cn(
                  "border p-8 flex flex-col transition-all duration-500 group relative rounded-2xl backdrop-blur-md",
                  tier.highlight
                    ? "border-[#ccff00] bg-[#ccff00]/5 md:-translate-y-4 shadow-[0_20px_50px_rgba(204,255,0,0.1)]"
                    : "border-white/10 bg-white/5 hover:border-white/30"
                )}
              >
                {tier.highlight && (
                  <div className="absolute top-0 right-0 bg-[#ccff00] text-black text-[10px] font-bold uppercase px-3 py-1 tracking-widest rounded-tr-2xl rounded-bl-xl">
                    Recommended
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <h4
                    className={cn(
                      "font-serif text-3xl",
                      tier.highlight ? "text-[#ccff00]" : "text-white"
                    )}
                  >
                    {tier.name}
                  </h4>
                  <tier.icon className={tier.highlight ? "text-[#ccff00]" : "text-gray-500"} />
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-white/40 text-lg line-through font-serif">
                      £{billingInterval === 'monthly' ? tier.monthly.original : tier.annual.original.toLocaleString()}
                    </span>
                    <span
                      className={cn(
                        "font-serif text-4xl",
                        tier.highlight ? "text-[#ccff00]" : "text-white"
                      )}
                    >
                      £{billingInterval === 'monthly' ? tier.monthly.founder : tier.annual.founder.toLocaleString()}
                    </span>
                    <span className="text-white/40 text-sm">/{billingInterval === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#ccff00]/10 rounded-full mb-3">
                    <span className="font-mono text-[#ccff00] text-[10px] tracking-wider uppercase font-bold">
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
                            ? "bg-[#ccff00]"
                            : "bg-gray-500 group-hover/item:bg-white"
                        )}
                      />
                      <span
                        className={cn(
                          "leading-relaxed transition-colors",
                          tier.highlight
                            ? "text-white"
                            : "text-gray-400 group-hover/item:text-white",
                          feat.startsWith("Everything") &&
                            "font-serif italic text-white/90 border-b border-white/10 pb-1 w-full"
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
                    "w-full py-5 font-mono uppercase text-xs tracking-widest font-bold transition-all duration-300 text-center block rounded-xl",
                    tier.highlight
                      ? "bg-[#ccff00] text-black hover:opacity-90 hover:scale-[1.02]"
                      : "border border-white/20 hover:bg-white hover:text-black text-white"
                  )}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    tier.buttonText
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer Note */}
        <div className="text-center text-sm text-white/40">
          <p>All plans include a 14-day money-back guarantee. Cancel anytime.</p>
          <p className="mt-2">
            Questions? <a href="/contact" className="text-[#ccff00] hover:underline">Contact our team</a>
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
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-neon-lime" />
          <p className="text-sm text-slate-400 font-data">Loading...</p>
        </div>
      </div>
    }>
      <CompleteSubscriptionContent />
    </Suspense>
  )
}
