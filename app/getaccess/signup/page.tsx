'use client'

import { useSearchParams } from 'next/navigation'
import { SignupForm } from '@/components/auth/SignupForm'
import { Suspense } from 'react'
import Link from 'next/link'

function SignupContent() {
  const searchParams = useSearchParams()
  const tier = searchParams.get('tier')

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <Link href="/" className="inline-block">
            <h1 className="font-serif text-3xl tracking-tight">AlkaTera</h1>
          </Link>

          {tier && (
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-[#ccff00]/30 bg-[#ccff00]/5 rounded-full">
              <span className="font-mono text-[#ccff00] text-xs tracking-widest uppercase">
                {tier} Plan Selected
              </span>
            </div>
          )}

          <div>
            <h2 className="text-xl font-semibold text-white">
              {tier ? `Create your account to start ${tier}` : 'Create your account'}
            </h2>
            <p className="text-white/50 text-sm mt-1">
              {tier
                ? "Sign up, then you'll set up your organisation and complete your subscription."
                : 'Sign up to get started with AlkaTera.'}
            </p>
          </div>
        </div>

        {/* Signup Form — defaults to /create-organization */}
        <SignupForm />

        {/* Existing user link */}
        <div className="text-center text-sm text-white/40">
          Already have an account?{' '}
          <Link href="/login" className="text-[#ccff00] hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function GetAccessSignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-white/50">Loading...</div>
      </div>
    }>
      <SignupContent />
    </Suspense>
  )
}
