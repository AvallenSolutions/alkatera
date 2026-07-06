'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'
import { useAuth } from '@/hooks/useAuth'
import { PRODUCT_TYPE_OPTIONS } from '@/lib/industry-benchmarks'
import {
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
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Step = 'account' | 'organization' | 'payment'
type BillingInterval = 'monthly' | 'annual'

const CANOPY_FEATURES = [
  '100 Products & 100 LCA Calculations',
  '10 Team Members & 10 Facilities',
  '200 Suppliers & 200 Reports/mo',
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

const inputClass =
  'w-full px-4 py-3 bg-[#ECEAE3] border border-[#D9D6CB] rounded-[6px] text-[#1A1B1D] placeholder:text-[#6F6F68]/60 focus:outline-none focus:ring-2 focus:ring-[#1A1B1D]/20 focus:border-[#1A1B1D] transition-colors disabled:opacity-50'

const primaryButtonClass =
  'w-full py-4 bg-[#1A1B1D] text-[#F2F1EA] font-mono uppercase text-xs tracking-[0.22em] font-bold rounded-full hover:bg-black transition-colors duration-200 disabled:opacity-50'

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

      void fetch('/api/integrations/sender/sync-current-user', {
        method: 'POST',
        credentials: 'same-origin',
      }).catch((senderErr) => {
        console.warn('Sender sync request failed:', senderErr)
      })

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
      <div className="relative min-h-screen bg-[#ECEAE3] text-[#1A1B1D]">
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 text-center px-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#205E40]/10">
              <CheckCircle2 className="h-10 w-10 text-[#047857]" />
            </div>
            <h1 className="font-display font-bold text-3xl tracking-tight text-[#1A1B1D]">Welcome to Canopy.</h1>
            <p className="text-lg text-[#6F6F68] max-w-md">
              Setting up your Canopy subscription…
            </p>
            <p className="text-sm text-[#6F6F68]">This should only take a moment.</p>
            {showContinueButton && (
              <button
                onClick={async () => {
                  if (mutate) await mutate()
                  router.push('/dashboard')
                }}
                className="mt-4 px-8 py-3 bg-[#1A1B1D] text-[#F2F1EA] font-mono uppercase text-xs tracking-[0.22em] font-bold rounded-full hover:bg-black transition-colors"
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
    <div className="relative min-h-screen bg-[#ECEAE3] text-[#1A1B1D] flex flex-col items-center justify-center px-4 py-12">
      <div className="relative z-10 w-full max-w-lg space-y-6">
        {/* Wordmark */}
        <Link href="/" className="flex justify-center">
          <span className="font-display text-2xl tracking-tight text-[#1A1B1D]">
            alka<strong className="font-bold">tera</strong>
          </span>
        </Link>

        {/* Canopy eyebrow */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2">
            <TreeDeciduous className="h-4 w-4 text-[#205E40]" />
            <span className="font-mono font-bold text-[#205E40] text-[10px] tracking-[0.22em] uppercase">
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
                  <div className={cn('w-8 h-px', isCompleted ? 'bg-[#205E40]' : 'bg-[#D9D6CB]')} />
                )}
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors',
                      isCompleted
                        ? 'bg-[#205E40] text-[#F2F1EA]'
                        : isCurrent
                          ? 'border-2 border-[#205E40] text-[#205E40]'
                          : 'border border-[#D9D6CB] text-[#6F6F68]'
                    )}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-mono uppercase tracking-[0.15em] hidden sm:inline',
                      isCurrent ? 'text-[#205E40] font-bold' : isCompleted ? 'text-[#1A1B1D]' : 'text-[#6F6F68]'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Main card: cream, hairline, radius 6 */}
        <div className="bg-[#F2F1EA] border border-[#D9D6CB] rounded-[6px] p-8 space-y-6">
          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-[#ECEAE3] border border-[#D9D6CB] rounded-[6px]">
              <AlertCircle className="h-5 w-5 text-[#BE123C] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#BE123C]">{error}</p>
            </div>
          )}

          {/* === STEP 1: Account === */}
          {currentStep === 'account' && (
            <>
              <div className="text-center space-y-2">
                <h2 className="font-display font-bold text-xl tracking-tight text-[#1A1B1D]">Create your account.</h2>
                <p className="text-[#6F6F68] text-sm">Step 1 of 3: set up your login credentials</p>
              </div>

              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="fullName" className="block text-sm font-medium text-[#1A1B1D]">Full Name</label>
                  <input
                    id="fullName"
                    type="text"
                    placeholder="John Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isLoading}
                    required
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-[#1A1B1D]">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium text-[#1A1B1D]">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      className={cn(inputClass, 'pr-12')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6F6F68] hover:text-[#1A1B1D] transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-[#6F6F68]">Min 8 chars with uppercase, lowercase, and number</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#1A1B1D]">Confirm Password</label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      className={cn(inputClass, 'pr-12')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6F6F68] hover:text-[#1A1B1D] transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={primaryButtonClass}
                >
                  {isLoading ? 'Creating account…' : 'Continue'}
                </button>
              </form>

              <div className="text-center text-sm text-[#6F6F68]">
                Already have an account?{' '}
                <Link href="/login" className="text-[#205E40] hover:underline">Sign in</Link>
              </div>
            </>
          )}

          {/* === STEP 2: Organisation === */}
          {currentStep === 'organization' && (
            <>
              <div className="text-center space-y-2">
                <div className="mx-auto w-14 h-14 bg-[#205E40]/10 rounded-[6px] flex items-center justify-center mb-2">
                  <Building2 className="w-7 h-7 text-[#205E40]" />
                </div>
                <h2 className="font-display font-bold text-xl tracking-tight text-[#1A1B1D]">Set up your organisation.</h2>
                <p className="text-[#6F6F68] text-sm">Step 2 of 3: tell us about your company</p>
              </div>

              <form onSubmit={handleCreateOrganization} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="orgName" className="block text-sm font-medium text-[#1A1B1D]">Company Name</label>
                  <input
                    id="orgName"
                    type="text"
                    placeholder="Acme Distillery Ltd"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    disabled={isLoading}
                    required
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="productType" className="block text-sm font-medium text-[#1A1B1D]">
                    What type of products do you primarily produce?
                  </label>
                  <select
                    id="productType"
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    disabled={isLoading}
                    className={cn(inputClass, 'appearance-none')}
                  >
                    <option value="">Select product type</option>
                    {PRODUCT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[#6F6F68]">
                    This determines the industry benchmarks for your sustainability score. You can change this later.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={primaryButtonClass}
                >
                  {isLoading ? 'Creating organisation…' : 'Continue'}
                </button>
              </form>
            </>
          )}

          {/* === STEP 3: Payment === */}
          {currentStep === 'payment' && (
            <>
              <div className="text-center space-y-2">
                <h2 className="font-display font-bold text-xl tracking-tight text-[#1A1B1D]">Complete your subscription.</h2>
                <p className="text-[#6F6F68] text-sm">Step 3 of 3: start your Canopy plan</p>
              </div>

              {/* Canopy summary: the one saturated block */}
              <div className="bg-[#205E40] text-[#F2F1EA] rounded-[6px] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TreeDeciduous className="h-5 w-5 text-[#F2F1EA]/80" />
                    <span className="font-display font-bold text-lg tracking-tight">Canopy</span>
                  </div>
                  <span className="font-mono text-[#F2F1EA]/80 text-[10px] tracking-[0.2em] uppercase font-bold">
                    Founding Partner
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {CANOPY_FEATURES.map((feat, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full bg-[#F2F1EA]/70 mt-1.5 shrink-0" />
                      <span className="text-xs text-[#F2F1EA]/90 leading-relaxed">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Billing toggle */}
              <div className="space-y-3">
                <p className="text-sm text-[#6F6F68] text-center">Choose your billing cycle</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setBillingInterval('monthly')}
                    className={cn(
                      'font-mono text-xs uppercase tracking-[0.22em] px-5 py-2.5 rounded-full transition-colors',
                      billingInterval === 'monthly'
                        ? 'bg-[#1A1B1D] text-[#F2F1EA] font-bold'
                        : 'border border-[#D9D6CB] text-[#6F6F68] hover:text-[#1A1B1D] hover:border-[#1A1B1D]'
                    )}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingInterval('annual')}
                    className={cn(
                      'font-mono text-xs uppercase tracking-[0.22em] px-5 py-2.5 rounded-full transition-colors',
                      billingInterval === 'annual'
                        ? 'bg-[#1A1B1D] text-[#F2F1EA] font-bold'
                        : 'border border-[#D9D6CB] text-[#6F6F68] hover:text-[#1A1B1D] hover:border-[#1A1B1D]'
                    )}
                  >
                    Annual
                  </button>
                </div>
              </div>

              {/* Price */}
              <div className="text-center space-y-1">
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-[#6F6F68] text-lg line-through font-display">
                    £{billingInterval === 'monthly' ? '899' : '8,990'}
                  </span>
                  <span className="font-display font-bold text-4xl tabular-nums text-[#1A1B1D]">
                    £{billingInterval === 'monthly' ? '599' : '5,990'}
                  </span>
                  <span className="text-[#6F6F68] text-sm">/{billingInterval === 'monthly' ? 'mo' : 'yr'}</span>
                </div>
                {billingInterval === 'annual' && (
                  <p className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-[#047857]">Save £1,198/yr, that&apos;s 2 months free</p>
                )}
              </div>

              {/* Subscribe button */}
              <button
                onClick={handleStartCheckout}
                disabled={isLoading}
                className="w-full py-5 bg-[#1A1B1D] text-[#F2F1EA] font-mono uppercase text-xs tracking-[0.22em] font-bold rounded-full hover:bg-black transition-colors duration-200 disabled:opacity-50"
              >
                {isLoading
                  ? 'Redirecting to checkout…'
                  : `Subscribe £${billingInterval === 'monthly' ? '599/mo' : '5,990/yr'}`}
              </button>

              <p className="text-center text-xs text-[#6F6F68]">
                14-day money-back guarantee. Cancel anytime.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-[#6F6F68]">
          Questions?{' '}
          <a href="/contact" className="text-[#205E40] hover:underline">Contact our team</a>
        </div>
      </div>
    </div>
  )
}

export default function CanopyOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#ECEAE3]">
          <p className="text-sm text-[#6F6F68]">Loading…</p>
        </div>
      }
    >
      <CanopyOnboardingContent />
    </Suspense>
  )
}
