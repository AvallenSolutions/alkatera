'use client'

import { useSearchParams } from 'next/navigation'
import { SignupForm } from '@/components/auth/SignupForm'
import { Suspense } from 'react'
import Link from 'next/link'

function SignupContent() {
  const searchParams = useSearchParams()
  const tier = searchParams.get('tier')
  const isTrial = searchParams.get('trial') === 'true'

  return (
    <div className="relative min-h-screen bg-[#ECEAE3] text-[#1A1B1D] flex flex-col items-center justify-center px-4 py-12">
      {/* Content */}
      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Wordmark */}
        <Link href="/" className="flex justify-center">
          <span className="font-display text-2xl tracking-tight text-[#1A1B1D]">
            alka<strong className="font-bold">tera</strong>
          </span>
        </Link>

        {/* Panel: cream, hairline, radius 6 */}
        <div className="bg-[#F2F1EA] border border-[#D9D6CB] rounded-[6px] p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            {(tier || isTrial) && (
              <div className="flex justify-center">
                <span className="font-mono font-bold text-[#205E40] text-[10px] tracking-[0.22em] uppercase">
                  {isTrial ? '30-day free trial' : `${tier} plan selected`}
                </span>
              </div>
            )}

            <div>
              <h2 className="font-display font-bold text-xl tracking-tight text-[#1A1B1D]">
                {isTrial
                  ? 'Create your account to start your free trial.'
                  : tier
                  ? `Create your account to start ${tier}.`
                  : 'Create your account.'}
              </h2>
              <p className="text-[#6F6F68] text-sm mt-1">
                {isTrial
                  ? "Sign up, set up your organisation, then start exploring. No charge for 30 days."
                  : tier
                  ? "Sign up, then you'll set up your organisation and complete your subscription."
                  : 'Sign up to get started with alkatera.'}
              </p>
            </div>
          </div>

          {/* Signup Form — defaults to /create-organization */}
          <SignupForm />

          {/* Existing user link */}
          <div className="text-center text-sm text-[#6F6F68]">
            Already have an account?{' '}
            <Link href="/login" className="text-[#205E40] hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GetAccessSignupPage() {
  return (
    <Suspense fallback={
      <div className="relative min-h-screen bg-[#ECEAE3] flex items-center justify-center">
        <div className="text-[#6F6F68]">Loading…</div>
      </div>
    }>
      <SignupContent />
    </Suspense>
  )
}
