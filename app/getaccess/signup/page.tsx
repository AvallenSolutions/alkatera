'use client'

import { useSearchParams } from 'next/navigation'
import { SignupForm } from '@/components/auth/SignupForm'
import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'

function SignupContent() {
  const searchParams = useSearchParams()
  const tier = searchParams.get('tier')

  return (
    <div className="relative min-h-screen text-white flex flex-col items-center justify-center px-4 py-12">
      {/* Background Image */}
      <Image
        src="/images/starry-night-bg2.jpg"
        alt="Starry night sky"
        fill
        className="object-cover"
        priority
        quality={85}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Logo */}
        <Link href="/" className="flex justify-center">
          <img
            src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png"
            alt="alkatera"
            className="h-10 md:h-14 w-auto object-contain mix-blend-screen brightness-125 contrast-150"
            style={{ mixBlendMode: 'screen' }}
          />
        </Link>

        {/* Glassmorphism Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            {tier && (
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-[#ccff00]/30 bg-[#ccff00]/5 rounded-full">
                  <span className="font-mono text-[#ccff00] text-xs tracking-widest uppercase">
                    {tier} Plan Selected
                  </span>
                </div>
              </div>
            )}

            <div>
              <h2 className="font-serif text-xl text-white">
                {tier ? `Create your account to start ${tier}` : 'Create your account'}
              </h2>
              <p className="text-white/50 text-sm mt-1">
                {tier
                  ? "Sign up, then you'll set up your organisation and complete your subscription."
                  : 'Sign up to get started with alkatera.'}
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

      {/* Photo credit */}
      <div className="relative z-10 mt-8 text-center text-[10px] text-white/20">
        Photo by{' '}
        <a
          href="https://unsplash.com/@ventiviews"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white/40"
        >
          Venti Views
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
  )
}

export default function GetAccessSignupPage() {
  return (
    <Suspense fallback={
      <div className="relative min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-white/50">Loading...</div>
      </div>
    }>
      <SignupContent />
    </Suspense>
  )
}
