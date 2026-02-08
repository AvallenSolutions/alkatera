'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'
import { useAuth } from '@/hooks/useAuth'
import { PRODUCT_TYPE_OPTIONS } from '@/lib/industry-benchmarks'
import {
  Loader2,
  CheckCircle2,
  TreeDeciduous,
  Building2,
  User,
  CreditCard,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Step = 'account' | 'organization' | 'payment'
type BillingInterval = 'monthly' | 'annual'

const CANOPY_FEATURES = [
  '50 Products & 50 LCA Calculations',
  '10 Team Members & 8 Facilities',
  '100 Suppliers & 200 Reports/mo',
  'Full Scope 1, 2 & 3 Emissions',
  'All ESG modules incl. Governance & Ethics',
  'CSRD, GRI, ISO & SBTi Certifications',
  'Unlimited Rosa AI & Greenwash Guardian',
  'Gap Analysis, Audit Packages & Verification',
]

const STEPS: { key: Step; label: string; icon: typeof User }[] = [
  { key: 'account', label: 'Account', icon: User },
  { key: 'organization', label: 'Organisation', icon: Building2 },
  { key: 'payment', label: 'Payment', icon: CreditCard },
]

function CanopyOnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentOrganization, mutate } = useOrganization()
  const { user } = useAuth()

  // Step management
  const [currentStep, setCurrentStep] = useState<Step>('account')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Account fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Org fields
  const [orgName, setOrgName] = useState('')
  const [productType, setProductType] = useState('')

  // Payment
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly')

  // Post-payment
  const isPaymentSuccess = searchParams.get('success') === 'true'
  const [showContinueButton, setShowContinueButton] = useState(false)

  // Smart entry: skip steps if already completed
  useEffect(() => {
    if (user && currentOrganization) {
      if (
        currentOrganization.subscription_status === 'active' ||
        currentOrganization.subscription_status === 'trial'
      ) {
        router.push('/dashboard')
        return
      }
      setCurrentStep('payment')
    } else if (user) {
      setCurrentStep('organization')
    }
  }, [user, currentOrganization, router])

  // Poll for subscription activation after payment
  useEffect(() => {
    if (!isPaymentSuccess || !currentOrganization?.id) return

    const orgId = currentOrganization.id
    let pollCount = 0
    const maxPolls = 30

    const pollInterval = setInterval(async () => {
      pollCount++
      const { data } = await supabase
        .from('organizations')
        .select('subscription_status')
        .eq('id', orgId)
        .single()

      const status = data?.subscription_status
      if (status === 'active' || status === 'trial') {
        clearInterval(pollInterval)
        if (mutate) await mutate()
        toast.success('Welcome to Canopy!', {
          description: 'Your subscription is now active.',
        })
        router.push('/dashboard')
        return
      }

      if (pollCount >= maxPolls) {
        clearInterval(pollInterval)
        if (mutate) await mutate()
        toast.success('Payment received!', {
          description: 'Your subscription is being set up. Redirecting...',
        })
        router.push('/dashboard')
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaymentSuccess, currentOrganization?.id])

  // Show continue button after 10s on success screen
  useEffect(() => {
    if (!isPaymentSuccess) return
    const timer = setTimeout(() => setShowContinueButton(true), 10000)
    return () => clearTimeout(timer)
  }, [isPaymentSuccess])

  // --- Validation ---
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 8) return 'Password must be at least 8 characters'
    if (!/[A-Z]/.test(pw)) return 'Must contain an uppercase letter'
    if (!/[a-z]/.test(pw)) return 'Must contain a lowercase letter'
    if (!/[0-9]/.test(pw)) return 'Must contain a number'
    return null
  }

  // --- Step handlers ---
  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!fullName || !email || !password || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address')
      return
    }
    const pwError = validatePassword(password)
    if (pwError) {
      setError(pwError)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })

      if (signUpError) throw signUpError
      if (!data.user) throw new Error('No user returned from sign-up')

      toast.success('Account created!')
      setCurrentStep('organization')
    } catch (err: any) {
      setError(err.message || 'Failed to create account')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateOrganization(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!orgName.trim()) {
      setError('Please enter a company name')
      return
    }

    setIsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-organization`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ name: orgName, product_type: productType || null }),
        }
      )

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to create organisation')

      await mutate({
        organization: result.organization,
        role: result.role,
        user: session.user,
      })

      toast.success('Organisation created!')
      setCurrentStep('payment')
    } catch (err: any) {
      setError(err.message || 'Failed to create organisation')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleStartCheckout() {
    setError(null)

    if (!currentOrganization?.id) {
      setError('No organisation found. Please refresh and try again.')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierName: 'canopy',
          billingInterval,
          organizationId: currentOrganization.id,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create checkout session')
      if (!data.url) throw new Error('No checkout URL returned')

      window.location.href = data.url
    } catch (err: any) {
      setError(err.message || 'Failed to start checkout')
      setIsLoading(false)
    }
  }

  // --- Payment success screen ---
  if (isPaymentSuccess) {
    return (
      <div className="relative min-h-screen">
        <Image src="/images/starry-night-bg.jpg" alt="" fill className="object-cover" priority quality={85} />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 text-center px-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#ccff00]/20">
              <CheckCircle2 className="h-10 w-10 text-[#ccff00]" />
            </div>
            <h1 className="text-3xl font-bold text-white">Welcome to Canopy!</h1>
            <p className="text-lg text-slate-300 max-w-md">
              Setting up your Canopy subscription...
            </p>
            <Loader2 className="h-8 w-8 animate-spin text-[#ccff00]" />
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

  // --- Step indicator ---
  const stepIndex = STEPS.findIndex(s => s.key === currentStep)

  return (
    <div className="relative min-h-screen text-white flex flex-col items-center justify-center px-4 py-12">
      <Image src="/images/starry-night-bg2.jpg" alt="" fill className="object-cover" priority quality={85} />
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 w-full max-w-lg space-y-6">
        {/* Logo */}
        <Link href="/" className="flex justify-center">
          <img
            src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png"
            alt="alkatera"
            className="h-10 md:h-14 w-auto object-contain mix-blend-screen brightness-125 contrast-150"
            style={{ mixBlendMode: 'screen' }}
          />
        </Link>

        {/* Canopy badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-5 py-2 border border-[#ccff00]/30 bg-[#ccff00]/5 rounded-full">
            <TreeDeciduous className="h-4 w-4 text-[#ccff00]" />
            <span className="font-mono text-[#ccff00] text-xs tracking-widest uppercase">
              Canopy Plan
            </span>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < stepIndex
            const isCurrent = idx === stepIndex
            const StepIcon = step.icon

            return (
              <div key={step.key} className="flex items-center gap-2">
                {idx > 0 && (
                  <div className={cn('w-8 h-px', isCompleted ? 'bg-[#ccff00]' : 'bg-white/20')} />
                )}
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all',
                      isCompleted
                        ? 'bg-[#ccff00] text-black'
                        : isCurrent
                          ? 'border-2 border-[#ccff00] text-[#ccff00]'
                          : 'border border-white/20 text-white/30'
                    )}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-mono uppercase tracking-wider hidden sm:inline',
                      isCurrent ? 'text-[#ccff00]' : isCompleted ? 'text-white/60' : 'text-white/30'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Main card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 space-y-6">
          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* === STEP 1: Account === */}
          {currentStep === 'account' && (
            <>
              <div className="text-center space-y-2">
                <h2 className="font-serif text-xl text-white">Create Your Account</h2>
                <p className="text-white/50 text-sm">Step 1 of 3 — Set up your login credentials</p>
              </div>

              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="fullName" className="block text-sm font-medium text-white/60">Full Name</label>
                  <input
                    id="fullName"
                    type="text"
                    placeholder="John Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isLoading}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#ccff00]/50 focus:border-[#ccff00]/30 transition-all disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-white/60">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#ccff00]/50 focus:border-[#ccff00]/30 transition-all disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium text-white/60">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#ccff00]/50 focus:border-[#ccff00]/30 transition-all disabled:opacity-50 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-white/30">Min 8 chars with uppercase, lowercase, and number</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-white/60">Confirm Password</label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#ccff00]/50 focus:border-[#ccff00]/30 transition-all disabled:opacity-50 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-[#ccff00] text-black font-mono uppercase text-xs tracking-widest font-bold rounded-xl hover:opacity-90 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    'Continue'
                  )}
                </button>
              </form>

              <div className="text-center text-sm text-white/40">
                Already have an account?{' '}
                <Link href="/login" className="text-[#ccff00] hover:underline">Sign in</Link>
              </div>
            </>
          )}

          {/* === STEP 2: Organisation === */}
          {currentStep === 'organization' && (
            <>
              <div className="text-center space-y-2">
                <div className="mx-auto w-14 h-14 bg-[#ccff00]/15 rounded-2xl flex items-center justify-center mb-2">
                  <Building2 className="w-7 h-7 text-[#ccff00]" />
                </div>
                <h2 className="font-serif text-xl text-white">Set Up Your Organisation</h2>
                <p className="text-white/50 text-sm">Step 2 of 3 — Tell us about your company</p>
              </div>

              <form onSubmit={handleCreateOrganization} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="orgName" className="block text-sm font-medium text-white/60">Company Name</label>
                  <input
                    id="orgName"
                    type="text"
                    placeholder="Acme Distillery Ltd"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    disabled={isLoading}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#ccff00]/50 focus:border-[#ccff00]/30 transition-all disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="productType" className="block text-sm font-medium text-white/60">
                    What type of products do you primarily produce?
                  </label>
                  <select
                    id="productType"
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#ccff00]/50 focus:border-[#ccff00]/30 transition-all disabled:opacity-50 appearance-none"
                  >
                    <option value="" className="bg-slate-900">Select product type</option>
                    {PRODUCT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-slate-900">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-white/30">
                    This determines the industry benchmarks for your sustainability score. You can change this later.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-[#ccff00] text-black font-mono uppercase text-xs tracking-widest font-bold rounded-xl hover:opacity-90 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating organisation...
                    </span>
                  ) : (
                    'Continue'
                  )}
                </button>
              </form>
            </>
          )}

          {/* === STEP 3: Payment === */}
          {currentStep === 'payment' && (
            <>
              <div className="text-center space-y-2">
                <h2 className="font-serif text-xl text-white">Complete Your Subscription</h2>
                <p className="text-white/50 text-sm">Step 3 of 3 — Start your Canopy plan</p>
              </div>

              {/* Canopy summary */}
              <div className="border border-[#ccff00]/20 bg-[#ccff00]/5 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TreeDeciduous className="h-5 w-5 text-[#ccff00]" />
                    <span className="font-serif text-lg text-white">Canopy</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#ccff00]/10 rounded-full">
                    <span className="font-mono text-[#ccff00] text-[10px] tracking-wider uppercase font-bold">
                      Founding Partner
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {CANOPY_FEATURES.map((feat, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full bg-[#ccff00] mt-1.5 shrink-0" />
                      <span className="text-xs text-white/60 leading-relaxed">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Billing toggle */}
              <div className="space-y-3">
                <p className="text-sm text-white/60 text-center">Choose your billing cycle</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setBillingInterval('monthly')}
                    className={cn(
                      'font-mono text-xs uppercase tracking-widest px-5 py-2.5 rounded-full transition-all',
                      billingInterval === 'monthly'
                        ? 'bg-[#ccff00] text-black font-bold'
                        : 'border border-white/20 text-white/50 hover:text-white hover:border-white/40'
                    )}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingInterval('annual')}
                    className={cn(
                      'font-mono text-xs uppercase tracking-widest px-5 py-2.5 rounded-full transition-all',
                      billingInterval === 'annual'
                        ? 'bg-[#ccff00] text-black font-bold'
                        : 'border border-white/20 text-white/50 hover:text-white hover:border-white/40'
                    )}
                  >
                    Annual
                  </button>
                </div>
              </div>

              {/* Price */}
              <div className="text-center space-y-1">
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-white/40 text-lg line-through font-serif">
                    £{billingInterval === 'monthly' ? '899' : '8,990'}
                  </span>
                  <span className="font-serif text-4xl text-[#ccff00]">
                    £{billingInterval === 'monthly' ? '599' : '5,990'}
                  </span>
                  <span className="text-white/40 text-sm">/{billingInterval === 'monthly' ? 'mo' : 'yr'}</span>
                </div>
                {billingInterval === 'annual' && (
                  <p className="text-xs text-[#ccff00]/70">Save £1,198/yr — that&apos;s 2 months free</p>
                )}
              </div>

              {/* Subscribe button */}
              <button
                onClick={handleStartCheckout}
                disabled={isLoading}
                className="w-full py-5 bg-[#ccff00] text-black font-mono uppercase text-xs tracking-widest font-bold rounded-xl hover:opacity-90 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting to checkout...
                  </span>
                ) : (
                  `Subscribe — £${billingInterval === 'monthly' ? '599/mo' : '5,990/yr'}`
                )}
              </button>

              <p className="text-center text-xs text-white/30">
                14-day money-back guarantee. Cancel anytime.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-white/30">
          Questions?{' '}
          <a href="/contact" className="text-[#ccff00] hover:underline">Contact our team</a>
        </div>
      </div>
    </div>
  )
}

export default function CanopyOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-[#ccff00]" />
            <p className="text-sm text-slate-400">Loading...</p>
          </div>
        </div>
      }
    >
      <CanopyOnboardingContent />
    </Suspense>
  )
}
