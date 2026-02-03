"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { LoginForm } from "./LoginForm"
import { SignupForm } from "./SignupForm"

interface AuthFormProps {
  tier?: string | null
}

export function AuthForm({ tier }: AuthFormProps) {
  const [mode, setMode] = useState<"login" | "signup">(tier ? "signup" : "login")

  return (
    <div data-auth-page className="relative min-h-screen text-white">
      {/* Full-page background */}
      <Image
        src="/images/vineyard-autumn.jpg"
        alt="Autumn vineyard"
        fill
        className="object-cover"
        priority
        quality={85}
      />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <img
              src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png"
              alt="AlkaTera"
              className="h-12 md:h-14 w-auto object-contain"
            />
          </div>

          {/* Hero headline - matching /getaccess styling */}
          {tier && (
            <div className="flex justify-center mb-4">
              <div className="inline-block px-4 py-1.5 border border-[#ccff00]/30 bg-[#ccff00]/5 rounded-full">
                <span className="font-mono text-[#ccff00] text-[10px] tracking-widest uppercase">
                  {tier} Plan Selected
                </span>
              </div>
            </div>
          )}
          <h1 className="font-serif text-4xl md:text-5xl text-white text-center mb-4">
            {mode === "login"
              ? tier ? `Sign in to activate ${tier}.` : "Welcome back."
              : tier ? `Sign up to start ${tier}.` : "Create an account."}
          </h1>
          <p className="text-white/50 text-center mb-8">
            {mode === "login"
              ? tier ? "Sign in and you'll be taken to complete your subscription." : "Enter your credentials to access the platform."
              : tier ? "Create your account, then complete your subscription." : "Sign up to get started with AlkaTera."}
          </p>

          {/* Glassmorphism Card - matching /getaccess styling */}
          <div className="border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl p-8">
            {/* Auth Forms */}
            {mode === "login" ? (
              <LoginForm redirectTo={tier ? `/settings?tier=${tier}` : undefined} />
            ) : (
              <SignupForm redirectTo={tier ? `/settings?tier=${tier}` : undefined} />
            )}

            {/* Forgot password & mode toggle */}
            <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
              {mode === "login" && (
                <div className="flex justify-center">
                  <Link
                    href="/password-reset"
                    className="text-xs font-mono text-white/40 hover:text-[#ccff00] transition-colors uppercase tracking-widest"
                  >
                    Forgot Password?
                  </Link>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-white/40 font-mono text-xs uppercase tracking-widest">
                  {mode === "login"
                    ? "Don't have an account?"
                    : "Already have an account?"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setMode(mode === "login" ? "signup" : "login")
                  }
                  className="text-[#ccff00] font-mono text-xs uppercase tracking-widest hover:underline"
                >
                  {mode === "login" ? "Sign up" : "Sign in"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Photo credit */}
        <div className="absolute bottom-4 text-center text-[10px] text-white/20">
          Photo by{' '}
          <a
            href="https://unsplash.com/@mathieuodin"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/40"
          >
            Mathieu Odin
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
